//! OpenCode 集成模块 — 通过子进程调用 OpenCode CLI，
//! 提供代码生成、执行、分析能力，并以小妍人设呈现。

use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Stdio;
use tauri::{AppHandle, Emitter};
use tokio::io::AsyncReadExt;
use tokio::process::Command;
use uuid::Uuid;

use crate::llm::LlmClient;

// ── 类型定义 ──────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenCodeSession {
    pub id: String,
    pub title: String,
    pub working_dir: Option<String>,
    pub messages: Vec<OpenCodeMessage>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenCodeMessage {
    pub id: String,
    pub role: String,
    pub content: String,
    pub created_at: String,
}

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
    used_fallback: bool,
}

#[derive(Debug, Clone, Serialize)]
struct ErrorEvent {
    session_id: String,
    request_id: String,
    error: String,
}

// ── OpenCode CLI 检测 ─────────────────────────────────────────

/// 查找 opencode 可执行文件路径。
/// 优先检查 settings 中的自定义路径，其次查找 PATH 中的 opencode。
pub fn find_opencode_binary(settings: &HashMap<String, String>) -> Option<String> {
    // 1. 用户自定义路径
    if let Some(custom) = settings.get("opencode_binary_path") {
        if !custom.is_empty() && std::path::Path::new(custom).exists() {
            return Some(custom.clone());
        }
    }
    // 2. 在 PATH 中查找
    find_in_path("opencode")
}

fn find_in_path(name: &str) -> Option<String> {
    if let Ok(output) = std::process::Command::new("which").arg(name).output() {
        if output.status.success() {
            let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !path.is_empty() {
                return Some(path);
            }
        }
    }
    // Windows fallback
    #[cfg(target_os = "windows")]
    {
        if let Ok(output) = std::process::Command::new("where").arg(name).output() {
            if output.status.success() {
                let path = String::from_utf8_lossy(&output.stdout)
                    .lines()
                    .next()
                    .unwrap_or("")
                    .trim()
                    .to_string();
                if !path.is_empty() {
                    return Some(path);
                }
            }
        }
    }
    None
}

