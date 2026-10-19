use super::*;
use chrono::DateTime;
use serde_json::json;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use std::future::Future;
use std::time::Duration;
use tokio::time::timeout;

const OLD: &str = "2000-01-01T00:00:00Z";
const MIDDLE: &str = "2001-01-01T00:00:00Z";
const NEW: &str = "2002-01-01T00:00:00Z";

async fn bounded<F: Future>(operation: F) -> F::Output {
    timeout(Duration::from_secs(5), operation)
        .await
        .expect("local transaction must not borrow its own pool's only connection")
}

async fn database() -> SqlitePool {
    let db = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(SqliteConnectOptions::new().in_memory(true).foreign_keys(true))
        .await
        .expect("isolated single-connection memory database");
    for &table in BACKUP_TABLES {
        let extra = match table {
            "papers" => ", title TEXT NOT NULL DEFAULT ''",
            "settings" => ", value TEXT NOT NULL DEFAULT ''",
            "chat_messages" => ", images TEXT DEFAULT 'synthetic-heavy-field'",
            "paper_chunks" | "knowledge_notes" => {
                ", embedding TEXT DEFAULT 'synthetic-heavy-field'"
            }
            _ => "",
        };
        sqlx::query(&format!(
            "CREATE TABLE {table} ({} TEXT PRIMARY KEY, created_at TEXT, updated_at TEXT{extra})",
            pk_column(table)
        ))
        .execute(&db)
        .await
        .expect("create only the minimal synthetic backup table");
    }
    sqlx::raw_sql(
        "CREATE TABLE sync_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
         CREATE TABLE sync_tombstones (
             entity_table TEXT NOT NULL, entity_id TEXT NOT NULL, deleted_at TEXT NOT NULL,
             PRIMARY KEY (entity_table, entity_id)
         );",
    )
    .execute(&db)
    .await
    .expect("create synthetic synchronization metadata");
    db
}

fn paper(id: &str, title: &str, updated_at: &str) -> Value {
    json!({ "id": id, "title": title, "created_at": OLD, "updated_at": updated_at })
}

fn plan(rows: Vec<(&str, Value)>, tombstones: Vec<(&str, &str, &str)>) -> MergePlan {
    let mut result = MergePlan {
        rows: HashMap::new(),
        tombstones: HashMap::new(),
        assets: BTreeMap::new(),
    };
    for (table, row) in rows {
        let id = row[pk_column(table)].as_str().expect("synthetic primary key").to_string();
        result.rows.entry(table.to_string()).or_default().insert(id, row);
    }
    for (table, id, deleted_at) in tombstones {
        result.tombstones.insert(
            (table.to_string(), id.to_string()),
            deleted_at.to_string(),
        );
    }
    result
}

async fn insert_paper(db: &SqlitePool, id: &str, title: &str, timestamp: &str) {
    sqlx::query("INSERT INTO papers (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)")
        .bind(id)
        .bind(title)
        .bind(OLD)
        .bind(timestamp)
        .execute(db)
        .await
        .expect("insert synthetic paper");
}

async fn delete_paper(db: &SqlitePool, id: &str) {
    sqlx::query("DELETE FROM papers WHERE id = ?")
        .bind(id)
        .execute(db)
        .await
        .expect("delete only a synthetic paper");
}

async fn paper_title(db: &SqlitePool, id: &str) -> Option<String> {
    sqlx::query_scalar("SELECT title FROM papers WHERE id = ?")
        .bind(id)
        .fetch_optional(db)
        .await
        .expect("read synthetic paper")
}

async fn baseline(db: &SqlitePool, table: &str) -> HashSet<String> {
    let value: String = sqlx::query_scalar("SELECT value FROM sync_meta WHERE key = ?")
        .bind(format!("baseline:{table}"))
        .fetch_one(db)
        .await
        .expect("baseline was persisted");
    serde_json::from_str(&value).expect("valid baseline ID array")
}

async fn metadata(db: &SqlitePool) -> BTreeMap<String, String> {
    sqlx::query_as::<_, (String, String)>("SELECT key, value FROM sync_meta")
        .fetch_all(db)
        .await
        .expect("read synthetic metadata")
        .into_iter()
        .collect()
}

