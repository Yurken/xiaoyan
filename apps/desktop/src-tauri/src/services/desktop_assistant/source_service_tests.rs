use super::source_service::AssistantSourceService;
use crate::services::desktop_assistant::CleanupService;
use sqlx::SqlitePool;
use uuid::Uuid;

async fn setup() -> (SqlitePool, String) {
    let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
    sqlx::query("CREATE TABLE research_interests (id TEXT PRIMARY KEY, topic TEXT NOT NULL)")
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query(
        "CREATE TABLE knowledge_notes (
            id TEXT PRIMARY KEY, title TEXT NOT NULL, content TEXT NOT NULL,
            source_type TEXT NOT NULL, source_id TEXT, tags TEXT NOT NULL DEFAULT '[]',
            research_interest_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
         )",
    )
    .execute(&pool)
    .await
    .unwrap();
    CleanupService::init_tables(&pool).await.unwrap();
    let note_id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO knowledge_notes (id, title, content, source_type, created_at, updated_at)
         VALUES (?, '来源测试', '内容', 'assistant', datetime('now'), datetime('now'))",
    )
    .bind(&note_id)
    .execute(&pool)
    .await
    .unwrap();
    sqlx::query(
        "INSERT INTO assistant_imports (
            id, session_id, target, target_id, source_type, source_app, window_title,
            captured_at, capture_region_width, capture_region_height, created_at
         ) VALUES (?, 'session-1', 'note', ?, 'screenshot', 'Preview', 'Figure 2',
                   datetime('now'), 1200, 800, datetime('now'))",
    )
    .bind(Uuid::new_v4().to_string())
    .bind(&note_id)
    .execute(&pool)
    .await
    .unwrap();
    (pool, note_id)
}

#[tokio::test]
async fn reads_region_and_updates_user_editable_source_fields() {
    let (pool, note_id) = setup().await;
    let source = AssistantSourceService::get(&pool, "note", &note_id)
        .await
        .unwrap()
        .unwrap();
    assert_eq!(source.source_app.as_deref(), Some("Preview"));
    assert_eq!(source.capture_region.unwrap().width, 1200);

    let updated = AssistantSourceService::update(
        &pool,
        "note",
        &note_id,
        Some(" Safari "),
        Some("Agent Paper"),
        Some("Figure 2 — Results"),
        Some("https://example.com/paper"),
    )
    .await
    .unwrap();
    assert_eq!(updated.source_app.as_deref(), Some("Safari"));
    assert_eq!(updated.source_title.as_deref(), Some("Figure 2 — Results"));
    assert_eq!(
        updated.source_url.as_deref(),
        Some("https://example.com/paper")
    );
}

#[tokio::test]
async fn rejects_unsafe_or_unknown_source_updates() {
    let (pool, note_id) = setup().await;
    assert!(AssistantSourceService::update(
        &pool,
        "note",
        &note_id,
        None,
        None,
        None,
        Some("javascript:alert(1)"),
    )
    .await
    .is_err());
    assert!(AssistantSourceService::get(&pool, "unknown", &note_id)
        .await
        .is_err());
}
