use crate::state::AppState;
use base64::{engine::general_purpose, Engine as _};
use serde_json::json;
use sqlx::Row;
use std::path::{Path, PathBuf};
use tauri::{Manager, State};
use uuid::Uuid;

fn now() -> String {
    chrono::Utc::now().format("%Y-%m-%dT%H:%M:%S").to_string()
}

#[tauri::command]
pub async fn experiment_list(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    let rows = sqlx::query(
        "SELECT id, title, config, result, notes, linked_submission_id, created_at, updated_at
         FROM experiment_records ORDER BY updated_at DESC",
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    let items: Vec<serde_json::Value> = rows
        .iter()
        .map(|row| {
            let config_raw: String = row.get("config");
            let config: serde_json::Value =
                serde_json::from_str(&config_raw).unwrap_or_else(|_| json!({}));
            json!({
                "id": row.get::<String, _>("id"),
                "title": row.get::<String, _>("title"),
                "config": config,
                "result": row.get::<String, _>("result"),
                "notes": row.get::<String, _>("notes"),
                "linkedSubmissionId": row.get::<Option<String>, _>("linked_submission_id"),
                "createdAt": row.get::<String, _>("created_at"),
                "updatedAt": row.get::<String, _>("updated_at"),
            })
        })
        .collect();

    Ok(json!({ "experiments": items }))
}

#[tauri::command]
pub async fn experiment_get(
    state: State<'_, AppState>,
    id: String,
) -> Result<serde_json::Value, String> {
    let row = sqlx::query(
        "SELECT id, title, config, result, notes, linked_submission_id, created_at, updated_at
         FROM experiment_records WHERE id = ?",
    )
    .bind(&id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    match row {
        Some(row) => {
            let config_raw: String = row.get("config");
            let config: serde_json::Value =
                serde_json::from_str(&config_raw).unwrap_or_else(|_| json!({}));
            Ok(json!({
                "id": row.get::<String, _>("id"),
                "title": row.get::<String, _>("title"),
                "config": config,
                "result": row.get::<String, _>("result"),
                "notes": row.get::<String, _>("notes"),
                "linkedSubmissionId": row.get::<Option<String>, _>("linked_submission_id"),
                "createdAt": row.get::<String, _>("created_at"),
                "updatedAt": row.get::<String, _>("updated_at"),
            }))
        }
        None => Err("Experiment not found".into()),
    }
}

#[tauri::command]
pub async fn create_experiment_core(
    db: &sqlx::SqlitePool,
    title: String,
    config: Option<serde_json::Value>,
    result: Option<String>,
    notes: Option<String>,
    linked_submission_id: Option<String>,
) -> Result<serde_json::Value, String> {
    let id = Uuid::new_v4().to_string();
    let ts = now();
    let config_json =
        serde_json::to_string(&config.unwrap_or_else(|| json!({}))).unwrap_or_else(|_| "{}".into());
    sqlx::query(
        "INSERT INTO experiment_records (id, title, config, result, notes, linked_submission_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&title)
    .bind(&config_json)
    .bind(result.as_deref().unwrap_or(""))
    .bind(notes.as_deref().unwrap_or(""))
    .bind(linked_submission_id.as_deref())
    .bind(&ts)
    .bind(&ts)
    .execute(db)
    .await
    .map_err(|e| e.to_string())?;

    Ok(json!({ "id": id, "title": title }))
}

#[tauri::command]
pub async fn experiment_create(
    state: State<'_, AppState>,
    title: String,
    config: Option<serde_json::Value>,
    result: Option<String>,
    notes: Option<String>,
    linked_submission_id: Option<String>,
) -> Result<serde_json::Value, String> {
    create_experiment_core(
        &state.db,
        title,
        config,
        result,
        notes,
        linked_submission_id,
    )
    .await
}

#[tauri::command]
pub async fn experiment_update(
    state: State<'_, AppState>,
    id: String,
    title: Option<String>,
    config: Option<serde_json::Value>,
    result: Option<String>,
    notes: Option<String>,
    linked_submission_id: Option<String>,
) -> Result<(), String> {
    let ts = now();
    if let Some(v) = &title {
        sqlx::query("UPDATE experiment_records SET title = ?, updated_at = ? WHERE id = ?")
            .bind(v)
            .bind(&ts)
            .bind(&id)
            .execute(&state.db)
            .await
            .map_err(|e| e.to_string())?;
    }
    if let Some(v) = &config {
        let json_str = serde_json::to_string(v).unwrap_or_else(|_| "{}".into());
        sqlx::query("UPDATE experiment_records SET config = ?, updated_at = ? WHERE id = ?")
            .bind(&json_str)
            .bind(&ts)
            .bind(&id)
            .execute(&state.db)
            .await
            .map_err(|e| e.to_string())?;
    }
    if let Some(v) = &result {
        sqlx::query("UPDATE experiment_records SET result = ?, updated_at = ? WHERE id = ?")
            .bind(v)
            .bind(&ts)
            .bind(&id)
            .execute(&state.db)
            .await
            .map_err(|e| e.to_string())?;
    }
    if let Some(v) = &notes {
        sqlx::query("UPDATE experiment_records SET notes = ?, updated_at = ? WHERE id = ?")
            .bind(v)
            .bind(&ts)
            .bind(&id)
            .execute(&state.db)
            .await
            .map_err(|e| e.to_string())?;
    }
    if let Some(v) = &linked_submission_id {
        let val: Option<&str> = if v.is_empty() { None } else { Some(v) };
        sqlx::query(
            "UPDATE experiment_records SET linked_submission_id = ?, updated_at = ? WHERE id = ?",
        )
        .bind(val)
        .bind(&ts)
        .bind(&id)
        .execute(&state.db)
        .await
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn experiment_delete(state: State<'_, AppState>, id: String) -> Result<(), String> {
    sqlx::query("DELETE FROM experiment_records WHERE id = ?")
        .bind(&id)
        .execute(&state.db)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ── Attachment helpers ───────────────────────────────────────────

fn managed_attachments_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let dir = data_dir.join("experiment_attachments");
    std::fs::create_dir_all(&dir).map_err(|e| format!("无法创建附件目录：{e}"))?;
    Ok(dir)
}

fn file_to_data_url(file_path: &str) -> Option<String> {
    let data = std::fs::read(file_path).ok()?;
    let b64 = general_purpose::STANDARD.encode(&data);
    let ext = Path::new(file_path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("png")
        .to_lowercase();
    let mime = match ext.as_str() {
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        _ => "image/png",
    };
    Some(format!("data:{mime};base64,{b64}"))
}

#[tauri::command]
pub async fn experiment_add_attachment(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    experiment_id: String,
    file_path: String,
    label: Option<String>,
) -> Result<serde_json::Value, String> {
    let src = PathBuf::from(&file_path);
    if !src.exists() {
        return Err(format!("文件不存在：{file_path}"));
    }

    // Copy into managed directory with a unique name
    let ext = src.extension().and_then(|e| e.to_str()).unwrap_or("png");
    let id = Uuid::new_v4().to_string();
    let dest_dir = managed_attachments_dir(&app)?;
    let dest = dest_dir.join(format!("{id}.{ext}"));
    std::fs::copy(&src, &dest).map_err(|e| format!("复制文件失败：{e}"))?;
    let dest_str = dest.to_string_lossy().to_string();

    let ts = now();
    let label_val = label.as_deref().unwrap_or("");
    sqlx::query(
        "INSERT INTO experiment_attachments (id, experiment_id, file_path, label, created_at)
         VALUES (?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&experiment_id)
    .bind(&dest_str)
    .bind(label_val)
    .bind(&ts)
    .execute(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    let data_url = file_to_data_url(&dest_str).unwrap_or_default();
    Ok(json!({
        "id": id,
        "experimentId": experiment_id,
        "filePath": dest_str,
        "label": label_val,
        "dataUrl": data_url,
        "createdAt": ts,
    }))
}

#[tauri::command]
pub async fn experiment_list_attachments(
    state: State<'_, AppState>,
    experiment_id: String,
) -> Result<serde_json::Value, String> {
    let rows = sqlx::query(
        "SELECT id, experiment_id, file_path, label, created_at
         FROM experiment_attachments WHERE experiment_id = ? ORDER BY created_at ASC",
    )
    .bind(&experiment_id)
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    let items: Vec<serde_json::Value> = rows
        .iter()
        .map(|row| {
            let file_path: String = row.get("file_path");
            let data_url = file_to_data_url(&file_path).unwrap_or_default();
            json!({
                "id": row.get::<String, _>("id"),
                "experimentId": row.get::<String, _>("experiment_id"),
                "filePath": file_path,
                "label": row.get::<String, _>("label"),
                "dataUrl": data_url,
                "createdAt": row.get::<String, _>("created_at"),
            })
        })
        .collect();

    Ok(json!({ "attachments": items }))
}

#[tauri::command]
pub async fn experiment_delete_attachment(
    _app: tauri::AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    // Read file path before deletion
    let row = sqlx::query("SELECT file_path FROM experiment_attachments WHERE id = ?")
        .bind(&id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| e.to_string())?;

    sqlx::query("DELETE FROM experiment_attachments WHERE id = ?")
        .bind(&id)
        .execute(&state.db)
        .await
        .map_err(|e| e.to_string())?;

    // Best-effort delete the managed file
    if let Some(row) = row {
        let fp: String = row.get("file_path");
        let _ = std::fs::remove_file(&fp);
    }

    Ok(())
}

#[tauri::command]
pub async fn experiment_update_attachment_label(
    state: State<'_, AppState>,
    id: String,
    label: String,
) -> Result<(), String> {
    sqlx::query("UPDATE experiment_attachments SET label = ? WHERE id = ?")
        .bind(label.trim())
        .bind(&id)
        .execute(&state.db)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

// ── Snapshot helpers ───────────────────────────────────────────

fn parse_json_snapshot(raw: String) -> serde_json::Value {
    serde_json::from_str(&raw).unwrap_or_else(|_| json!({}))
}

#[tauri::command]
pub async fn experiment_create_snapshot(
    state: State<'_, AppState>,
    experiment_id: String,
    title: Option<String>,
    code_session_id: Option<String>,
    tool_id: Option<String>,
    model: Option<String>,
    working_dir: Option<String>,
) -> Result<serde_json::Value, String> {
    let row = sqlx::query(
        "SELECT config, result, notes FROM experiment_records WHERE id = ?",
    )
    .bind(&experiment_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    let (config_raw, result, notes) = match row {
        Some(row) => {
            let config: String = row.get("config");
            let result: String = row.get("result");
            let notes: String = row.get("notes");
            (config, result, notes)
        }
        None => return Err("实验记录不存在".into()),
    };

    let id = Uuid::new_v4().to_string();
    let ts = now();
    let title_val = title.as_deref().unwrap_or("快照");

    sqlx::query(
        "INSERT INTO experiment_snapshots
         (id, experiment_id, title, config_snapshot, result_snapshot, notes_snapshot,
          code_session_id, tool_id, model, working_dir, env_snapshot, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&experiment_id)
    .bind(title_val)
    .bind(&config_raw)
    .bind(&result)
    .bind(&notes)
    .bind(code_session_id.as_deref())
    .bind(tool_id.as_deref())
    .bind(model.as_deref())
    .bind(working_dir.as_deref())
    .bind("{}")
    .bind(&ts)
    .execute(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    let config_json = parse_json_snapshot(config_raw);

    Ok(json!({
        "id": id,
        "experimentId": experiment_id,
        "title": title_val,
        "configSnapshot": config_json,
        "resultSnapshot": result,
        "notesSnapshot": notes,
        "codeSessionId": code_session_id,
        "toolId": tool_id,
        "model": model,
        "workingDir": working_dir,
        "envSnapshot": {},
        "createdAt": ts,
    }))
}

#[tauri::command]
pub async fn experiment_list_snapshots(
    state: State<'_, AppState>,
    experiment_id: String,
) -> Result<serde_json::Value, String> {
    let rows = sqlx::query(
        "SELECT id, experiment_id, title, config_snapshot, result_snapshot, notes_snapshot,
                code_session_id, tool_id, model, working_dir, env_snapshot, created_at
         FROM experiment_snapshots WHERE experiment_id = ? ORDER BY created_at DESC",
    )
    .bind(&experiment_id)
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    let items: Vec<serde_json::Value> = rows
        .iter()
        .map(|row| {
            let config_raw: String = row.get("config_snapshot");
            let env_raw: String = row.get("env_snapshot");
            json!({
                "id": row.get::<String, _>("id"),
                "experimentId": row.get::<String, _>("experiment_id"),
                "title": row.get::<String, _>("title"),
                "configSnapshot": parse_json_snapshot(config_raw),
                "resultSnapshot": row.get::<String, _>("result_snapshot"),
                "notesSnapshot": row.get::<String, _>("notes_snapshot"),
                "codeSessionId": row.get::<Option<String>, _>("code_session_id"),
                "toolId": row.get::<Option<String>, _>("tool_id"),
                "model": row.get::<Option<String>, _>("model"),
                "workingDir": row.get::<Option<String>, _>("working_dir"),
                "envSnapshot": parse_json_snapshot(env_raw),
                "createdAt": row.get::<String, _>("created_at"),
            })
        })
        .collect();

    Ok(json!({ "snapshots": items }))
}

#[tauri::command]
pub async fn experiment_get_snapshot(
    state: State<'_, AppState>,
    snapshot_id: String,
) -> Result<serde_json::Value, String> {
    let row = sqlx::query(
        "SELECT id, experiment_id, title, config_snapshot, result_snapshot, notes_snapshot,
                code_session_id, tool_id, model, working_dir, env_snapshot, created_at
         FROM experiment_snapshots WHERE id = ?",
    )
    .bind(&snapshot_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    match row {
        Some(row) => {
            let config_raw: String = row.get("config_snapshot");
            let env_raw: String = row.get("env_snapshot");
            Ok(json!({
                "id": row.get::<String, _>("id"),
                "experimentId": row.get::<String, _>("experiment_id"),
                "title": row.get::<String, _>("title"),
                "configSnapshot": parse_json_snapshot(config_raw),
                "resultSnapshot": row.get::<String, _>("result_snapshot"),
                "notesSnapshot": row.get::<String, _>("notes_snapshot"),
                "codeSessionId": row.get::<Option<String>, _>("code_session_id"),
                "toolId": row.get::<Option<String>, _>("tool_id"),
                "model": row.get::<Option<String>, _>("model"),
                "workingDir": row.get::<Option<String>, _>("working_dir"),
                "envSnapshot": parse_json_snapshot(env_raw),
                "createdAt": row.get::<String, _>("created_at"),
            }))
        }
        None => Err("快照不存在".into()),
    }
}

#[tauri::command]
pub async fn experiment_delete_snapshot(
    state: State<'_, AppState>,
    snapshot_id: String,
) -> Result<(), String> {
    sqlx::query("DELETE FROM experiment_snapshots WHERE id = ?")
        .bind(&snapshot_id)
        .execute(&state.db)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn experiment_restore_snapshot(
    state: State<'_, AppState>,
    snapshot_id: String,
) -> Result<serde_json::Value, String> {
    let row = sqlx::query(
        "SELECT experiment_id, config_snapshot, result_snapshot, notes_snapshot
         FROM experiment_snapshots WHERE id = ?",
    )
    .bind(&snapshot_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    let (experiment_id, config_snapshot, result_snapshot, notes_snapshot) = match row {
        Some(row) => {
            let experiment_id: String = row.get("experiment_id");
            let config_raw: String = row.get("config_snapshot");
            let result: String = row.get("result_snapshot");
            let notes: String = row.get("notes_snapshot");
            (experiment_id, config_raw, result, notes)
        }
        None => return Err("快照不存在".into()),
    };

    let ts = now();
    sqlx::query(
        "UPDATE experiment_records
         SET config = ?, result = ?, notes = ?, updated_at = ?
         WHERE id = ?",
    )
    .bind(&config_snapshot)
    .bind(&result_snapshot)
    .bind(&notes_snapshot)
    .bind(&ts)
    .bind(&experiment_id)
    .execute(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    Ok(json!({
        "experimentId": experiment_id,
        "restoredAt": ts,
    }))
}