async fn tombstones(db: &SqlitePool) -> BTreeMap<(String, String), String> {
    sqlx::query_as::<_, (String, String, String)>(
        "SELECT entity_table, entity_id, deleted_at FROM sync_tombstones",
    )
    .fetch_all(db)
    .await
    .expect("read synthetic tombstones")
    .into_iter()
    .map(|(table, id, timestamp)| ((table, id), timestamp))
    .collect()
}

async fn seed_tombstone(db: &SqlitePool, id: &str, timestamp: &str) {
    sqlx::query(
        "INSERT INTO sync_tombstones (entity_table, entity_id, deleted_at)
         VALUES ('papers', ?, ?)",
    )
    .bind(id)
    .bind(timestamp)
    .execute(db)
    .await
    .expect("seed synthetic historical tombstone");
}

fn paper_key(id: &str) -> (String, String) {
    ("papers".to_string(), id.to_string())
}

#[tokio::test]
async fn edits_after_capture_resist_older_remote_rows_and_tombstones() {
    let db = database().await;
    insert_paper(&db, "row-target", "captured old row", OLD).await;
    insert_paper(&db, "delete-target", "captured old deletion target", OLD).await;
    bounded(capture_local_state(&db)).await.expect("capture before network wait");

    sqlx::query("UPDATE papers SET title = 'edited during sync', updated_at = ?")
        .bind(NEW)
        .execute(&db)
        .await
        .expect("make both local edits after outbound capture");
    let remote = plan(
        vec![("papers", paper("row-target", "stale remote edit", MIDDLE))],
        vec![("papers", "delete-target", MIDDLE)],
    );
    let counts = bounded(apply_merge(&db, &remote, &HashMap::new()))
        .await
        .expect("merge using current local row clocks");

    assert_eq!(counts, (0, 0));
    assert_eq!(paper_title(&db, "row-target").await.as_deref(), Some("edited during sync"));
    assert_eq!(paper_title(&db, "delete-target").await.as_deref(), Some("edited during sync"));
    assert_eq!(
        tombstones(&db).await.get(&paper_key("delete-target")).map(String::as_str),
        Some(MIDDLE)
    );
    assert_eq!(
        baseline(&db, "papers").await,
        HashSet::from(["row-target".to_string(), "delete-target".to_string()])
    );
    db.close().await;
}

#[tokio::test]
async fn local_tombstone_rejects_older_or_equal_rows_but_allows_a_newer_restore() {
    let db = database().await;
    seed_tombstone(&db, "p1", MIDDLE).await;
    bounded(capture_local_state(&db)).await.expect("capture known local deletion");

    for timestamp in [OLD, MIDDLE] {
        let remote = plan(
            vec![("papers", paper("p1", "must remain deleted", timestamp))],
            vec![
                ("papers", "p1", OLD),
                // Newer peers can send tombstones for tables absent in this
                // schema. Retain them without querying an unknown table.
                ("future_table", "future-row", MIDDLE),
            ],
        );
        assert_eq!(
            bounded(apply_merge(&db, &remote, &HashMap::new())).await.expect("merge old row"),
            (0, 0)
        );
        assert_eq!(paper_title(&db, "p1").await, None);
        assert_eq!(
            tombstones(&db).await.get(&paper_key("p1")).map(String::as_str),
            Some(MIDDLE),
            "an older remote tombstone must not replace the local deletion clock"
        );
    }

    let restore = plan(
        vec![("papers", paper("p1", "newer restoration", NEW))],
        vec![("papers", "p1", OLD)],
    );
    assert_eq!(
        bounded(apply_merge(&db, &restore, &HashMap::new())).await.expect("restore newer row"),
        (1, 0)
    );
    assert_eq!(paper_title(&db, "p1").await.as_deref(), Some("newer restoration"));
    assert_eq!(baseline(&db, "papers").await, HashSet::from(["p1".to_string()]));
    assert_eq!(
        tombstones(&db).await.get(&paper_key("p1")).map(String::as_str),
        Some(MIDDLE)
    );
    let (_, captured_tombstones) =
        bounded(capture_local_state(&db)).await.expect("capture compatible tombstone passthrough");
    assert!(captured_tombstones.iter().any(|entry| {
        entry.table == "future_table"
            && entry.id == "future-row"
            && entry.deleted_at == MIDDLE
    }));
    db.close().await;
}

