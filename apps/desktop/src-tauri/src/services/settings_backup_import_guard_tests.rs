use super::{ensure_backup_import_preserves_unlisted_assets, quote_identifier};
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::{Row, SqlitePool};

async fn database() -> SqlitePool {
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(
            SqliteConnectOptions::new()
                .in_memory(true)
                .foreign_keys(true),
        )
        .await
        .expect("memory database");
    sqlx::raw_sql(
        "CREATE TABLE papers (id TEXT PRIMARY KEY);
         CREATE TABLE experiment_records (id TEXT PRIMARY KEY);
         CREATE TABLE paper_notes (id TEXT PRIMARY KEY, paper_id TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE);
         CREATE TABLE paper_corpus (id TEXT PRIMARY KEY, paper_id TEXT REFERENCES papers(id) ON DELETE CASCADE);
         CREATE TABLE experiment_snapshots (id TEXT PRIMARY KEY, experiment_id TEXT NOT NULL REFERENCES experiment_records(id) ON DELETE CASCADE);",
    )
    .execute(&pool)
    .await
    .expect("create schema");
    pool
}

async fn replace_backed_up_parents(pool: &SqlitePool) -> Result<(), String> {
    let mut tx = pool.begin().await.map_err(|error| error.to_string())?;
    if let Err(error) =
        ensure_backup_import_preserves_unlisted_assets(&mut *tx, &["papers", "experiment_records"])
            .await
    {
        tx.rollback().await.map_err(|error| error.to_string())?;
        return Err(error);
    }
    sqlx::raw_sql("DELETE FROM papers; DELETE FROM experiment_records;")
        .execute(&mut *tx)
        .await
        .map_err(|error| error.to_string())?;
    tx.commit().await.map_err(|error| error.to_string())
}

async fn count(pool: &SqlitePool, table: &str) -> i64 {
    sqlx::query_scalar(&format!("SELECT COUNT(*) FROM {}", quote_identifier(table)))
        .fetch_one(pool)
        .await
        .expect("count rows")
}

#[tokio::test]
async fn protected_reading_and_snapshot_assets_survive_rejected_import() {
    let pool = database().await;
    sqlx::raw_sql(
        "INSERT INTO papers VALUES ('paper-1');
         INSERT INTO experiment_records VALUES ('experiment-1');
         INSERT INTO paper_notes VALUES ('note-1', 'paper-1');
         INSERT INTO paper_corpus VALUES ('corpus-1', 'paper-1');
         INSERT INTO experiment_snapshots VALUES ('snapshot-1', 'experiment-1');",
    )
    .execute(&pool)
    .await
    .unwrap();
    let result = replace_backed_up_parents(&pool).await;
    assert_eq!(count(&pool, "paper_notes").await, 1);
    assert_eq!(count(&pool, "paper_corpus").await, 1);
    assert_eq!(count(&pool, "experiment_snapshots").await, 1);
    assert_eq!(count(&pool, "papers").await, 1);
    let error = result.expect_err("destructive import must be rejected");
    assert!(error.contains("阅读批注 1 条"), "{error}");
    assert!(error.contains("语料摘录 1 条"), "{error}");
    assert!(error.contains("实验快照 1 条"), "{error}");
}

#[tokio::test]
async fn empty_database_and_unrelated_global_corpus_allow_import() {
    let pool = database().await;
    replace_backed_up_parents(&pool)
        .await
        .expect("empty database is safe");
    sqlx::raw_sql(
        "INSERT INTO papers VALUES ('paper-1');
         INSERT INTO paper_corpus VALUES ('global-corpus', NULL);",
    )
    .execute(&pool)
    .await
    .unwrap();
    replace_backed_up_parents(&pool)
        .await
        .expect("global corpus has no affected paper");
    assert_eq!(count(&pool, "papers").await, 0);
    assert_eq!(count(&pool, "paper_corpus").await, 1);
}

