use super::*;
use sqlx::Row;

async fn test_pool() -> SqlitePool {
    let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
    for statement in [
        "CREATE TABLE research_interests (id TEXT PRIMARY KEY, name TEXT NOT NULL)",
        "CREATE TABLE knowledge_notes (id TEXT PRIMARY KEY, research_interest_id TEXT, title TEXT NOT NULL, content TEXT NOT NULL, tags TEXT NOT NULL, source_type TEXT NOT NULL, source_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)",
        "CREATE TABLE assistant_later_items (id TEXT PRIMARY KEY, title TEXT NOT NULL, content TEXT NOT NULL, session_id TEXT, research_interest_id TEXT, retention_policy TEXT, expires_at TEXT, status TEXT, created_at TEXT NOT NULL)",
        "CREATE TABLE assistant_capture_sessions (id TEXT PRIMARY KEY, source_type TEXT NOT NULL, content TEXT, screenshot_path TEXT, source_app TEXT, source_app_bundle_id TEXT, window_title TEXT, capture_region_x INTEGER, capture_region_y INTEGER, capture_region_width INTEGER, capture_region_height INTEGER, created_at TEXT NOT NULL, expires_at TEXT, status TEXT NOT NULL, user_confirmed INTEGER NOT NULL, confirmed_at TEXT, completed_at TEXT)",
        "CREATE TABLE assistant_imports (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, target TEXT NOT NULL, target_id TEXT, content_preview TEXT, source_type TEXT, source_app TEXT, source_app_bundle_id TEXT, window_title TEXT, captured_at TEXT, capture_region_x INTEGER, capture_region_y INTEGER, capture_region_width INTEGER, capture_region_height INTEGER, research_interest_id TEXT, preserve_original INTEGER, retention_policy TEXT, expires_at TEXT, storage_location TEXT, estimated_size_bytes INTEGER, created_at TEXT NOT NULL)",
        "CREATE TABLE assistant_note_attachments (id TEXT PRIMARY KEY, note_id TEXT NOT NULL, kind TEXT NOT NULL, relative_path TEXT NOT NULL, media_type TEXT NOT NULL, size_bytes INTEGER NOT NULL, created_at TEXT NOT NULL)",
        "CREATE TABLE assistant_paper_candidates (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, title TEXT NOT NULL, content_preview TEXT, status TEXT NOT NULL, created_at TEXT NOT NULL)",
    ] {
        sqlx::query(statement).execute(&pool).await.unwrap();
    }
    sqlx::query("INSERT INTO research_interests (id, name) VALUES ('theme-1', 'Graph RAG')")
        .execute(&pool)
        .await
        .unwrap();
    pool
}

async fn insert_confirmed_capture(pool: &SqlitePool, session_id: &str) {
    sqlx::query(
        "INSERT INTO assistant_capture_sessions (
            id, source_type, created_at, status, user_confirmed
         ) VALUES (?, 'paste', datetime('now'), 'confirmed', 1)",
    )
    .bind(session_id)
    .execute(pool)
    .await
    .unwrap();
}

fn options<'a>(
    title: Option<&'a str>,
    tags: Option<&'a [String]>,
    research_theme_id: Option<&'a str>,
) -> AssistantImportOptions<'a> {
    AssistantImportOptions {
        title,
        tags,
        research_theme_id,
        preserve_original: false,
        original_content: None,
        retention_policy: "permanent",
    }
}

#[test]
fn import_target_and_retention_policy_reject_unknown_values() {
    assert!(matches!("note".parse(), Ok(ImportTarget::Note)));
    assert!(matches!("image".parse(), Ok(ImportTarget::Image)));
    assert!("unknown".parse::<ImportTarget>().is_err());
    assert!(ImportRetentionPolicy::parse("forever-ish").is_err());
}