/// 获取 opencode 版本信息。
pub async fn get_opencode_version(binary: &str) -> Option<String> {
    let output = Command::new(binary)
        .arg("--version")
        .output()
        .await
        .ok()?;
    if output.status.success() {
        Some(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        None
    }
}

// ── 数据库操作 ─────────────────────────────────────────────────

fn now() -> String {
    chrono::Utc::now().format("%Y-%m-%dT%H:%M:%S").to_string()
}

pub async fn create_session(
    db: &SqlitePool,
    title: &str,
    working_dir: Option<&str>,
) -> anyhow::Result<OpenCodeSession> {
    let id = Uuid::new_v4().to_string();
    let ts = now();
    sqlx::query(
        "INSERT INTO opencode_sessions (id, title, working_dir, messages_json, created_at, updated_at)
         VALUES (?, ?, ?, '[]', ?, ?)",
    )
    .bind(&id)
    .bind(title)
    .bind(working_dir)
    .bind(&ts)
    .bind(&ts)
    .execute(db)
    .await?;

    Ok(OpenCodeSession {
        id,
        title: title.to_string(),
        working_dir: working_dir.map(|s| s.to_string()),
        messages: vec![],
        created_at: ts.clone(),
        updated_at: ts,
    })
}

pub async fn list_sessions(db: &SqlitePool) -> anyhow::Result<Vec<OpenCodeSession>> {
    let rows = sqlx::query(
        "SELECT id, title, working_dir, messages_json, created_at, updated_at
         FROM opencode_sessions ORDER BY updated_at DESC",
    )
    .fetch_all(db)
    .await?;

    use sqlx::Row;
    Ok(rows
        .iter()
        .map(|row| {
            let messages_raw: String = row.get("messages_json");
            let messages: Vec<OpenCodeMessage> =
                serde_json::from_str(&messages_raw).unwrap_or_default();
            OpenCodeSession {
                id: row.get("id"),
                title: row.get("title"),
                working_dir: row.get("working_dir"),
                messages,
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
            }
        })
        .collect())
}

pub async fn get_session(db: &SqlitePool, session_id: &str) -> anyhow::Result<OpenCodeSession> {
    let row = sqlx::query(
        "SELECT id, title, working_dir, messages_json, created_at, updated_at
         FROM opencode_sessions WHERE id = ?",
    )
    .bind(session_id)
    .fetch_optional(db)
    .await?;

    match row {
        Some(row) => {
            use sqlx::Row;
            let messages_raw: String = row.get("messages_json");
            let messages: Vec<OpenCodeMessage> =
                serde_json::from_str(&messages_raw).unwrap_or_default();
            Ok(OpenCodeSession {
                id: row.get("id"),
                title: row.get("title"),
                working_dir: row.get("working_dir"),
                messages,
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
            })
        }
        None => anyhow::bail!("Session not found"),
    }
}

pub async fn delete_session(db: &SqlitePool, session_id: &str) -> anyhow::Result<()> {
    sqlx::query("DELETE FROM opencode_sessions WHERE id = ?")
        .bind(session_id)
        .execute(db)
        .await?;
    Ok(())
}

async fn persist_message(db: &SqlitePool, session_id: &str, msg: &OpenCodeMessage) -> anyhow::Result<()> {
    let row = sqlx::query("SELECT messages_json FROM opencode_sessions WHERE id = ?")
        .bind(session_id)
        .fetch_optional(db)
        .await?;

    let mut messages: Vec<OpenCodeMessage> = match row {
        Some(r) => {
            use sqlx::Row;
            let raw: String = r.get("messages_json");
            serde_json::from_str(&raw).unwrap_or_default()
        }
        None => vec![],
    };

    messages.push(msg.clone());
    let json = serde_json::to_string(&messages)?;
    let ts = now();
    sqlx::query("UPDATE opencode_sessions SET messages_json = ?, updated_at = ? WHERE id = ?")
        .bind(&json)
        .bind(&ts)
        .bind(session_id)
        .execute(db)
        .await?;
    Ok(())
}

// ── 核心：发送消息并流式返回 ──────────────────────────────────

pub async fn send_message_stream(
    app: AppHandle,
    db: SqlitePool,
    settings: HashMap<String, String>,
    session_id: String,
    content: String,
    working_dir: Option<String>,
) {
    let request_id = Uuid::new_v4().to_string();
    let user_msg_id = Uuid::new_v4().to_string();
    let ts = now();

    // Persist user message
    let user_msg = OpenCodeMessage {
        id: user_msg_id.clone(),
        role: "user".to_string(),
        content: content.clone(),
        created_at: ts.clone(),
    };
    if let Err(e) = persist_message(&db, &session_id, &user_msg).await {
        crate::append_diagnostic_log(&format!("opencode: persist user msg error: {e}"));
    }

    // Try OpenCode CLI first
    let opencode_binary = find_opencode_binary(&settings);
    if let Some(binary) = opencode_binary {
        match run_opencode_stream(
            &app, &db, &binary, &session_id, &request_id, &content,
            working_dir.as_deref(),
        ).await {
            Ok(_) => return,
            Err(e) => {
                crate::append_diagnostic_log(&format!("opencode: CLI failed, falling back: {e}"));
            }
        }
    }

    // Fallback: use LLM
    if let Err(e) = run_llm_fallback(
        &app, &db, &settings, &session_id, &request_id, &content,
    ).await {
        let _ = app.emit("opencode:error", ErrorEvent {
            session_id,
            request_id,
            error: format!("执行失败：{e}"),
        });
    }
}

/// 通过 OpenCode CLI 子进程流式执行
async fn run_opencode_stream(
    app: &AppHandle,
    db: &SqlitePool,
    binary: &str,
    session_id: &str,
    request_id: &str,
    content: &str,
    working_dir: Option<&str>,
) -> anyhow::Result<()> {
    let mut cmd = Command::new(binary);
    cmd.arg("-p")
        .arg(content)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);

    if let Some(dir) = working_dir {
        let path = PathBuf::from(dir);
        if path.is_dir() {
            cmd.current_dir(&path);
        }
    }

    // Set up environment for cleaner output
    cmd.env("NO_COLOR", "1");
    cmd.env("TERM", "dumb");

    let mut child = cmd.spawn()?;
    let mut stdout = child.stdout.take().ok_or_else(|| anyhow::anyhow!("no stdout"))?;

    let mut full_content = String::new();
    let mut buf = [0u8; 4096];

    loop {
        let n = stdout.read(&mut buf).await?;
        if n == 0 {
            break;
        }
        let chunk = String::from_utf8_lossy(&buf[..n]).to_string();
        full_content.push_str(&chunk);

        let _ = app.emit("opencode:stream", StreamEvent {
            session_id: session_id.to_string(),
            request_id: request_id.to_string(),
            chunk,
        });
    }

    let status = child.wait().await?;
    if !status.success() {
        let mut stderr_buf = Vec::new();
        if let Some(mut stderr) = child.stderr.take() {
            let _ = stderr.read_to_end(&mut stderr_buf).await;
        }
        let stderr_text = String::from_utf8_lossy(&stderr_buf);
        if !stderr_text.trim().is_empty() {
            anyhow::bail!("OpenCode exited with error: {}", stderr_text.trim());
        }
        anyhow::bail!("OpenCode exited with status: {}", status);
    }

    // Clean output (strip any remaining ANSI)
    let cleaned = strip_ansi_codes(&full_content);

    // Persist assistant message
    let assistant_msg = OpenCodeMessage {
        id: Uuid::new_v4().to_string(),
        role: "assistant".to_string(),
        content: cleaned.clone(),
        created_at: now(),
    };
    let _ = persist_message(db, session_id, &assistant_msg).await;

    let _ = app.emit("opencode:done", DoneEvent {
        session_id: session_id.to_string(),
        request_id: request_id.to_string(),
        message_id: assistant_msg.id,
        full_content: cleaned,
        used_fallback: false,
    });

    Ok(())
}

