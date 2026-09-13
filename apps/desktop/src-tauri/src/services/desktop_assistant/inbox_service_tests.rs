use super::inbox_service::AssistantInboxService;
use crate::services::desktop_assistant::{
    file_candidate_service::FileCandidateService, CleanupService,
};
use sqlx::SqlitePool;
use uuid::Uuid;

async fn setup() -> SqlitePool {
    let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
    sqlx::query(
        "CREATE TABLE research_interests (
            id TEXT PRIMARY KEY, topic TEXT NOT NULL
         )",
    )
    .execute(&pool)
    .await
    .unwrap();
    sqlx::query(
        "CREATE TABLE knowledge_notes (
            id TEXT PRIMARY KEY, research_interest_id TEXT, title TEXT NOT NULL,
            content TEXT NOT NULL, source_type TEXT NOT NULL, source_id TEXT,
            tags TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
         )",
    )
    .execute(&pool)
    .await
    .unwrap();
    CleanupService::init_tables(&pool).await.unwrap();
    pool
}

#[tokio::test]
async fn lists_later_metadata_and_converts_item_to_a_traced_note() {
    let pool = setup().await;
    let theme_id = Uuid::new_v4().to_string();
    let session_id = Uuid::new_v4().to_string();
    let item_id = Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO research_interests (id, topic) VALUES (?, '可信 AI')")
        .bind(&theme_id)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query(
        "INSERT INTO assistant_capture_sessions (
            id, source_type, source_app, window_title, created_at, status, user_confirmed
         ) VALUES (?, 'selection', 'Safari', 'Paper', datetime('now'), 'ready', 1)",
    )
    .bind(&session_id)
    .execute(&pool)
    .await
    .unwrap();
    sqlx::query(
        "INSERT INTO assistant_later_items (
            id, title, content, session_id, research_interest_id, retention_policy,
            status, created_at
         ) VALUES (?, '待整理结论', '关键研究结论', ?, ?, 'manual', 'pending', datetime('now'))",
    )
    .bind(&item_id)
    .bind(&session_id)
    .bind(&theme_id)
    .execute(&pool)
    .await
    .unwrap();

    let overview = AssistantInboxService::list(&pool).await.unwrap();
    assert_eq!(overview.later_items.len(), 1);
    assert_eq!(
        overview.later_items[0].source_app.as_deref(),
        Some("Safari")
    );
    assert_eq!(
        overview.later_items[0].research_theme_name.as_deref(),
        Some("可信 AI")
    );

    let result = AssistantInboxService::convert_later_to_note(&pool, &item_id, None)
        .await
        .unwrap();
    assert_eq!(result.target, "note");
    let note: (String, String, String) = sqlx::query_as(
        "SELECT research_interest_id, source_type, source_id FROM knowledge_notes WHERE id = ?",
    )
    .bind(result.target_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(note.0, theme_id);
    assert_eq!(note.1, "assistant");
    assert_eq!(note.2, format!("later:{item_id}"));
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM assistant_later_items")
            .fetch_one(&pool)
            .await
            .unwrap(),
        0
    );
}

#[tokio::test]
async fn imports_confirmed_text_and_image_files_without_deleting_sources() {
    let pool = setup().await;
    let directory = std::env::temp_dir().join(format!("xiaoyan-inbox-{}", Uuid::new_v4()));
    let app_data = directory.join("app-data");
    std::fs::create_dir_all(&directory).unwrap();
    let text_path = directory.join("notes.md");
    let image_path = directory.join("figure.png");
    std::fs::write(&text_path, "# 可追溯研究笔记").unwrap();
    std::fs::write(
        &image_path,
        [0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A],
    )
    .unwrap();
    let inspection = FileCandidateService::inspect_and_create(
        &pool,
        vec![
            text_path.to_string_lossy().to_string(),
            image_path.to_string_lossy().to_string(),
        ],
    )
    .await
    .unwrap();
    FileCandidateService::confirm(
        &pool,
        inspection
            .candidates
            .iter()
            .map(|item| item.id.clone())
            .collect(),
    )
    .await
    .unwrap();

    let overview = AssistantInboxService::list(&pool).await.unwrap();
    assert_eq!(overview.file_candidates.len(), 2);
    let text =
        AssistantInboxService::import_file(&pool, &app_data, &inspection.candidates[0].id, None)
            .await
            .unwrap();
    let image =
        AssistantInboxService::import_file(&pool, &app_data, &inspection.candidates[1].id, None)
            .await
            .unwrap();
    assert_eq!(text.target, "note");
    assert_eq!(image.target, "image");
    assert!(text_path.exists());
    assert!(image_path.exists());
    assert!(app_data
        .join("assistant_images")
        .join(format!("{}.png", image.target_id))
        .exists());
    assert_eq!(
        sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM assistant_file_candidates WHERE status = 'imported'",
        )
        .fetch_one(&pool)
        .await
        .unwrap(),
        2
    );
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM assistant_imports")
            .fetch_one(&pool)
            .await
            .unwrap(),
        2
    );
    std::fs::remove_dir_all(directory).unwrap();
}

#[tokio::test]
async fn paper_candidate_state_can_complete_or_return_to_pending() {
    let pool = setup().await;
    let directory = std::env::temp_dir().join(format!("xiaoyan-inbox-pdf-{}", Uuid::new_v4()));
    std::fs::create_dir_all(&directory).unwrap();
    let pdf_path = directory.join("paper.pdf");
    std::fs::write(&pdf_path, b"%PDF-1.7\n").unwrap();
    let inspection = FileCandidateService::inspect_and_create(
        &pool,
        vec![pdf_path.to_string_lossy().to_string()],
    )
    .await
    .unwrap();
    let id = inspection.candidates[0].id.clone();
    FileCandidateService::confirm(&pool, vec![id.clone()])
        .await
        .unwrap();

    let claimed = AssistantInboxService::claim_paper(&pool, &id)
        .await
        .unwrap();
    assert_eq!(claimed.file_path, pdf_path.canonicalize().unwrap());
    AssistantInboxService::restore_paper(&pool, &id)
        .await
        .unwrap();
    let claimed = AssistantInboxService::claim_paper(&pool, &id)
        .await
        .unwrap();
    AssistantInboxService::complete_paper(&pool, &claimed.id, "paper-1", None)
        .await
        .unwrap();
    let status: (String, Option<String>) = sqlx::query_as(
        "SELECT status, imported_paper_id FROM assistant_paper_candidates WHERE id = ?",
    )
    .bind(&id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(status.0, "imported");
    assert_eq!(status.1.as_deref(), Some("paper-1"));
    let provenance: (String, String, String) = sqlx::query_as(
        "SELECT target, target_id, source_type FROM assistant_imports WHERE target_id = 'paper-1'",
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(
        provenance,
        ("paper".into(), "paper-1".into(), "dropped_file".into())
    );
    std::fs::remove_dir_all(directory).unwrap();
}
