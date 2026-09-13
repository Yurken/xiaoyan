use super::note_attachment_service::NoteAttachmentService;
use crate::services::desktop_assistant::CleanupService;
use base64::Engine;
use sqlx::SqlitePool;
use uuid::Uuid;

async fn setup() -> (SqlitePool, std::path::PathBuf) {
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
    let directory =
        std::env::temp_dir().join(format!("xiaoyan-note-attachment-{}", Uuid::new_v4()));
    std::fs::create_dir_all(&directory).unwrap();
    (pool, directory)
}

fn png_data_url() -> String {
    format!(
        "data:image/png;base64,{}",
        base64::engine::general_purpose::STANDARD
            .encode([0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A])
    )
}

#[tokio::test]
async fn deleting_note_removes_managed_screenshot_and_provenance() {
    let (pool, directory) = setup().await;
    let note_id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO knowledge_notes (id, title, content, source_type, created_at, updated_at)
         VALUES (?, '截图笔记', '结论', 'assistant', datetime('now'), datetime('now'))",
    )
    .bind(&note_id)
    .execute(&pool)
    .await
    .unwrap();
    sqlx::query(
        "INSERT INTO assistant_imports (id, session_id, target, target_id, created_at)
         VALUES (?, 'session-1', 'note', ?, datetime('now'))",
    )
    .bind(Uuid::new_v4().to_string())
    .bind(&note_id)
    .execute(&pool)
    .await
    .unwrap();
    let attachment =
        NoteAttachmentService::store_screenshot(&pool, &directory, &note_id, &png_data_url())
            .await
            .unwrap();
    let path = directory
        .join("assistant_note_attachments")
        .join(&attachment.relative_path);
    assert!(path.is_file());

    let title = NoteAttachmentService::delete_note_with_attachments(&pool, &directory, &note_id)
        .await
        .unwrap();
    assert_eq!(title, "截图笔记");
    assert!(!path.exists());
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM knowledge_notes")
            .fetch_one(&pool)
            .await
            .unwrap(),
        0
    );
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM assistant_imports")
            .fetch_one(&pool)
            .await
            .unwrap(),
        0
    );
    std::fs::remove_dir_all(directory).unwrap();
}

#[tokio::test]
async fn unsafe_attachment_path_aborts_without_deleting_note_or_external_file() {
    let (pool, directory) = setup().await;
    let note_id = Uuid::new_v4().to_string();
    let victim = directory.join("victim.png");
    std::fs::write(&victim, b"keep").unwrap();
    sqlx::query(
        "INSERT INTO knowledge_notes (id, title, content, source_type, created_at, updated_at)
         VALUES (?, '安全检查', '结论', 'assistant', datetime('now'), datetime('now'))",
    )
    .bind(&note_id)
    .execute(&pool)
    .await
    .unwrap();
    sqlx::query(
        "INSERT INTO assistant_note_attachments (
            id, note_id, kind, relative_path, media_type, size_bytes, created_at
         ) VALUES (?, ?, 'screenshot', '../victim.png', 'image/png', 4, datetime('now'))",
    )
    .bind(Uuid::new_v4().to_string())
    .bind(&note_id)
    .execute(&pool)
    .await
    .unwrap();

    assert!(
        NoteAttachmentService::delete_note_with_attachments(&pool, &directory, &note_id)
            .await
            .is_err()
    );
    assert!(victim.is_file());
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM knowledge_notes")
            .fetch_one(&pool)
            .await
            .unwrap(),
        1
    );
    std::fs::remove_dir_all(directory).unwrap();
}
