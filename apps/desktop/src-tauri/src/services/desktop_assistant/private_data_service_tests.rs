use sqlx::SqlitePool;
use uuid::Uuid;

use super::private_data_service::AssistantPrivateDataService;
use crate::services::desktop_assistant::CleanupService;

#[tokio::test]
async fn clears_private_ephemera_and_images_but_preserves_inbox_and_formal_imports() {
    let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
    CleanupService::init_tables(&pool).await.unwrap();
    let directory = std::env::temp_dir().join(format!("xiaoyan-private-clear-{}", Uuid::new_v4()));
    std::fs::create_dir_all(directory.join("assistant_images")).unwrap();
    let asset_id = Uuid::new_v4().to_string();
    let asset_path = directory
        .join("assistant_images")
        .join(format!("{asset_id}.png"));
    std::fs::write(&asset_path, b"image").unwrap();

    sqlx::query(
        "INSERT INTO assistant_capture_sessions
         (id, source_type, created_at, status, user_confirmed)
         VALUES ('capture-1', 'selection', datetime('now'), 'ready', 1)",
    )
    .execute(&pool)
    .await
    .unwrap();
    for (id, status) in [("preview-1", "preview"), ("pending-1", "pending")] {
        sqlx::query(
            "INSERT INTO assistant_file_candidates
             (id, file_path, file_name, kind, media_type, size_bytes,
              recommended_target, status, created_at, expires_at)
             VALUES (?, '/tmp/user-file.txt', 'user-file.txt', 'text', 'text/plain',
                     4, 'note', ?, datetime('now'), datetime('now', '+1 day'))",
        )
        .bind(id)
        .bind(status)
        .execute(&pool)
        .await
        .unwrap();
    }
    sqlx::query(
        "INSERT INTO assistant_later_items (id, title, content)
         VALUES ('later-1', '保留', '稍后处理内容')",
    )
    .execute(&pool)
    .await
    .unwrap();
    sqlx::query(
        "INSERT INTO assistant_imports
         (id, session_id, target, target_id, storage_location, created_at)
         VALUES (?, 'capture-1', 'image', ?, ?, datetime('now')),
                (?, 'capture-1', 'note', 'note-1', 'local_database:knowledge_notes', datetime('now'))",
    )
    .bind(Uuid::new_v4().to_string())
    .bind(&asset_id)
    .bind(format!("app_data:assistant_images/{asset_id}.png"))
    .bind(Uuid::new_v4().to_string())
    .execute(&pool)
    .await
    .unwrap();

    sqlx::query(
        "INSERT INTO assistant_metric_events (event_type, status)
         VALUES ('action', 'success')",
    )
    .execute(&pool)
    .await
    .unwrap();

    let result = AssistantPrivateDataService::clear(&pool, &directory)
        .await
        .unwrap();
    assert_eq!(result.capture_sessions, 1);
    assert_eq!(result.image_assets, 1);
    assert_eq!(result.file_previews, 1);
    assert!(!asset_path.exists());
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM assistant_metric_events")
            .fetch_one(&pool)
            .await
            .unwrap(),
        0
    );
    assert_eq!(
        sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM assistant_file_candidates WHERE status = 'pending'",
        )
        .fetch_one(&pool)
        .await
        .unwrap(),
        1
    );
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM assistant_later_items")
            .fetch_one(&pool)
            .await
            .unwrap(),
        1
    );
    assert_eq!(
        sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM assistant_imports WHERE target = 'note'",
        )
        .fetch_one(&pool)
        .await
        .unwrap(),
        1
    );
    std::fs::remove_dir_all(directory).unwrap();
}
