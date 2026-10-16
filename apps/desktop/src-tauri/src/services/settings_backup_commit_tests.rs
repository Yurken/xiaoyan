use super::commit_restored_settings;
use crate::state::default_settings;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::SqlitePool;
use std::collections::HashMap;
use tokio::sync::RwLock;

async fn database() -> SqlitePool {
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(
            SqliteConnectOptions::new()
                .in_memory(true)
                .foreign_keys(true),
        )
        .await
        .expect("isolated single-connection memory database");
    sqlx::raw_sql(
        "CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
         CREATE TABLE restore_markers (id INTEGER PRIMARY KEY, value TEXT NOT NULL);
         INSERT INTO restore_markers VALUES (1, 'original');",
    )
    .execute(&pool)
    .await
    .expect("create synthetic schema");
    pool
}

fn original_cache() -> HashMap<String, String> {
    HashMap::from([
        ("llm_provider".to_string(), "original-provider".to_string()),
        ("obsolete_cache_only".to_string(), "must-not-survive".to_string()),
        ("openai_api_key".to_string(), "synthetic-old-secret".to_string()),
    ])
}

async fn stored_settings(pool: &SqlitePool) -> HashMap<String, String> {
    sqlx::query_as::<_, (String, String)>("SELECT key, value FROM settings")
        .fetch_all(pool)
        .await
        .expect("read committed synthetic settings")
        .into_iter()
        .collect()
}

async fn marker(pool: &SqlitePool) -> String {
    sqlx::query_scalar("SELECT value FROM restore_markers WHERE id = 1")
        .fetch_one(pool)
        .await
        .expect("read synthetic transaction marker")
}

#[tokio::test]
async fn successful_commit_replaces_cache_with_defaults_and_every_raw_setting() {
    let pool = database().await;
    let settings = RwLock::new(original_cache());
    let raw = HashMap::from([
        ("llm_provider".to_string(), "  synthetic-provider  ".to_string()),
        ("openai_api_key".to_string(), "synthetic-restored-secret".to_string()),
        ("openai_base_url".to_string(), String::new()),
        (
            "plugin.synthetic.extra_setting".to_string(),
            "{\"enabled\":true}".to_string(),
        ),
    ]);
    let mut tx = pool.begin().await.expect("begin restore");
    for (key, value) in &raw {
        sqlx::query("INSERT INTO settings (key, value) VALUES (?, ?)")
            .bind(key)
            .bind(value)
            .execute(&mut *tx)
            .await
            .expect("insert synthetic raw settings");
    }

    commit_restored_settings(tx, &settings)
        .await
        .expect("commit and publish restored settings");

    let cache = settings.read().await.clone();
    let mut expected = default_settings();
    expected.extend(raw.clone());
    assert_eq!(cache, expected);
    assert!(!cache.contains_key("obsolete_cache_only"));
    assert_eq!(cache.get("openai_api_key"), raw.get("openai_api_key"));
    assert_eq!(cache.get("openai_base_url").map(String::as_str), Some(""));
    assert_eq!(
        cache.get("llm_provider").map(String::as_str),
        Some("  synthetic-provider  ")
    );
    // Defaults fill only the cache: preserve the raw restored database exactly.
    assert_eq!(stored_settings(&pool).await, raw);
}

#[tokio::test]
async fn cache_uses_the_final_uncommitted_rows_from_the_restoring_transaction() {
    let pool = database().await;
    sqlx::query("INSERT INTO settings VALUES ('llm_provider', 'database-before-restore')")
        .execute(&pool)
        .await
        .expect("seed pre-restore database");
    let settings = RwLock::new(original_cache());
    let mut tx = pool.begin().await.expect("begin restore");
    sqlx::raw_sql(
        "DELETE FROM settings;
         INSERT INTO settings VALUES ('llm_provider', 'intermediate-value');
         UPDATE settings SET value = 'final-restored-value' WHERE key = 'llm_provider';
         INSERT INTO settings VALUES ('transaction_only', 'not-yet-committed');
         UPDATE restore_markers SET value = 'restored' WHERE id = 1;",
    )
    .execute(&mut *tx)
    .await
    .expect("replace settings inside one transaction");

    commit_restored_settings(tx, &settings)
        .await
        .expect("read the same transaction and commit");

    let cache = settings.read().await.clone();
    assert_eq!(
        cache.get("llm_provider").map(String::as_str),
        Some("final-restored-value")
    );
    assert_eq!(
        cache.get("transaction_only").map(String::as_str),
        Some("not-yet-committed")
    );
    assert_eq!(
        stored_settings(&pool).await,
        HashMap::from([
            ("llm_provider".to_string(), "final-restored-value".to_string()),
            ("transaction_only".to_string(), "not-yet-committed".to_string()),
        ])
    );
    assert_eq!(marker(&pool).await, "restored");
}

