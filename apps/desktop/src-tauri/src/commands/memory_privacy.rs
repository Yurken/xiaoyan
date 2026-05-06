use crate::services::memory_privacy_service::{self, MemoryPrivacyStatus};
use crate::state::AppState;
use serde_json::json;
use sqlx::Row;
use tauri::State;

fn normalized_limit(limit: Option<i64>, default: i64, max: i64) -> i64 {
    limit.unwrap_or(default).clamp(1, max)
}

#[tauri::command]
pub async fn memory_privacy_status(
    state: State<'_, AppState>,
) -> Result<MemoryPrivacyStatus, String> {
    Ok(memory_privacy_service::status(state.inner()).await)
}

#[tauri::command]
pub async fn memory_privacy_set_password(
    state: State<'_, AppState>,
    password: String,
) -> Result<MemoryPrivacyStatus, String> {
    memory_privacy_service::set_password(state.inner(), &password).await
}

#[tauri::command]
pub async fn memory_privacy_clear_password(
    state: State<'_, AppState>,
) -> Result<MemoryPrivacyStatus, String> {
    memory_privacy_service::clear_password(state.inner()).await
}

#[tauri::command]
pub async fn memory_privacy_verify_password(
    state: State<'_, AppState>,
    password: String,
) -> Result<bool, String> {
    memory_privacy_service::verify_password(state.inner(), &password).await
}

#[tauri::command]
pub async fn memory_list_manual_records(
    state: State<'_, AppState>,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<serde_json::Value, String> {
    let lim = normalized_limit(limit, 100, 200);
    let off = offset.unwrap_or(0).max(0);
    let rows = sqlx::query(
        "SELECT id, type, action, summary, detail, created_at
         FROM user_memories WHERE type = 'manual'
         ORDER BY created_at DESC LIMIT ? OFFSET ?",
    )
    .bind(lim)
    .bind(off)
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    let items: Vec<serde_json::Value> = rows
        .iter()
        .map(|row| {
            json!({
                "id": row.get::<String, _>("id"),
                "type": row.get::<String, _>("type"),
                "action": row.get::<Option<String>, _>("action"),
                "summary": row.get::<String, _>("summary"),
                "detail": row.get::<Option<String>, _>("detail"),
                "created_at": row.get::<String, _>("created_at"),
            })
        })
        .collect();

    Ok(json!(items))
}

#[tauri::command]
pub async fn memory_list_auto_records(
    state: State<'_, AppState>,
    password: Option<String>,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<serde_json::Value, String> {
    memory_privacy_service::ensure_detail_access(state.inner(), password.as_deref()).await?;

    let lim = normalized_limit(limit, 100, 200);
    let off = offset.unwrap_or(0).max(0);
    let rows = sqlx::query(
        "SELECT id, type, action, summary, detail, created_at
         FROM user_memories WHERE type = 'auto'
         ORDER BY created_at DESC LIMIT ? OFFSET ?",
    )
    .bind(lim)
    .bind(off)
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    let items: Vec<serde_json::Value> = rows
        .iter()
        .map(|row| {
            json!({
                "id": row.get::<String, _>("id"),
                "type": row.get::<String, _>("type"),
                "action": row.get::<Option<String>, _>("action"),
                "summary": row.get::<String, _>("summary"),
                "detail": row.get::<Option<String>, _>("detail"),
                "created_at": row.get::<String, _>("created_at"),
            })
        })
        .collect();

    Ok(json!(items))
}

#[tauri::command]
pub async fn memory_list_private_observations(
    state: State<'_, AppState>,
    password: Option<String>,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<serde_json::Value, String> {
    memory_privacy_service::ensure_detail_access(state.inner(), password.as_deref()).await?;

    let lim = normalized_limit(limit, 50, 100);
    let off = offset.unwrap_or(0).max(0);
    let rows = sqlx::query(
        "SELECT id, event_id, session_id, run_id, source, event_type, title, summary, narrative, importance, created_at
         FROM memory_observations
         ORDER BY created_at DESC LIMIT ? OFFSET ?",
    )
    .bind(lim)
    .bind(off)
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    let items: Vec<serde_json::Value> = rows
        .iter()
        .map(|row| {
            json!({
                "id": row.get::<String, _>("id"),
                "event_id": row.get::<String, _>("event_id"),
                "session_id": row.get::<Option<String>, _>("session_id"),
                "run_id": row.get::<Option<String>, _>("run_id"),
                "source": row.get::<String, _>("source"),
                "event_type": row.get::<String, _>("event_type"),
                "title": row.get::<String, _>("title"),
                "summary": row.get::<String, _>("summary"),
                "narrative": row.get::<String, _>("narrative"),
                "importance": row.get::<i64, _>("importance"),
                "created_at": row.get::<String, _>("created_at"),
            })
        })
        .collect();

    Ok(json!(items))
}
