use std::path::PathBuf;

use sqlx::SqlitePool;
use uuid::Uuid;

use super::image_asset_service::AssistantImageAssetService;
use crate::services::desktop_assistant::CleanupService;

async fn setup() -> (SqlitePool, PathBuf) {
    let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
    CleanupService::init_tables(&pool).await.unwrap();
    let directory = std::env::temp_dir().join(format!("xiaoyan-image-assets-{}", Uuid::new_v4()));
    std::fs::create_dir_all(directory.join("assistant_images")).unwrap();
    (pool, directory)
}

async fn insert_asset(pool: &SqlitePool, asset_id: &str, location: &str, created_at: &str) {
    sqlx::query(
        "INSERT INTO assistant_imports (
            id, session_id, target, target_id, storage_location, estimated_size_bytes,
            source_type, source_app, source_title, capture_region_width,
            capture_region_height, created_at
         ) VALUES (?, 'session-1', 'image', ?, ?, 8, 'screenshot', 'Preview',
                   'Results figure', 1280, 720, ?)",
    )
    .bind(Uuid::new_v4().to_string())
    .bind(asset_id)
    .bind(location)
    .bind(created_at)
    .execute(pool)
    .await
    .unwrap();
}

#[tokio::test]
async fn lists_latest_record_per_asset_and_reports_file_availability() {
    let (pool, directory) = setup().await;
    let asset_id = Uuid::new_v4().to_string();
    let location = format!("app_data:assistant_images/{asset_id}.png");
    std::fs::write(
        directory
            .join("assistant_images")
            .join(format!("{asset_id}.png")),
        b"12345678",
    )
    .unwrap();
    insert_asset(&pool, &asset_id, &location, "2026-07-30 09:00:00").await;
    insert_asset(&pool, &asset_id, &location, "2026-07-30 10:00:00").await;

    let assets = AssistantImageAssetService::list(&pool, &directory)
        .await
        .unwrap();
    assert_eq!(assets.len(), 1);
    assert!(assets[0].available);
    assert_eq!(assets[0].media_type, "image/png");
    assert_eq!(assets[0].size_bytes, 8);
    assert_eq!(assets[0].capture_region.as_ref().unwrap().width, 1280);
    std::fs::remove_dir_all(directory).unwrap();
}

#[tokio::test]
async fn deletes_managed_file_and_all_provenance_records() {
    let (pool, directory) = setup().await;
    let asset_id = Uuid::new_v4().to_string();
    let location = format!("app_data:assistant_images/{asset_id}.jpg");
    let path = directory
        .join("assistant_images")
        .join(format!("{asset_id}.jpg"));
    std::fs::write(&path, b"image").unwrap();
    insert_asset(&pool, &asset_id, &location, "2026-07-30 10:00:00").await;

    AssistantImageAssetService::delete(&pool, &directory, &asset_id)
        .await
        .unwrap();
    assert!(!path.exists());
    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM assistant_imports WHERE target = 'image' AND target_id = ?",
    )
    .bind(&asset_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(count, 0);
    std::fs::remove_dir_all(directory).unwrap();
}

#[tokio::test]
async fn deletes_stale_metadata_when_the_managed_file_is_already_missing() {
    let (pool, directory) = setup().await;
    let asset_id = Uuid::new_v4().to_string();
    let location = format!("app_data:assistant_images/{asset_id}.webp");
    insert_asset(&pool, &asset_id, &location, "2026-07-30 10:00:00").await;

    let assets = AssistantImageAssetService::list(&pool, &directory)
        .await
        .unwrap();
    assert!(!assets[0].available);
    AssistantImageAssetService::delete(&pool, &directory, &asset_id)
        .await
        .unwrap();
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM assistant_imports")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(count, 0);
    std::fs::remove_dir_all(directory).unwrap();
}

#[tokio::test]
async fn rejects_foreign_or_traversing_storage_locations_without_touching_files() {
    let (pool, directory) = setup().await;
    let asset_id = Uuid::new_v4().to_string();
    let foreign = directory.join("keep.png");
    std::fs::write(&foreign, b"keep").unwrap();
    insert_asset(
        &pool,
        &asset_id,
        "app_data:assistant_images/../keep.png",
        "2026-07-30 10:00:00",
    )
    .await;

    assert!(
        AssistantImageAssetService::delete(&pool, &directory, &asset_id)
            .await
            .is_err()
    );
    assert!(foreign.exists());
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM assistant_imports")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(count, 1);
    std::fs::remove_dir_all(directory).unwrap();
}

#[tokio::test]
async fn batch_clear_preflights_every_path_before_moving_any_file() {
    let (pool, directory) = setup().await;
    let valid_id = Uuid::new_v4().to_string();
    let invalid_id = Uuid::new_v4().to_string();
    let valid_path = directory
        .join("assistant_images")
        .join(format!("{valid_id}.png"));
    std::fs::write(&valid_path, b"keep-until-preflight-passes").unwrap();
    insert_asset(
        &pool,
        &valid_id,
        &format!("app_data:assistant_images/{valid_id}.png"),
        "2026-07-30 09:00:00",
    )
    .await;
    insert_asset(
        &pool,
        &invalid_id,
        "app_data:assistant_images/../outside.png",
        "2026-07-30 10:00:00",
    )
    .await;

    assert!(AssistantImageAssetService::delete_all(&pool, &directory)
        .await
        .is_err());
    assert!(valid_path.exists());
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM assistant_imports")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(count, 2);
    std::fs::remove_dir_all(directory).unwrap();
}