#[test]
fn image_import_uses_validated_mime_extension() {
    let directory = std::env::temp_dir().join(format!("xiaoyan-image-import-{}", Uuid::new_v4()));
    std::fs::create_dir_all(&directory).unwrap();

    for (media_type, bytes, extension) in [
        (
            "image/png",
            vec![0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A],
            "png",
        ),
        ("image/jpeg", vec![0xFF, 0xD8, 0xFF, 0xDB], "jpg"),
        (
            "image/webp",
            vec![b'R', b'I', b'F', b'F', 0, 0, 0, 0, b'W', b'E', b'B', b'P'],
            "webp",
        ),
    ] {
        let content = format!(
            "data:{media_type};base64,{}",
            base64::engine::general_purpose::STANDARD.encode(bytes)
        );
        let artifact =
            ImportService::import_as_image(&directory, "session-image", &content).unwrap();
        let path = directory
            .join("assistant_images")
            .join(format!("{}.{}", artifact.result.id, extension));
        assert!(path.is_file());
        assert!(artifact
            .storage_location
            .starts_with("app_data:assistant_images/"));
    }

    std::fs::remove_dir_all(directory).unwrap();
}

#[test]
fn image_import_rejects_mime_header_mismatch_without_writing_an_asset() {
    let directory = std::env::temp_dir().join(format!("xiaoyan-image-mismatch-{}", Uuid::new_v4()));
    std::fs::create_dir_all(&directory).unwrap();
    let content = format!(
        "data:image/png;base64,{}",
        base64::engine::general_purpose::STANDARD.encode([0xFF, 0xD8, 0xFF])
    );

    assert!(ImportService::import_as_image(&directory, "session-image", &content).is_err());
    assert!(!directory.join("assistant_images").exists());
    std::fs::remove_dir_all(directory).unwrap();
}

