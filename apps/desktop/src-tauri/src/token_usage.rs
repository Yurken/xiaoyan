//! 全局 token 用量统计。
//!
//! 所有 LLM 调用都经过 `llm::LlmClient` 的若干叶子函数，这里提供一个无需把 DB
//! 句柄逐层透传的全局落库入口：启动时 `init` 注入连接池，叶子函数在拿到响应后
//! 调用 `record`（fire-and-forget）把用量累加进当天的聚合行。
//!
//! 优先采用 provider 返回的真实用量（OpenAI `usage`、Anthropic `usage` 事件），
//! 缺失时退化为本地估算（见 `estimate_tokens`）。统计只在本地维护，不参与同步。

use crate::llm::LlmMessage;
use chrono::Local;
use serde::Serialize;
use sqlx::{Row, SqlitePool};
use std::sync::OnceLock;

static USAGE_POOL: OnceLock<SqlitePool> = OnceLock::new();

/// 启动时注入连接池。重复调用忽略。
pub fn init(pool: SqlitePool) {
    let _ = USAGE_POOL.set(pool);
}

/// 本地 token 估算：英文按约 4 字符/token，CJK 等非 ASCII 字符按 1 token/字。
/// 仅作为 provider 未返回用量时的兜底，量级正确即可，不追求与计费完全一致。
pub fn estimate_tokens(text: &str) -> u64 {
    let mut tokens: u64 = 0;
    let mut ascii_run: u64 = 0;
    for ch in text.chars() {
        if ch.is_ascii() {
            ascii_run += 1;
        } else {
            tokens += ascii_run.div_ceil(4);
            ascii_run = 0;
            tokens += 1;
        }
    }
    tokens + ascii_run.div_ceil(4)
}

/// 估算一组消息（含 system/user/assistant/tool）的输入 token 量。
pub fn estimate_messages(messages: &[LlmMessage]) -> u64 {
    messages
        .iter()
        .map(|m| {
            let mut t = estimate_tokens(&m.content);
            if let Some(calls) = &m.tool_calls {
                for c in calls {
                    t += estimate_tokens(&c.name) + estimate_tokens(&c.arguments);
                }
            }
            // 图片按固定开销粗算，避免被完全忽略。
            t += m.images.len() as u64 * 256;
            t
        })
        .sum()
}

/// 统计一组消息的字符数（含工具调用名/参数；图片不计字符）。
pub fn count_messages_chars(messages: &[LlmMessage]) -> u64 {
    messages
        .iter()
        .map(|m| {
            let mut c = m.content.chars().count() as u64;
            if let Some(calls) = &m.tool_calls {
                for call in calls {
                    c += (call.name.chars().count() + call.arguments.chars().count()) as u64;
                }
            }
            c
        })
        .sum()
}

/// 把一次调用的用量累加进当天聚合行（fire-and-forget，失败仅记日志）。
pub fn record(input_tokens: u64, output_tokens: u64, input_chars: u64, output_chars: u64) {
    if input_tokens == 0 && output_tokens == 0 && input_chars == 0 && output_chars == 0 {
        return;
    }
    let Some(pool) = USAGE_POOL.get().cloned() else {
        return;
    };
    let day = Local::now().format("%Y-%m-%d").to_string();
    let input_tokens = input_tokens as i64;
    let output_tokens = output_tokens as i64;
    let input_chars = input_chars as i64;
    let output_chars = output_chars as i64;
    tokio::spawn(async move {
        let res = sqlx::query(
            "INSERT INTO token_usage_daily
                 (day, input_tokens, output_tokens, input_chars, output_chars, request_count)
             VALUES (?, ?, ?, ?, ?, 1)
             ON CONFLICT(day) DO UPDATE SET
                 input_tokens = input_tokens + excluded.input_tokens,
                 output_tokens = output_tokens + excluded.output_tokens,
                 input_chars = input_chars + excluded.input_chars,
                 output_chars = output_chars + excluded.output_chars,
                 request_count = request_count + 1",
        )
        .bind(&day)
        .bind(input_tokens)
        .bind(output_tokens)
        .bind(input_chars)
        .bind(output_chars)
        .execute(&pool)
        .await;
        if let Err(e) = res {
            crate::append_diagnostic_log(&format!("[token_usage] record failed: {e}"));
        }
    });
}

/// 便捷入口：给定输入消息与输出文本，结合 provider 返回的可选用量落库。
/// token 在 `api_usage` 为 `Some` 时优先采用、否则本地估算；字符数始终按真实文本统计。
pub fn record_chat(messages: &[LlmMessage], output_text: &str, api_usage: Option<(u64, u64)>) {
    let (input_tokens, output_tokens) = match api_usage {
        Some((i, o)) => (i, o),
        None => (estimate_messages(messages), estimate_tokens(output_text)),
    };
    record(
        input_tokens,
        output_tokens,
        count_messages_chars(messages),
        output_text.chars().count() as u64,
    );
}

#[derive(Serialize, Default)]
pub struct UsageBucket {
    pub input: i64,
    pub output: i64,
    pub total: i64,
    /// 输入+输出的真实字符数，前端展示为「约 X 字符」。
    pub chars: i64,
    pub requests: i64,
}

#[derive(Serialize, Default)]
pub struct TokenUsageStats {
    pub total: UsageBucket,
    pub today: UsageBucket,
    pub month: UsageBucket,
}

async fn sum_where(pool: &SqlitePool, where_clause: &str, bind: Option<&str>) -> UsageBucket {
    let sql = format!(
        "SELECT COALESCE(SUM(input_tokens),0) AS i, COALESCE(SUM(output_tokens),0) AS o, \
         COALESCE(SUM(input_chars),0) AS ic, COALESCE(SUM(output_chars),0) AS oc, \
         COALESCE(SUM(request_count),0) AS r FROM token_usage_daily {where_clause}"
    );
    let mut q = sqlx::query(&sql);
    if let Some(b) = bind {
        q = q.bind(b);
    }
    match q.fetch_one(pool).await {
        Ok(row) => {
            let input: i64 = row.try_get("i").unwrap_or(0);
            let output: i64 = row.try_get("o").unwrap_or(0);
            let input_chars: i64 = row.try_get("ic").unwrap_or(0);
            let output_chars: i64 = row.try_get("oc").unwrap_or(0);
            let requests: i64 = row.try_get("r").unwrap_or(0);
            UsageBucket {
                input,
                output,
                total: input + output,
                chars: input_chars + output_chars,
                requests,
            }
        }
        Err(_) => UsageBucket::default(),
    }
}

/// 计算累计 / 今日 / 本月三档用量。
pub async fn compute_stats(pool: &SqlitePool) -> TokenUsageStats {
    let now = Local::now();
    let today = now.format("%Y-%m-%d").to_string();
    let month_prefix = format!("{}%", now.format("%Y-%m-"));
    TokenUsageStats {
        total: sum_where(pool, "", None).await,
        today: sum_where(pool, "WHERE day = ?", Some(&today)).await,
        month: sum_where(pool, "WHERE day LIKE ?", Some(&month_prefix)).await,
    }
}
