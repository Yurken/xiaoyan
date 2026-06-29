//! 代码功能后端 —— 小妍原生代码助手。
//!
//! 不再调用用户本机安装的各类 code CLI，而是直接复用小妍设置里配置好的 LLM，
//! 在工作目录上下文中与用户进行代码对话。当前为 MVP 阶段：提供代码建议、解释、
//! 重构思路，暂不提供自动文件修改/命令执行等 Agent 工具能力。

pub mod store;

use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use std::collections::HashMap;
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

use crate::llm::{LlmClient, LlmMessage, resolve_model, resolve_temperature_chain};

use store::now;

// ── 领域类型 ──────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeSession {
    pub id: String,
    pub experiment_id: String,
    pub title: String,
    pub working_dir: Option<String>,
    /// 历史字段，保留以兼容旧数据，不再写入新值。
    pub tool_id: Option<String>,
    /// 历史字段，保留以兼容旧数据，不再写入新值。
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
    /// 历史字段，保留以兼容旧数据。
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
}

#[derive(Debug, Clone, Serialize)]
struct ErrorEvent {
    session_id: String,
    request_id: String,
    error: String,
}

// ── 核心：发送一轮消息并流式返回 ──────────────────────────────

/// 使用小妍设置中的 LLM 在 `working_dir` 上下文中执行一轮代码对话。
/// fire-and-forget，结果通过 `code:stream` / `code:done` / `code:error` 事件回传。
pub async fn send_message_stream(
    app: AppHandle,
    db: SqlitePool,
    settings: HashMap<String, String>,
    session_id: String,
    content: String,
    working_dir: Option<String>,
    current_file: Option<String>,
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

    // 2. 构建 LLM 客户端
    let client = match LlmClient::from_settings(&settings) {
        Ok(c) => c,
        Err(e) => {
            emit_error(&app, &session_id, &request_id, format!("LLM 配置错误：{e}"));
            return;
        }
    };
    let model = resolve_model(&settings, &["code_assistant_model", "copilot_simple_model", "paper_analysis_model"]);
    let temperature = resolve_temperature_chain(&settings, &["code_assistant_temperature", "copilot_simple_temperature"], 0.3);

    // 3. 组装消息上下文
    let session = match store::get_session(&db, &session_id).await {
        Ok(s) => s,
        Err(e) => {
            emit_error(&app, &session_id, &request_id, format!("读取会话失败：{e}"));
            return;
        }
    };

    let system_prompt = build_code_system_prompt(working_dir.as_deref(), current_file.as_deref());
    let mut messages = vec![LlmMessage::system(system_prompt)];

    // 只保留最近若干轮对话作为上下文，避免 token 爆炸。
    const MAX_CONTEXT_MESSAGES: usize = 20;
    let history_start = session.messages.len().saturating_sub(MAX_CONTEXT_MESSAGES);
    for msg in &session.messages[history_start..] {
        if msg.role == "user" {
            messages.push(LlmMessage::user(msg.content.clone()));
        } else if msg.role == "assistant" {
            messages.push(LlmMessage::assistant(msg.content.clone()));
        }
    }

    // 4. 流式调用并回传
    let app_for_delta = app.clone();
    let sid_for_delta = session_id.clone();
    let rid_for_delta = request_id.clone();

    let result = client
        .stream_chat(&messages, model.as_deref(), temperature, move |delta| {
            let _ = app_for_delta.emit(
                "code:stream",
                StreamEvent {
                    session_id: sid_for_delta.clone(),
                    request_id: rid_for_delta.clone(),
                    chunk: delta,
                },
            );
        })
        .await;

    match result {
        Ok(full) => {
            let assistant_msg = CodeMessage {
                id: Uuid::new_v4().to_string(),
                role: "assistant".to_string(),
                content: full.clone(),
                tool_id: None,
                model: model.clone(),
                created_at: now(),
            };
            let _ = store::persist_message(&db, &session_id, &assistant_msg).await;
            let _ = app.emit(
                "code:done",
                DoneEvent {
                    session_id,
                    request_id,
                    message_id: assistant_msg.id,
                    full_content: full,
                },
            );
        }
        Err(e) => emit_error(&app, &session_id, &request_id, format!("LLM 调用失败：{e}")),
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

/// 构建代码助手的 system prompt，注入工作目录与当前文件上下文。
fn build_code_system_prompt(working_dir: Option<&str>, current_file: Option<&str>) -> String {
    let dir_line = working_dir
        .map(|d| format!("当前工作目录：{d}"))
        .unwrap_or_else(|| "当前未选择工作目录。".to_string());
    let file_line = current_file
        .map(|f| format!("用户当前打开的文件：{f}"))
        .unwrap_or_else(|| "用户当前没有打开特定文件。".to_string());

    format!(
        "你是小妍代码助手，一位面向科研实验场景的编程助手。你帮助用户理解、编写、调试和重构代码。\n\
        \n\
        当前上下文：\n\
        - {dir_line}\n\
        - {file_line}\n\
        \n\
        请遵循以下原则：\n\
        1. 回答简洁、准确，优先给出可运行的代码或清晰的修改建议。\n\
        2. 如需修改文件，请在回复中给出完整的 diff 或代码块，并说明应放到哪个路径。\n\
        3. 不要主动执行任何命令或写入文件；当前阶段只提供建议。\n\
        4. 使用 Markdown 格式化代码块，必要时用中文注释说明关键步骤。\n\
        5. 如果用户问题与当前文件或工作目录有关，请结合上下文作答，不要编造文件内容。"
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_code_system_prompt_contains_context() {
        let prompt = build_code_system_prompt(Some("/tmp/project"), Some("main.py"));
        assert!(prompt.contains("/tmp/project"));
        assert!(prompt.contains("main.py"));
        assert!(prompt.contains("小妍代码助手"));
    }
}
