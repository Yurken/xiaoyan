use crate::services::memory_checkpoint_service;
use crate::state::AppState;
use serde_json::Value;
use tauri::State;

#[tauri::command]
pub async fn memory_list_checkpoints(
    state: State<'_, AppState>,
    limit: Option<i64>,
) -> Result<Value, String> {
    memory_checkpoint_service::list_recent_checkpoints(&state.db, limit.unwrap_or(8))
        .await
        .map_err(|error| error.to_string())
}