#[tokio::test]
async fn unknown_set_null_relation_is_preserved_and_counted_once() {
    let pool = database().await;
    sqlx::raw_sql(
        "CREATE TABLE external_links (
            id TEXT PRIMARY KEY,
            paper_id TEXT REFERENCES papers(id) ON DELETE SET NULL,
            other_paper_id TEXT REFERENCES papers(id) ON DELETE SET NULL
         );
         INSERT INTO papers VALUES ('paper-1');
         INSERT INTO external_links VALUES ('link-1', 'paper-1', 'paper-1');",
    )
    .execute(&pool)
    .await
    .unwrap();
    let result = replace_backed_up_parents(&pool).await;
    let link = sqlx::query("SELECT paper_id, other_paper_id FROM external_links")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(
        link.get::<Option<String>, _>("paper_id").as_deref(),
        Some("paper-1")
    );
    assert_eq!(
        link.get::<Option<String>, _>("other_paper_id").as_deref(),
        Some("paper-1")
    );
    assert!(result
        .expect_err("set-null would modify unbacked records")
        .contains("external_links 1 条"));
}

#[tokio::test]
async fn backed_up_children_do_not_block_replacement() {
    let pool = database().await;
    sqlx::raw_sql("INSERT INTO papers VALUES ('paper-1'); INSERT INTO paper_notes VALUES ('note-1', 'paper-1');")
        .execute(&pool).await.unwrap();
    let mut tx = pool.begin().await.unwrap();
    ensure_backup_import_preserves_unlisted_assets(
        &mut *tx,
        &["papers", "paper_notes", "experiment_records"],
    )
    .await
    .expect("included child is covered by backup import");
    tx.rollback().await.unwrap();
}

#[tokio::test]
async fn invalid_foreign_key_metadata_blocks_import_instead_of_skipping() {
    let pool = database().await;
    sqlx::raw_sql("CREATE TABLE malformed_assets (id TEXT PRIMARY KEY, paper_id TEXT REFERENCES papers(missing_key) ON DELETE CASCADE);
         INSERT INTO papers VALUES ('paper-1');")
        .execute(&pool).await.unwrap();
    let error = replace_backed_up_parents(&pool)
        .await
        .expect_err("guard errors must stop the import");
    assert!(
        error.contains("备份导入资产检查失败（malformed_assets）"),
        "{error}"
    );
    assert_eq!(count(&pool, "papers").await, 1);
}

#[tokio::test]
async fn quoted_user_table_and_implicit_composite_key_are_protected() {
    let pool = database().await;
    sqlx::raw_sql(
        r#"CREATE TABLE composite_parents (
             "project key" TEXT, "version""id" TEXT,
             PRIMARY KEY ("project key", "version""id")
           );
           CREATE TABLE "sqliteX""assets" (
             id TEXT PRIMARY KEY, project TEXT, revision TEXT,
             FOREIGN KEY (project, revision) REFERENCES composite_parents ON DELETE CASCADE
           );
           INSERT INTO composite_parents VALUES ('tenant', 'v1');
           INSERT INTO "sqliteX""assets" VALUES ('affected', 'tenant', 'v1'), ('global', NULL, 'v1');"#,
    )
    .execute(&pool)
    .await
    .unwrap();
    let mut tx = pool.begin().await.unwrap();
    let result = ensure_backup_import_preserves_unlisted_assets(
        &mut *tx,
        &["papers", "experiment_records", "composite_parents"],
    )
    .await;
    if result.is_ok() {
        sqlx::query("DELETE FROM composite_parents")
            .execute(&mut *tx)
            .await
            .unwrap();
        tx.commit().await.unwrap();
    } else {
        tx.rollback().await.unwrap();
    }
    assert_eq!(count(&pool, "sqliteX\"assets").await, 2);
    assert!(result
        .expect_err("quoted user table must be inspected")
        .contains("sqliteX\"assets 1 条"));
}
