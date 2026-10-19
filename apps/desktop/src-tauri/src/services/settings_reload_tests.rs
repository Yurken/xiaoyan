use super::reload_exposed_settings;
use crate::state::default_settings;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::SqlitePool;
use std::collections::HashMap;
use tokio::sync::RwLock;

async fn database() -> SqlitePool {
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(SqliteConnectOptions::new().in_memory(true))
        .await
        .expect("isolated synthetic database");
    sqlx::raw_sql("CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);")
        .execute(&pool).await.expect("create synthetic table");
    pool
}

fn stale_cache() -> HashMap<String, String> {
    HashMap::from([
        ("llm_provider".into(), "stale-provider".into()),
        ("openai_api_key".into(), "synthetic-stale-secret".into()),
        ("cache_only".into(), "must-be-removed".into()),
    ])
}

async fn stored_settings(pool: &SqlitePool) -> HashMap<String, String> {
    sqlx::query_as::<_, (String, String)>("SELECT key, value FROM settings")
        .fetch_all(pool).await.expect("read synthetic rows")
        .into_iter().collect()
}

#[tokio::test]
async fn reload_uses_database_and_replaces_stale_cache_without_persisting_defaults() {
    let pool = database().await;
    sqlx::raw_sql(
        "INSERT INTO settings VALUES ('llm_provider', 'database-provider');
         INSERT INTO settings VALUES ('plugin.synthetic.unknown', 'raw-unknown-value');",
    ).execute(&pool).await.expect("seed authoritative settings");
    let before = stored_settings(&pool).await;
    let settings = RwLock::new(stale_cache());

    let exposed = reload_exposed_settings(&pool, &settings).await.expect("reload");

    assert_eq!(exposed.get("llm_provider").map(String::as_str), Some("database-provider"));
    assert!(!exposed.contains_key("plugin.synthetic.unknown"));
    let cache = settings.read().await.clone();
    assert_eq!(cache.get("llm_provider").map(String::as_str), Some("database-provider"));
    assert_eq!(cache.get("plugin.synthetic.unknown").map(String::as_str), Some("raw-unknown-value"));
    assert!(!cache.contains_key("cache_only"));
    assert_eq!(cache.get("openai_api_key").map(String::as_str), Some(""));
    assert_eq!(stored_settings(&pool).await, before);
}

#[tokio::test]
async fn reload_masks_response_secrets_and_preserves_raw_empty_and_whitespace_values() {
    let pool = database().await;
    sqlx::raw_sql(
        "INSERT INTO settings VALUES ('openai_api_key', 'synthetic-current-secret');
         INSERT INTO settings VALUES ('anthropic_api_key', '');
         INSERT INTO settings VALUES ('openai_base_url', '');
         INSERT INTO settings VALUES ('llm_provider', '  raw-provider  ');",
    ).execute(&pool).await.expect("seed raw settings");
    let settings = RwLock::new(stale_cache());

    let exposed = reload_exposed_settings(&pool, &settings).await.expect("reload");

    assert_eq!(exposed.get("openai_api_key").map(String::as_str), Some("***"));
    assert_eq!(exposed.get("anthropic_api_key").map(String::as_str), Some(""));
    assert_eq!(exposed.get("openai_base_url").map(String::as_str), Some(""));
    assert_eq!(exposed.get("llm_provider").map(String::as_str), Some("  raw-provider  "));
    let cache = settings.read().await;
    assert_eq!(cache.get("openai_api_key").map(String::as_str), Some("synthetic-current-secret"));
    assert_eq!(cache.get("anthropic_api_key").map(String::as_str), Some(""));
    assert_eq!(cache.get("openai_base_url").map(String::as_str), Some(""));
    assert_eq!(cache.get("llm_provider").map(String::as_str), Some("  raw-provider  "));
}

#[tokio::test]
async fn reload_empty_database_replaces_cache_with_defaults_without_writing_database() {
    let pool = database().await;
    let settings = RwLock::new(stale_cache());

    let exposed = reload_exposed_settings(&pool, &settings).await.expect("reload");

    assert_eq!(*settings.read().await, default_settings());
    assert!(!exposed.contains_key("cache_only"));
    assert_eq!(exposed.get("llm_provider").map(String::as_str), Some("openai_compatible"));
    assert_eq!(exposed.get("openai_api_key").map(String::as_str), Some(""));
    assert_eq!(exposed.len(), default_settings().len());
    assert!(stored_settings(&pool).await.is_empty());
}

#[tokio::test]
async fn failed_query_preserves_cache_and_retry_does_not_repeat_import() {
    let pool = database().await;
    sqlx::query("DROP TABLE settings")
        .execute(&pool).await.expect("make query fail");
    let original = stale_cache();
    let settings = RwLock::new(original.clone());

    reload_exposed_settings(&pool, &settings).await.expect_err("must query database");

    assert_eq!(*settings.read().await, original);
    sqlx::raw_sql(
        "CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
         INSERT INTO settings VALUES ('llm_provider', 'repaired-provider');",
    ).execute(&pool).await.expect("repair synthetic table");

    let exposed = reload_exposed_settings(&pool, &settings).await.expect("retry");

    assert_eq!(exposed.get("llm_provider").map(String::as_str), Some("repaired-provider"));
    assert_eq!(settings.read().await.get("llm_provider").map(String::as_str), Some("repaired-provider"));
    assert!(!settings.read().await.contains_key("cache_only"));
}

#[test]
fn cached_projection_preserves_get_defaults_masking_and_exposed_key_filter() {
    let cache = stale_cache();
    let before = cache.clone();

    let exposed = super::expose_settings(&cache);

    assert_eq!(
        exposed.get("llm_provider").map(String::as_str),
        Some("stale-provider")
    );
    assert_eq!(
        exposed.get("openai_api_key").map(String::as_str),
        Some("***")
    );
    assert_eq!(
        exposed.get("openai_base_url"),
        default_settings().get("openai_base_url")
    );
    assert!(!exposed.contains_key("cache_only"));
    assert_eq!(exposed.len(), default_settings().len());
    assert_eq!(cache, before);
}