/// 使用内置 LLM 作为代码助手（OpenCode 不可用时的兜底）
async fn run_llm_fallback(
    app: &AppHandle,
    db: &SqlitePool,
    settings: &HashMap<String, String>,
    session_id: &str,
    request_id: &str,
    content: &str,
) -> anyhow::Result<()> {
    let client = LlmClient::from_settings(settings)?;

    let system = build_code_assistant_prompt();
    let messages = vec![
        crate::llm::LlmMessage::system(&system),
        crate::llm::LlmMessage::user(content),
    ];

    // Use code-specific model settings, falling back to defaults
    let model = crate::llm::resolve_model(settings, &[
        "opencode_model",
        "paper_reproduction_model",
        "multi_agent_worker_model",
    ]);
    let temperature = crate::llm::resolve_temperature_chain(
        settings,
        &["opencode_temperature", "paper_reproduction_temperature"],
        0.3,
    );

    let response = client.chat(&messages, model.as_deref(), temperature).await?;

    // Stream the response in chunks to simulate streaming
    let chunk_size = 64;
    let mut offset = 0;
    while offset < response.len() {
        let end = (offset + chunk_size).min(response.len());
        let chunk = response[offset..end].to_string();
        let _ = app.emit("opencode:stream", StreamEvent {
            session_id: session_id.to_string(),
            request_id: request_id.to_string(),
            chunk,
        });
        offset = end;
        tokio::time::sleep(tokio::time::Duration::from_millis(20)).await;
    }

    // Persist
    let assistant_msg = OpenCodeMessage {
        id: Uuid::new_v4().to_string(),
        role: "assistant".to_string(),
        content: response.clone(),
        created_at: now(),
    };
    let _ = persist_message(db, session_id, &assistant_msg).await;

    let _ = app.emit("opencode:done", DoneEvent {
        session_id: session_id.to_string(),
        request_id: request_id.to_string(),
        message_id: assistant_msg.id,
        full_content: response,
        used_fallback: true,
    });

    Ok(())
}

// ── 小妍代码助手 prompt ──────────────────────────────────────

pub fn build_code_assistant_prompt() -> String {
    "你是小妍的代码助手模块，一位严谨、高效的科研编程协作者。\n\
核心原则：\n\
1. 默认使用简体中文交流，代码注释可以中英混合。\n\
2. 先理解需求再动手写代码。对模糊需求先确认，不要猜测。\n\
3. 代码质量优先：结构清晰、注释充分、错误处理完备。\n\
4. 科研场景特长：论文复现代码、数据处理管道、实验脚本、可视化图表、统计分析。\n\
5. 给出代码时附带简要的运行说明（依赖安装、执行命令）。\n\
6. 遇到不确定的 API 或库，明确说明而非编造。\n\
7. 代码块使用正确的语言标记（```python、```bash 等）。\n\
8. 如果用户的代码有 bug，指出问题位置并给出修复方案。".to_string()
}

// ── 工具函数 ──────────────────────────────────────────────────

/// 去除 ANSI 转义序列
fn strip_ansi_codes(s: &str) -> String {
    let re = regex::Regex::new(r"\x1b\[[0-9;]*[A-Za-z]|\x1b\][^\x07]*\x07|\x1b[()][AB012]|\x1b\[[\?]?[0-9;]*[hlm]")
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
