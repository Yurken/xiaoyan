use super::*;

#[tokio::test]
async fn runtime_defaults_disabled_and_preserves_explicit_choices() {
    let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
    sqlx::query("CREATE TABLE assistant_preferences (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT (datetime('now')))")
        .execute(&pool).await.unwrap();
    let defaults = AssistantPreferenceService::load_runtime(&pool)
        .await
        .unwrap();
    assert!(!defaults.enabled);
    assert!(!defaults.diagnostic_logging_enabled);

    for enabled in [true, false] {
        let saved = AssistantPreferenceService::save_runtime(&pool, enabled, true)
            .await
            .unwrap();
        assert_eq!(saved.enabled, enabled);
        assert!(saved.diagnostic_logging_enabled);
        assert_eq!(
            AssistantPreferenceService::load_runtime(&pool)
                .await
                .unwrap(),
            saved
        );
    }

    sqlx::query("UPDATE assistant_preferences SET value = 'invalid' WHERE key = ?")
        .bind(ASSISTANT_ENABLED_KEY)
        .execute(&pool)
        .await
        .unwrap();
    assert!(
        !AssistantPreferenceService::load_runtime(&pool)
            .await
            .unwrap()
            .enabled
    );
}
