//! 代码功能后端 — 把用户本地已安装的各类 code CLI 统一成「壳」，
//! 在同一工作目录下可自由切换工具与模型继续对话。
//!
//! 设计要点：
//! - 仅调用本地工具自身的鉴权/模型配置，**不使用**小妍配置的 API。
//! - 每轮对话以非交互（headless）方式 spawn 选定工具，流式回传 stdout。
//! - 会话记录仅落盘本地（见 [`store`]），不参与多平台同步。

pub mod store;
pub mod tools;

use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use std::path::PathBuf;
use std::process::Stdio;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::process::Command;
use uuid::Uuid;

use store::now;

// ── 领域类型 ──────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeSession {
    pub id: String,
    pub experiment_id: String,
    pub title: String,
    pub working_dir: Option<String>,
    /// 最近使用的工具 id。
    pub tool_id: Option<String>,
    /// 最近使用的模型（空表示工具自带默认）。
    pub model: Option<String>,
    pub messages: Vec<CodeMessage>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeMessage {
    pub id: String,
    pub role: String,
    pub content: String,
    /// 产出该消息的工具（仅 assistant 消息有值）。
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tool_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    pub created_at: String,
}

// ── 事件载荷 ──────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
struct StreamEvent {
    session_id: String,
    request_id: String,
    chunk: String,
}

#[derive(Debug, Clone, Serialize)]
struct DoneEvent {
    session_id: String,
    request_id: String,
    message_id: String,
    full_content: String,
    tool_id: String,
    model: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
struct ErrorEvent {
    session_id: String,
    request_id: String,
    error: String,
}

// ── 核心：发送一轮消息并流式返回 ──────────────────────────────

/// 用选定工具+模型在 `working_dir` 下执行一轮对话。fire-and-forget，
/// 结果通过 `code:stream` / `code:done` / `code:error` 事件回传。
#[allow(clippy::too_many_arguments)]
pub async fn send_message_stream(
    app: AppHandle,
    db: SqlitePool,
    session_id: String,
    content: String,
    working_dir: Option<String>,
    tool_id: String,
    model: Option<String>,
) {
    let request_id = Uuid::new_v4().to_string();

    // 1. 落盘用户消息
    let user_msg = CodeMessage {
        id: Uuid::new_v4().to_string(),
        role: "user".to_string(),
        content: content.clone(),
        tool_id: None,
        model: None,
        created_at: now(),
    };
    if let Err(e) = store::persist_message(&db, &session_id, &user_msg).await {
        crate::append_diagnostic_log(&format!("code: persist user msg error: {e}"));
    }

    // 2. 解析工具与二进制
    let Some(spec) = tools::spec(&tool_id) else {
        emit_error(&app, &session_id, &request_id, format!("未知的代码工具：{tool_id}"));
        return;
    };
    let Some(binary) = tools::find_in_path(spec.bin) else {
        emit_error(
            &app,
            &session_id,
            &request_id,
            format!("未检测到 {}，请先在本机安装并配置该工具。", spec.label),
        );
        return;
    };

    // 3. 执行并流式回传
    let run = tools::build_run_spec(&tool_id, &binary, &content, model.as_deref());
    match run_stream(&app, &session_id, &request_id, run, working_dir.as_deref()).await {
        Ok(full) => {
            let cleaned = strip_ansi_codes(&full);
            let assistant_msg = CodeMessage {
                id: Uuid::new_v4().to_string(),
                role: "assistant".to_string(),
                content: cleaned.clone(),
                tool_id: Some(tool_id.clone()),
                model: model.clone().filter(|m| !m.trim().is_empty()),
                created_at: now(),
            };
            let _ = store::persist_message(&db, &session_id, &assistant_msg).await;
            let _ = app.emit(
                "code:done",
                DoneEvent {
                    session_id,
                    request_id,
                    message_id: assistant_msg.id,
                    full_content: cleaned,
                    tool_id,
                    model: assistant_msg.model,
                },
            );
        }
        Err(e) => emit_error(&app, &session_id, &request_id, format!("{e}")),
    }
}

fn emit_error(app: &AppHandle, session_id: &str, request_id: &str, error: String) {
    let _ = app.emit(
        "code:error",
        ErrorEvent {
            session_id: session_id.to_string(),
            request_id: request_id.to_string(),
            error,
        },
    );
}

/// 以子进程流式执行一次工具调用，返回完整 stdout（未清理）。
async fn run_stream(
    app: &AppHandle,
    session_id: &str,
    request_id: &str,
    run: tools::RunSpec,
    working_dir: Option<&str>,
) -> anyhow::Result<String> {
    let mut cmd = Command::new(&run.program);
    cmd.args(&run.args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .stdin(if run.stdin.is_some() { Stdio::piped() } else { Stdio::null() })
        .env("NO_COLOR", "1")
        .env("TERM", "dumb")
        .kill_on_drop(true);

    if let Some(dir) = working_dir {
        let path = PathBuf::from(dir);
        if path.is_dir() {
            cmd.current_dir(&path);
        }
    }

    let mut child = cmd
        .spawn()
        .map_err(|e| anyhow::anyhow!("无法启动 {}：{e}", run.program))?;

    // 需要时把提示词写入 stdin 后关闭，让工具读到 EOF。
    if let Some(input) = run.stdin {
        if let Some(mut stdin) = child.stdin.take() {
            let _ = stdin.write_all(input.as_bytes()).await;
            let _ = stdin.shutdown().await;
        }
    }

    let mut stdout = child.stdout.take().ok_or_else(|| anyhow::anyhow!("no stdout"))?;
    let mut full = String::new();
    let mut buf = [0u8; 4096];

    loop {
        let n = stdout.read(&mut buf).await?;
        if n == 0 {
            break;
        }
        let chunk = String::from_utf8_lossy(&buf[..n]).to_string();
        full.push_str(&chunk);
        // 流式片段做一次 best-effort 清理（NO_COLOR 下多数工具已无 ANSI）。
        let _ = app.emit(
            "code:stream",
            StreamEvent {
                session_id: session_id.to_string(),
                request_id: request_id.to_string(),
                chunk: strip_ansi_codes(&chunk),
            },
        );
    }

    let status = child.wait().await?;
    if !status.success() {
        let mut stderr_buf = Vec::new();
        if let Some(mut stderr) = child.stderr.take() {
            let _ = stderr.read_to_end(&mut stderr_buf).await;
        }
        let stderr_text = String::from_utf8_lossy(&stderr_buf);
        let trimmed = stderr_text.trim();
        if !trimmed.is_empty() {
            anyhow::bail!("工具执行出错：{trimmed}");
        }
        anyhow::bail!("工具异常退出（状态码 {status}）");
    }

    Ok(full)
}

// ── 工具函数 ──────────────────────────────────────────────────

/// 去除 ANSI 转义序列。
fn strip_ansi_codes(s: &str) -> String {
    let re = regex::Regex::new(
        r"\x1b\[[0-9;]*[A-Za-z]|\x1b\][^\x07]*\x07|\x1b[()][AB012]|\x1b\[[\?]?[0-9;]*[hlm]",
    )
    .expect("invalid ANSI regex");
    re.replace_all(s, "").to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_strip_ansi_codes() {
        assert_eq!(strip_ansi_codes("\x1b[32mhello\x1b[0m"), "hello");
        assert_eq!(strip_ansi_codes("no codes here"), "no codes here");
        assert_eq!(strip_ansi_codes("\x1b[1;34mblue bold\x1b[0m end"), "blue bold end");
    }
}
