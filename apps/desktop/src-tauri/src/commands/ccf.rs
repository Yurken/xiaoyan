use crate::ccf;
use serde_json::json;

#[tauri::command]
pub async fn ccf_lookup(
    query: String,
    limit: Option<usize>,
) -> Result<serde_json::Value, String> {
    let trimmed = query.trim();
    if trimmed.is_empty() {
        return Ok(json!({
            "query": "",
            "matches": [],
        }));
    }

    Ok(json!({
        "query": trimmed,
        "matches": ccf::lookup(trimmed, limit.unwrap_or(8)),
    }))
}
