use crate::opencode;
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
pub async fn opencode_list_dir(
    path: String,
) -> Result<serde_json::Value, String> {
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
        // Skip hidden files
        if name.starts_with('.') {
            continue;
        }
        let path_str = entry.path().to_string_lossy().to_string();
        let is_dir = entry.file_type().await.map_err(|e| e.to_string())?.is_dir();
        entries.push(DirEntry {
            name,
            path: path_str,
            is_dir,
        });
    }

    // Sort: dirs first, then files; alphabetically within each group
    entries.sort_by(|a, b| {
        match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });

    Ok(json!({ "entries": entries }))
}

#[tauri::command]
pub async fn opencode_read_file(
    path: String,
) -> Result<serde_json::Value, String> {
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
pub async fn opencode_write_file(
    path: String,
    content: String,
) -> Result<(), String> {
    let path = Path::new(&path);
    // Ensure parent directory exists
    if let Some(parent) = path.parent() {
        if !parent.exists() {
            tokio::fs::create_dir_all(parent)
                .await
                .map_err(|e| e.to_string())?;
        }
    }
    tokio::fs::write(path, content).await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn opencode_detect(
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let settings = state.settings.read().await;
    let binary = opencode::find_opencode_binary(&settings);
    let version = if let Some(ref bin) = binary {
        opencode::get_opencode_version(bin).await
    } else {
        None
    };

    Ok(json!({
        "installed": binary.is_some(),
        "binaryPath": binary,
        "version": version,
    }))
}

#[tauri::command]
pub async fn opencode_list_sessions(
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let sessions = opencode::list_sessions(&state.db)
        .await
        .map_err(|e| e.to_string())?;

    Ok(json!({ "sessions": sessions }))
}

#[tauri::command]
pub async fn opencode_get_session(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<serde_json::Value, String> {
    let session = opencode::get_session(&state.db, &session_id)
        .await
        .map_err(|e| e.to_string())?;

    Ok(serde_json::to_value(&session).map_err(|e| e.to_string())?)
}

#[tauri::command]
pub async fn opencode_create_session(
    state: State<'_, AppState>,
    title: Option<String>,
    working_dir: Option<String>,
) -> Result<serde_json::Value, String> {
    let title = title.unwrap_or_else(|| "新对话".to_string());
    let session = opencode::create_session(&state.db, &title, working_dir.as_deref())
        .await
        .map_err(|e| e.to_string())?;

    Ok(serde_json::to_value(&session).map_err(|e| e.to_string())?)
}

#[tauri::command]
pub async fn opencode_delete_session(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<(), String> {
    opencode::delete_session(&state.db, &session_id)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn opencode_send_message(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    session_id: String,
    content: String,
    working_dir: Option<String>,
) -> Result<(), String> {
    if content.trim().is_empty() {
        return Err("消息不能为空".into());
    }

    let db = state.db.clone();
    let settings = state.settings.read().await.clone();

    // Resolve working directory: explicit param > home dir
    let effective_dir = working_dir.or_else(|| {
        std::env::var("HOME")
            .ok()
            .or_else(|| std::env::var("USERPROFILE").ok())
    });

    // Auto-title from first user message
    if let Ok(session) = opencode::get_session(&db, &session_id).await {
        if session.messages.len() <= 1 && session.title == "新对话" {
            let truncated = if content.len() > 50 {
                &content[..50]
            } else {
                &content
            };
            let _ = sqlx::query(
                "UPDATE opencode_sessions SET title = ?, updated_at = ? WHERE id = ?",
            )
            .bind(truncated)
            .bind(chrono::Utc::now().format("%Y-%m-%dT%H:%M:%S").to_string())
            .bind(&session_id)
            .execute(&db)
            .await;
        }
    }

    // Spawn async task for streaming — fire and forget, results come via events
    tauri::async_runtime::spawn(async move {
        opencode::send_message_stream(app, db, settings, session_id, content, effective_dir).await;
    });

    Ok(())
}

#[tauri::command]
pub async fn opencode_update_session(
    state: State<'_, AppState>,
    session_id: String,
    title: Option<String>,
    working_dir: Option<String>,
) -> Result<(), String> {
    let mut sets = Vec::new();
    let mut binds: Vec<String> = Vec::new();

    if let Some(t) = title {
        sets.push("title = ?");
        binds.push(t);
    }
    if let Some(d) = working_dir {
        sets.push("working_dir = ?");
        binds.push(d);
    }

    if sets.is_empty() {
        return Ok(());
    }

    sets.push("updated_at = ?");
    binds.push(chrono::Utc::now().format("%Y-%m-%dT%H:%M:%S").to_string());
    binds.push(session_id.clone());

    let sql = format!("UPDATE opencode_sessions SET {} WHERE id = ?", sets.join(", "));
    let mut query = sqlx::query(&sql);
    for b in &binds {
        query = query.bind(b);
    }
    query
        .execute(&state.db)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}