#[tokio::test]
async fn note_import_persists_theme_original_content_and_storage_confirmation() {
    let pool = test_pool().await;
    insert_confirmed_capture(&pool, "session-1").await;
    let tags = ["method".to_string(), "reading".to_string()];
    let mut import_options = options(Some("Imported note"), Some(&tags), Some("theme-1"));
    import_options.preserve_original = true;
    import_options.original_content = Some("Original paragraph");
    let result = ImportService::import(
        &pool,
        &std::env::temp_dir(),
        "session-1",
        "Translated result",
        "note",
        import_options,
    )
    .await
    .unwrap();
    let row = sqlx::query(
        "SELECT id, research_interest_id, content, tags, source_type, source_id
         FROM knowledge_notes",
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(row.get::<String, _>("id"), result.id);
    assert_eq!(row.get::<String, _>("research_interest_id"), "theme-1");
    assert!(row
        .get::<String, _>("content")
        .contains("Original paragraph"));
    assert_eq!(row.get::<String, _>("tags"), r#"["method","reading"]"#);
    assert_eq!(row.get::<String, _>("source_type"), "assistant");
    assert_eq!(row.get::<String, _>("source_id"), "session-1");

    let import = sqlx::query(
        "SELECT content_preview, research_interest_id, preserve_original,
                retention_policy, storage_location, estimated_size_bytes
         FROM assistant_imports",
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(import.get::<String, _>("content_preview"), "[text]");
    assert_eq!(import.get::<String, _>("research_interest_id"), "theme-1");
    assert_eq!(import.get::<i64, _>("preserve_original"), 1);
    assert_eq!(import.get::<String, _>("retention_policy"), "permanent");
    assert_eq!(
        import.get::<String, _>("storage_location"),
        "local_database:knowledge_notes"
    );
    assert!(import.get::<i64, _>("estimated_size_bytes") > 0);
}

#[tokio::test]
async fn note_import_truncates_content_to_fifty_thousand_characters() {
    let pool = test_pool().await;
    insert_confirmed_capture(&pool, "session-long-note").await;
    ImportService::import(
        &pool,
        &std::env::temp_dir(),
        "session-long-note",
        &"研".repeat(MAX_NOTE_TEXT_CHARS + 1),
        "note",
        options(Some("Long note"), None, None),
    )
    .await
    .unwrap();

    let content: String = sqlx::query_scalar("SELECT content FROM knowledge_notes")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(content.chars().count(), MAX_NOTE_TEXT_CHARS);
}

#[tokio::test]
async fn note_import_preserves_original_screenshot_as_managed_attachment() {
    let pool = test_pool().await;
    insert_confirmed_capture(&pool, "session-screenshot-note").await;
    sqlx::query(
        "UPDATE assistant_capture_sessions
         SET source_type = 'screenshot', capture_region_width = 1280, capture_region_height = 720
         WHERE id = 'session-screenshot-note'",
    )
    .execute(&pool)
    .await
    .unwrap();
    let directory =
        std::env::temp_dir().join(format!("xiaoyan-note-screenshot-{}", Uuid::new_v4()));
    std::fs::create_dir_all(&directory).unwrap();
    let screenshot = format!(
        "data:image/png;base64,{}",
        base64::engine::general_purpose::STANDARD
            .encode([0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A])
    );
    let mut import_options = options(Some("Chart result"), None, None);
    import_options.preserve_original = true;
    import_options.original_content = Some(&screenshot);
    let result = ImportService::import(
        &pool,
        &directory,
        "session-screenshot-note",
        "Chart interpretation",
        "note",
        import_options,
    )
    .await
    .unwrap();

    let attachment =
        sqlx::query("SELECT note_id, relative_path, media_type FROM assistant_note_attachments")
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(attachment.get::<String, _>("note_id"), result.id);
    assert_eq!(attachment.get::<String, _>("media_type"), "image/png");
    assert!(directory
        .join("assistant_note_attachments")
        .join(attachment.get::<String, _>("relative_path"))
        .is_file());
    let import = sqlx::query(
        "SELECT storage_location, capture_region_width, capture_region_height
         FROM assistant_imports WHERE target = 'note'",
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    assert!(import
        .get::<String, _>("storage_location")
        .contains("assistant_note_attachments/"));
    assert_eq!(import.get::<i64, _>("capture_region_width"), 1280);
    assert_eq!(import.get::<i64, _>("capture_region_height"), 720);
    std::fs::remove_dir_all(directory).unwrap();
}

#[tokio::test]
async fn later_import_persists_per_item_retention_and_theme() {
    let pool = test_pool().await;
    insert_confirmed_capture(&pool, "session-2").await;
    let mut import_options = options(None, None, Some("theme-1"));
    import_options.retention_policy = "7_days";
    let result = ImportService::import(
        &pool,
        &std::env::temp_dir(),
        "session-2",
        "Read this later",
        "later",
        import_options,
    )
    .await
    .unwrap();
    let row = sqlx::query(
        "SELECT id, research_interest_id, retention_policy, expires_at, status
         FROM assistant_later_items",
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(row.get::<String, _>("id"), result.id);
    assert_eq!(row.get::<String, _>("research_interest_id"), "theme-1");
    assert_eq!(row.get::<String, _>("retention_policy"), "7_days");
    assert!(row.get::<Option<String>, _>("expires_at").is_some());
    assert_eq!(row.get::<String, _>("status"), "pending");
}

#[tokio::test]
async fn import_rejects_missing_theme_and_target_policy_mismatch() {
    let pool = test_pool().await;
    insert_confirmed_capture(&pool, "session-invalid").await;
    assert!(ImportService::import(
        &pool,
        &std::env::temp_dir(),
        "session-invalid",
        "content",
        "note",
        options(None, None, Some("missing-theme")),
    )
    .await
    .is_err());

    let mut invalid_retention = options(None, None, None);
    invalid_retention.retention_policy = "7_days";
    assert!(ImportService::import(
        &pool,
        &std::env::temp_dir(),
        "session-invalid",
        "content",
        "note",
        invalid_retention,
    )
    .await
    .is_err());
}