#[tokio::test]
async fn deletion_after_capture_is_detected_before_merge_can_restore_the_old_row() {
    let db = database().await;
    insert_paper(&db, "p1", "captured", OLD).await;
    let (captured, _) = bounded(capture_local_state(&db)).await.expect("capture outbound state");
    delete_paper(&db, "p1").await;
    let remote = plan(vec![("papers", captured["papers"][0].clone())], vec![]);

    assert_eq!(
        bounded(apply_merge(&db, &remote, &HashMap::new())).await.expect("merge after local delete"),
        (0, 0)
    );
    assert_eq!(paper_title(&db, "p1").await, None);
    let stored = tombstones(&db).await;
    let deleted_at = stored.get(&paper_key("p1")).expect("local deletion must be recorded");
    assert!(
        DateTime::parse_from_rfc3339(deleted_at).expect("generated deletion clock")
            > DateTime::parse_from_rfc3339(OLD).unwrap()
    );
    assert!(baseline(&db, "papers").await.is_empty());
    db.close().await;
}

#[tokio::test]
async fn no_remote_checkpoint_records_deletion_after_capture_without_redating_it() {
    let db = database().await;
    insert_paper(&db, "p1", "captured", OLD).await;
    bounded(capture_local_state(&db)).await.expect("capture before network wait");
    delete_paper(&db, "p1").await;

    bounded(checkpoint_local_deletes(&db)).await.expect("checkpoint no-remote sync");
    let first = tombstones(&db).await;
    assert!(first.contains_key(&paper_key("p1")));
    assert!(baseline(&db, "papers").await.is_empty());
    bounded(checkpoint_local_deletes(&db)).await.expect("repeat unchanged observation");
    assert_eq!(tombstones(&db).await, first);

    let (captured, captured_tombstones) =
        bounded(capture_local_state(&db)).await.expect("next outbound capture");
    assert!(captured["papers"].is_empty());
    assert!(captured_tombstones.iter().any(|entry| {
        entry.table == "papers"
            && entry.id == "p1"
            && first.get(&paper_key("p1")) == Some(&entry.deleted_at)
    }));
    db.close().await;
}

#[tokio::test]
async fn a_newly_observed_second_deletion_advances_an_older_tombstone() {
    let db = database().await;
    seed_tombstone(&db, "p1", OLD).await;
    insert_paper(&db, "p1", "restored after first deletion", MIDDLE).await;
    bounded(capture_local_state(&db)).await.expect("observe restored row in baseline");
    assert_eq!(baseline(&db, "papers").await, HashSet::from(["p1".to_string()]));
    delete_paper(&db, "p1").await;

    bounded(checkpoint_local_deletes(&db)).await.expect("observe a distinct second deletion");
    let after_second_delete = tombstones(&db).await;
    let updated = after_second_delete.get(&paper_key("p1")).expect("updated tombstone");
    assert!(
        DateTime::parse_from_rfc3339(updated).expect("generated second-deletion clock")
            > DateTime::parse_from_rfc3339(MIDDLE).unwrap(),
        "the new deletion must beat a stale row that resurrected the first deletion"
    );
    let stale_restore = plan(
        vec![("papers", paper("p1", "stale first restoration", MIDDLE))],
        vec![],
    );
    bounded(apply_merge(&db, &stale_restore, &HashMap::new()))
        .await
        .expect("merge after second deletion");
    assert_eq!(paper_title(&db, "p1").await, None);
    assert_eq!(tombstones(&db).await, after_second_delete);
    db.close().await;
}

#[tokio::test]
async fn merge_failure_rolls_back_business_changes_tombstones_and_all_baselines() {
    let db = database().await;
    insert_paper(&db, "edit-target", "original edit target", OLD).await;
    insert_paper(&db, "delete-target", "original deletion target", OLD).await;
    insert_paper(&db, "local-delete", "deleted while waiting", OLD).await;
    bounded(capture_local_state(&db)).await.expect("establish pre-merge baselines");
    delete_paper(&db, "local-delete").await;
    let metadata_before = metadata(&db).await;
    let tombstones_before = tombstones(&db).await;
    let remote = plan(
        vec![
            ("papers", paper("edit-target", "must rollback", NEW)),
            // Last table in dependency order: the paper changes and deletion
            // metadata have already been attempted when this SQL fails.
            ("user_memories", json!({
                "id": "invalid-late-row", "created_at": NEW, "updated_at": NEW,
                "column_that_does_not_exist": "force a deterministic SQL error"
            })),
        ],
        vec![("papers", "delete-target", MIDDLE)],
    );

    let error = bounded(apply_merge(&db, &remote, &HashMap::new()))
        .await
        .expect_err("late SQL failure must roll back the whole local boundary");
    assert!(error.contains("user_memories"), "{error}");
    assert_eq!(paper_title(&db, "edit-target").await.as_deref(), Some("original edit target"));
    assert_eq!(paper_title(&db, "delete-target").await.as_deref(), Some("original deletion target"));
    assert_eq!(paper_title(&db, "local-delete").await, None);
    assert_eq!(tombstones(&db).await, tombstones_before);
    assert_eq!(metadata(&db).await, metadata_before);
    assert!(baseline(&db, "papers").await.contains("local-delete"));

    // A retry can still discover the local deletion; failed checkpoint work
    // must not consume it by advancing the baseline outside the transaction.
    bounded(checkpoint_local_deletes(&db)).await.expect("retry after failed merge");
    assert!(tombstones(&db).await.contains_key(&paper_key("local-delete")));
    assert!(!baseline(&db, "papers").await.contains("local-delete"));
    db.close().await;
}

