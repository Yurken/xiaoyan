use std::fs;

use sqlx::sqlite::SqlitePoolOptions;
use uuid::Uuid;

use super::{file_shelf_service::FileShelfService, CleanupService};

async fn setup() -> (sqlx::SqlitePool, std::path::PathBuf) {
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect("sqlite::memory:")
        .await
        .unwrap();
    CleanupService::init_tables(&pool).await.unwrap();
    let dir = std::env::temp_dir().join(format!("xiaoyan-file-shelf-{}", Uuid::new_v4()));
    fs::create_dir_all(&dir).unwrap();
    (pool, dir)
}

#[tokio::test]
async fn stashes_an_independent_copy_and_removes_only_the_copy() {
    let (pool, dir) = setup().await;
    let source = dir.join("source.txt");
    fs::write(&source, "first version").unwrap();

    let stashed = FileShelfService::stash_paths(
        &pool,
        &dir,
        vec![source.to_string_lossy().to_string()],
        "drag",
    )
    .await
    .unwrap();
    assert_eq!(stashed.items.len(), 1);
    assert!(stashed.rejected.is_empty());

    fs::write(&source, "changed source").unwrap();
    let row = sqlx::query_scalar::<_, String>(
        "SELECT stored_path FROM assistant_file_shelf_items WHERE id = ?",
    )
    .bind(&stashed.items[0].id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(fs::read_to_string(&row).unwrap(), "first version");

    FileShelfService::remove(&pool, &dir, vec![stashed.items[0].id.clone()])
        .await
        .unwrap();
    assert!(source.exists());
    assert!(!std::path::Path::new(&row).exists());
    let _ = fs::remove_dir_all(dir);
}

#[tokio::test]
async fn stashes_folders_and_reports_missing_inputs_without_failing_the_batch() {
    let (pool, dir) = setup().await;
    let folder = dir.join("dataset");
    fs::create_dir_all(&folder).unwrap();
    fs::write(folder.join("rows.csv"), "a,b\n1,2\n").unwrap();

    let result = FileShelfService::stash_paths(
        &pool,
        &dir,
        vec![
            folder.to_string_lossy().to_string(),
            dir.join("missing.pdf").to_string_lossy().to_string(),
        ],
        "clipboard",
    )
    .await
    .unwrap();
    assert_eq!(result.items.len(), 1);
    assert!(result.items[0].is_directory);
    assert_eq!(result.items[0].size_bytes, 8);
    assert_eq!(result.rejected.len(), 1);

    let listed = FileShelfService::list(&pool).await.unwrap();
    assert_eq!(listed.len(), 1);
    assert!(listed[0].available);
    let _ = fs::remove_dir_all(dir);
}
