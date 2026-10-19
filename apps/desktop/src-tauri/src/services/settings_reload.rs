use crate::repositories::settings_repository::load_all_settings;
use crate::services::settings_service::MASK;
use crate::state::{default_settings, SENSITIVE_KEYS};
use sqlx::SqlitePool;
use std::collections::HashMap;
use tokio::sync::RwLock;

/// Project the internal raw cache through the existing settings API contract.
pub(crate) fn expose_settings(cache: &HashMap<String, String>) -> HashMap<String, String> {
    let defaults = default_settings();
    let mut result = HashMap::new();
    for (key, default) in &defaults {
        let value = cache.get(key).map(String::as_str).unwrap_or(default);
        let exposed = if SENSITIVE_KEYS.contains(&key.as_str()) && !value.is_empty() {
            MASK.to_string()
        } else {
            value.to_string()
        };
        result.insert(key.clone(), exposed);
    }
    result
}

/// Reconcile the cache with committed database settings without changing the DB.
/// A failed database read leaves the entire cache untouched. The response uses
/// the same exposed keys and masking as settings_get, never the raw cache.
pub(crate) async fn reload_exposed_settings(
    pool: &SqlitePool,
    settings: &RwLock<HashMap<String, String>>,
) -> Result<HashMap<String, String>, String> {
    let raw_settings = load_all_settings(pool).await?;
    let mut refreshed = default_settings();
    refreshed.extend(raw_settings);

    let mut cache = settings.write().await;
    *cache = refreshed;
    Ok(expose_settings(&cache))
}

#[cfg(test)]
#[path = "settings_reload_tests.rs"]
mod tests;