#[tokio::test]
async fn capture_rows_tombstones_and_all_table_baselines_describe_the_same_observation() {
    let db = database().await;
    for &table in BACKUP_TABLES {
        sqlx::query(&format!(
            "INSERT INTO {table} ({}, created_at, updated_at) VALUES (?, ?, ?)",
            pk_column(table)
        ))
        .bind(format!("{table}-1"))
        .bind(OLD)
        .bind(OLD)
        .execute(&db)
        .await
        .expect("seed one synthetic row in every backup table");
    }
    bounded(checkpoint_local_deletes(&db)).await.expect("establish previous observation");
    delete_paper(&db, "papers-1").await;
    insert_paper(&db, "papers-2", "replacement", MIDDLE).await;

    let (tables, captured_tombstones) =
        bounded(capture_local_state(&db)).await.expect("capture full local observation");
    assert_eq!(tables.len(), BACKUP_TABLES.len());
    for &table in BACKUP_TABLES {
        let observed_ids: HashSet<String> = tables[table]
            .iter()
            .map(|row| row[pk_column(table)].as_str().expect("captured row primary key").to_string())
            .collect();
        assert_eq!(baseline(&db, table).await, observed_ids, "{table}");
    }
    assert_eq!(
        tables["papers"][0]["id"].as_str(),
        Some("papers-2")
    );
    assert!(tables["chat_messages"][0].get("images").is_none());
    assert!(tables["paper_chunks"][0].get("embedding").is_none());
    assert!(tables["knowledge_notes"][0].get("embedding").is_none());
    let captured_map: BTreeMap<(String, String), String> = captured_tombstones
        .into_iter()
        .map(|entry| ((entry.table, entry.id), entry.deleted_at))
        .collect();
    assert_eq!(captured_map, tombstones(&db).await);
    assert!(captured_map.contains_key(&paper_key("papers-1")));
    db.close().await;
}

#[tokio::test]
async fn corrupt_late_baseline_fails_capture_and_rolls_back_earlier_deletion_tracking() {
    let db = database().await;
    insert_paper(&db, "p1", "before deletion", OLD).await;
    bounded(capture_local_state(&db)).await.expect("establish valid baselines");
    delete_paper(&db, "p1").await;
    sqlx::query("UPDATE sync_meta SET value = 'not valid JSON' WHERE key = 'baseline:user_memories'")
        .execute(&db)
        .await
        .expect("corrupt only a synthetic late baseline");
    let before = metadata(&db).await;
    let previous_tombstones = tombstones(&db).await;

    let error = bounded(capture_local_state(&db))
        .await
        .expect_err("malformed deletion history must not silently become an empty baseline");
    assert!(error.contains("user_memories"), "{error}");
    assert_eq!(metadata(&db).await, before);
    assert_eq!(tombstones(&db).await, previous_tombstones);
    assert!(baseline(&db, "papers").await.contains("p1"));
    assert_eq!(paper_title(&db, "p1").await, None);

    sqlx::query("UPDATE sync_meta SET value = '[]' WHERE key = 'baseline:user_memories'")
        .execute(&db)
        .await
        .expect("repair only the synthetic malformed baseline");
    bounded(checkpoint_local_deletes(&db)).await.expect("retry preserves pending local deletion");
    assert!(tombstones(&db).await.contains_key(&paper_key("p1")));
    assert!(baseline(&db, "papers").await.is_empty());
    db.close().await;
}