#[tokio::test]
async fn settings_query_failure_leaves_cache_unchanged_and_rolls_back_transaction() {
    let pool = database().await;
    sqlx::query("INSERT INTO settings VALUES ('llm_provider', 'database-before-restore')")
        .execute(&pool)
        .await
        .expect("seed original setting");
    let original_database = stored_settings(&pool).await;
    let original = original_cache();
    let settings = RwLock::new(original.clone());
    let mut tx = pool.begin().await.expect("begin restore");
    sqlx::raw_sql(
        "UPDATE restore_markers SET value = 'must-rollback' WHERE id = 1;
         DROP TABLE settings;",
    )
    .execute(&mut *tx)
    .await
    .expect("make the final settings query fail inside the transaction");

    let error = commit_restored_settings(tx, &settings)
        .await
        .expect_err("settings read must succeed before commit");
    assert!(error.contains("读取恢复后的设置失败"), "{error}");
    assert!(error.contains("settings"), "{error}");
    assert_eq!(*settings.read().await, original);

    // Reacquiring the single connection observes sqlx's queued Drop rollback.
    // The table and an independent transaction change must both be restored.
    assert_eq!(stored_settings(&pool).await, original_database);
    assert_eq!(marker(&pool).await, "original");
}

#[tokio::test]
async fn deferred_foreign_key_commit_failure_does_not_publish_the_new_cache() {
    let pool = database().await;
    let foreign_keys: i64 = sqlx::query_scalar("PRAGMA foreign_keys")
        .fetch_one(&pool)
        .await
        .expect("read synthetic connection foreign-key mode");
    assert_eq!(foreign_keys, 1, "commit failure fixture requires enforcement");
    sqlx::raw_sql(
        "CREATE TABLE restore_parents (id INTEGER PRIMARY KEY);
         CREATE TABLE restore_children (
             id INTEGER PRIMARY KEY,
             parent_id INTEGER NOT NULL REFERENCES restore_parents(id)
                 DEFERRABLE INITIALLY DEFERRED
         );
         INSERT INTO settings VALUES ('llm_provider', 'database-before-restore');",
    )
    .execute(&pool)
    .await
    .expect("create deferred foreign-key fixture");
    let original_database = stored_settings(&pool).await;
    let original = original_cache();
    let settings = RwLock::new(original.clone());
    let mut tx = pool.begin().await.expect("begin restore");
    sqlx::raw_sql(
        "UPDATE settings SET value = 'must-not-enter-cache' WHERE key = 'llm_provider';
         UPDATE restore_markers SET value = 'must-rollback' WHERE id = 1;
         INSERT INTO restore_children VALUES (1, 999);",
    )
    .execute(&mut *tx)
    .await
    .expect("deferred constraint permits the insert until commit");

    let error = commit_restored_settings(tx, &settings)
        .await
        .expect_err("the deferred foreign-key violation must reject commit");
    assert!(error.contains("提交备份恢复失败"), "{error}");
    assert!(error.contains("FOREIGN KEY"), "{error}");
    assert_eq!(*settings.read().await, original);

    // This fixture proves rollback for this known deferred-constraint failure.
    // It does not generalize to every possible I/O failure or restored file.
    assert_eq!(stored_settings(&pool).await, original_database);
    assert_eq!(marker(&pool).await, "original");
    let children: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM restore_children")
        .fetch_one(&pool)
        .await
        .expect("read synthetic children after failed commit");
    assert_eq!(children, 0);
}

#[tokio::test]
async fn empty_restored_settings_publish_defaults_without_retaining_old_cache_entries() {
    let pool = database().await;
    sqlx::query("INSERT INTO settings VALUES ('old_database_key', 'old-value')")
        .execute(&pool)
        .await
        .expect("seed setting that the restore removes");
    let settings = RwLock::new(original_cache());
    let mut tx = pool.begin().await.expect("begin empty restore");
    sqlx::query("DELETE FROM settings")
        .execute(&mut *tx)
        .await
        .expect("restore an empty settings table");

    commit_restored_settings(tx, &settings)
        .await
        .expect("empty restored settings are valid");

    assert_eq!(*settings.read().await, default_settings());
    assert!(stored_settings(&pool).await.is_empty());
}
