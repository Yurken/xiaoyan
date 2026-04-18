use crate::journal_partitions;
use serde_json::json;
use std::collections::HashSet;

#[tauri::command]
pub async fn journal_lookup(
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
        "matches": journal_partitions::lookup(trimmed, limit.unwrap_or(8)),
    }))
}

/// Filter journal titles by wos_category keywords and one or more rank criteria.
/// Returns deduplicated titles sorted by quality, capped at 150 per rank tier.
#[tauri::command]
pub async fn journal_rank_filter(wos_cat_keywords: Vec<String>, ranks: Vec<String>) -> Vec<String> {
    let mut seen: HashSet<String> = HashSet::new();
    let mut results: Vec<String> = Vec::new();
    for rank in &ranks {
        for title in journal_partitions::filter_by_rank(&wos_cat_keywords, rank, 150) {
            let key = title.to_lowercase();
            if seen.insert(key) {
                results.push(title);
            }
        }
    }
    results
}
