//! 代码功能 Tauri 命令层。文件系统命令与会话 CRUD 都是工具无关的；
//! `code_send_message` 负责用选定工具+模型在工作目录下跑一轮对话。

use crate::code;
use crate::state::AppState;
use serde_json::json;
use std::path::Path;
use tauri::State;

#[derive(Debug, Clone, serde::Serialize)]
struct DirEntry {
    name: String,
    path: String,
    is_dir: bool,
}

#[tauri::command]
pub async fn code_list_dir(path: String) -> Result<serde_json::Value, String> {
    let path = Path::new(&path);
    if !path.exists() {
        return Err("路径不存在".into());
    }
    if !path.is_dir() {
        return Err("路径不是目录".into());
    }

    let mut entries = Vec::new();
    let mut read_dir = tokio::fs::read_dir(path).await.map_err(|e| e.to_string())?;
    while let Some(entry) = read_dir.next_entry().await.map_err(|e| e.to_string())? {
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') {
            continue;
        }
        let path_str = entry.path().to_string_lossy().to_string();
        let is_dir = entry.file_type().await.map_err(|e| e.to_string())?.is_dir();
        entries.push(DirEntry { name, path: path_str, is_dir });
    }

    entries.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });

    Ok(json!({ "entries": entries }))
}

#[tauri::command]
pub async fn code_read_file(path: String) -> Result<serde_json::Value, String> {
    let path = Path::new(&path);
    if !path.exists() {
        return Err("文件不存在".into());
    }
    if !path.is_file() {
        return Err("路径不是文件".into());
    }
    let content = tokio::fs::read_to_string(path).await.map_err(|e| e.to_string())?;
    Ok(json!({ "content": content }))
}

#[tauri::command]
pub async fn code_write_file(path: String, content: String) -> Result<(), String> {
    let path = Path::new(&path);
    if let Some(parent) = path.parent() {
        if !parent.exists() {
            tokio::fs::create_dir_all(parent).await.map_err(|e| e.to_string())?;
        }
    }
    tokio::fs::write(path, content).await.map_err(|e| e.to_string())?;
    Ok(())
}

/// 探测本机已安装的代码工具。
#[tauri::command]
pub async fn code_detect_tools() -> Result<serde_json::Value, String> {
    let tools = code::tools::detect_all().await;
    Ok(json!({ "tools": tools }))
}

#[tauri::command]
pub async fn code_list_sessions(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    let sessions = code::store::list_sessions(&state.db)
        .await
        .map_err(|e| e.to_string())?;
    Ok(json!({ "sessions": sessions }))
}

#[tauri::command]
pub async fn code_get_session(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<serde_json::Value, String> {
    let session = code::store::get_session(&state.db, &session_id)
        .await
        .map_err(|e| e.to_string())?;
    serde_json::to_value(&session).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn code_create_session(
    state: State<'_, AppState>,
    title: Option<String>,
    working_dir: Option<String>,
) -> Result<serde_json::Value, String> {
    let title = title.unwrap_or_else(|| "新对话".to_string());
    let session = code::store::create_session(&state.db, &title, working_dir.as_deref())
        .await
        .map_err(|e| e.to_string())?;
    serde_json::to_value(&session).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn code_delete_session(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<(), String> {
    code::store::delete_session(&state.db, &session_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn code_update_session(
    state: State<'_, AppState>,
    session_id: String,
    title: Option<String>,
    working_dir: Option<String>,
    tool_id: Option<String>,
    model: Option<String>,
) -> Result<(), String> {
    code::store::update_session(
        &state.db,
        &session_id,
        title.as_deref(),
        working_dir.as_deref(),
        tool_id.as_deref(),
        model.as_deref(),
    )
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn code_send_message(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    session_id: String,
    content: String,
    tool_id: String,
    model: Option<String>,
    working_dir: Option<String>,
) -> Result<(), String> {
    if content.trim().is_empty() {
        return Err("消息不能为空".into());
    }

    let db = state.db.clone();

    // 工作目录：显式参数 > HOME。
    let effective_dir = working_dir.or_else(|| {
        std::env::var("HOME")
            .ok()
            .or_else(|| std::env::var("USERPROFILE").ok())
    });

    code::store::maybe_autotitle(&db, &session_id, &content).await;

    // fire-and-forget，流式结果走事件回传。
    tauri::async_runtime::spawn(async move {
        code::send_message_stream(app, db, session_id, content, effective_dir, tool_id, model)
            .await;
    });

    Ok(())
}
