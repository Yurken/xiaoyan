use crate::services::source_service;

#[tauri::command]
pub async fn source_lookup(
    query: String,
    limit: Option<usize>,
) -> Result<serde_json::Value, String> {
    Ok(source_service::lookup_sources(&query, limit))
}
