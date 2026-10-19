use super::{read_backup_tables, BackupSnapshot};
use serde_json::{json, Value};
use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions};
use sqlx::SqlitePool;
use std::fs;
use std::path::PathBuf;
use std::time::Duration;
use tokio::time::timeout;
use uuid::Uuid;

const OPERATION_TIMEOUT: Duration = Duration::from_secs(5);
const CHAT_SCHEMA: &str =
    "CREATE TABLE chat_sessions (id TEXT PRIMARY KEY, title TEXT NOT NULL);
     CREATE TABLE chat_messages (
         id TEXT PRIMARY KEY,
         session_id TEXT NOT NULL REFERENCES chat_sessions(id),
         content TEXT NOT NULL
     );
     CREATE TABLE empty_table (id TEXT PRIMARY KEY);
     INSERT INTO chat_sessions VALUES ('s-old', 'old title');
     INSERT INTO chat_messages VALUES ('m-old', 's-old', 'old content');";

async fn memory_database(schema: &str) -> SqlitePool {
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(
            SqliteConnectOptions::new()
                .in_memory(true)
                .foreign_keys(true),
        )
        .await
        .expect("isolated single-connection memory database");
    sqlx::raw_sql(schema)
        .execute(&pool)
        .await
        .expect("create only the synthetic test schema");
    pool
}

async fn assert_connection_released(pool: &SqlitePool) {
    let mut connection = timeout(OPERATION_TIMEOUT, pool.acquire())
        .await
        .expect("snapshot must release the pool's only connection")
        .expect("reacquire the only connection");
    let value: i64 = sqlx::query_scalar("SELECT 1")
        .fetch_one(&mut *connection)
        .await
        .expect("reacquired connection remains usable");
    assert_eq!(value, 1);
    drop(connection);
}

fn sorted_rows(value: &Value) -> Vec<Value> {
    let mut rows = value.as_array().expect("table is a JSON array").clone();
    rows.sort_by(|left, right| {
        left["id"]
            .as_str()
            .expect("synthetic row id")
            .cmp(right["id"].as_str().expect("synthetic row id"))
    });
    rows
}

struct TemporaryDatabase {
    directory: PathBuf,
}

impl TemporaryDatabase {
    fn new() -> Self {
        let directory = std::env::temp_dir().join(format!(
            "xiaoyan-backup-snapshot-test-{}",
            Uuid::new_v4()
        ));
        fs::create_dir(&directory).expect("create unique synthetic database directory");
        Self { directory }
    }

    fn path(&self) -> PathBuf {
        self.directory.join("snapshot.sqlite")
    }

    fn remove_after_close(&self) {
        fs::remove_dir_all(&self.directory)
            .expect("remove the unique fixture after closing both database pools");
    }
}

impl Drop for TemporaryDatabase {
    fn drop(&mut self) {
        // Best-effort panic cleanup; the normal path explicitly closes both
        // pools and removes this uniquely created subtree before assertions.
        let _ = fs::remove_dir_all(&self.directory);
    }
}

#[tokio::test]
async fn public_reader_collects_every_requested_table_with_one_connection_and_releases_it() {
    let pool = memory_database(CHAT_SCHEMA).await;
    let tables = timeout(
        OPERATION_TIMEOUT,
        read_backup_tables(&pool, &["chat_sessions", "chat_messages", "empty_table"]),
    )
    .await
    .expect("table reads must not try to borrow a second pool connection")
    .expect("collect all requested tables");
    assert_connection_released(&pool).await;
    pool.close().await;

    assert_eq!(tables.len(), 3);
    assert_eq!(
        tables["chat_sessions"],
        json!([{ "id": "s-old", "title": "old title" }])
    );
    assert_eq!(
        tables["chat_messages"],
        json!([{ "id": "m-old", "session_id": "s-old", "content": "old content" }])
    );
    assert_eq!(tables["empty_table"], json!([]));
}

#[tokio::test]
async fn empty_table_and_empty_table_list_release_the_single_connection() {
    let pool = memory_database("CREATE TABLE empty_table (id TEXT PRIMARY KEY);").await;
    let one_empty_table = timeout(
        OPERATION_TIMEOUT,
        read_backup_tables(&pool, &["empty_table"]),
    )
    .await
    .expect("empty table read must complete")
    .expect("empty table is valid");
    assert_connection_released(&pool).await;

    let no_tables = timeout(OPERATION_TIMEOUT, read_backup_tables(&pool, &[]))
        .await
        .expect("empty table list must complete")
        .expect("empty table list is valid");
    assert_connection_released(&pool).await;
    pool.close().await;

    assert_eq!(one_empty_table.len(), 1);
    assert_eq!(one_empty_table["empty_table"], json!([]));
    assert!(no_tables.is_empty());
}

#[tokio::test]
async fn public_reader_preserves_null_strings_integer_float_and_json_text_values() {
    let pool = memory_database(
        "CREATE TABLE scalar_values (
             id TEXT PRIMARY KEY,
             nullable_parent TEXT,
             empty_text TEXT NOT NULL,
             numeric_text TEXT NOT NULL,
             max_integer INTEGER NOT NULL,
             min_integer INTEGER NOT NULL,
             real_value REAL NOT NULL,
             json_text TEXT NOT NULL
         );",
    )
    .await;
    let json_text = r#"{"nested":[1,null,true]}"#;
    sqlx::query(
        "INSERT INTO scalar_values
         (id, nullable_parent, empty_text, numeric_text, max_integer,
          min_integer, real_value, json_text)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind("values-1")
    .bind(Option::<String>::None)
    .bind("")
    .bind("0012")
    .bind(i64::MAX)
    .bind(i64::MIN)
    .bind(3.25_f64)
    .bind(json_text)
    .execute(&pool)
    .await
    .expect("insert synthetic scalar values");

    let tables = timeout(
        OPERATION_TIMEOUT,
        read_backup_tables(&pool, &["scalar_values"]),
    )
    .await
    .expect("scalar read must complete")
    .expect("read values through the production JSON conversion");
    assert_connection_released(&pool).await;
    pool.close().await;

    assert_eq!(
        tables["scalar_values"],
        json!([{
            "id": "values-1",
            "nullable_parent": null,
            "empty_text": "",
            "numeric_text": "0012",
            "max_integer": i64::MAX,
            "min_integer": i64::MIN,
            "real_value": 3.25,
            "json_text": json_text
        }])
    );
    // A stored JSON string remains a string; NULL is distinct from empty text.
    let row = &tables["scalar_values"][0];
    assert!(row["nullable_parent"].is_null());
    assert!(row["json_text"].is_string());
    assert_eq!(row["max_integer"].as_i64(), Some(i64::MAX));
    assert_eq!(row["min_integer"].as_i64(), Some(i64::MIN));
    assert_eq!(row["real_value"].as_f64(), Some(3.25));
}

#[tokio::test]
async fn missing_table_returns_error_instead_of_partial_tables_and_releases_connection() {
    let pool = memory_database(CHAT_SCHEMA).await;
    let error = timeout(
        OPERATION_TIMEOUT,
        read_backup_tables(&pool, &["chat_sessions", "missing_table", "chat_messages"]),
    )
    .await
    .expect("missing table must fail promptly rather than exhaust the pool")
    .expect_err("a successful first table must not turn a later failure into partial success");
    assert!(error.contains("missing_table"), "{error}");
    assert_connection_released(&pool).await;

    // The failed owner must be dropped before another transaction can use the
    // only connection. Repair the synthetic schema and read the complete set.
    sqlx::query("CREATE TABLE missing_table (id TEXT PRIMARY KEY)")
        .execute(&pool)
        .await
        .expect("connection can write after snapshot failure");
    let recovered = timeout(
        OPERATION_TIMEOUT,
        read_backup_tables(&pool, &["chat_sessions", "missing_table", "chat_messages"]),
    )
    .await
    .expect("a new snapshot can reuse the connection")
    .expect("read all tables after synthetic schema repair");
    assert_connection_released(&pool).await;
    pool.close().await;

    assert_eq!(recovered.len(), 3);
    assert_eq!(recovered["missing_table"], json!([]));
    assert_eq!(
        recovered["chat_sessions"],
        json!([{ "id": "s-old", "title": "old title" }])
    );
    assert_eq!(
        recovered["chat_messages"],
        json!([{ "id": "m-old", "session_id": "s-old", "content": "old content" }])
    );
}

#[tokio::test]
async fn wal_commit_between_table_reads_cannot_mix_parent_and_child_generations() {
    let fixture = TemporaryDatabase::new();
    let options = SqliteConnectOptions::new()
        .filename(fixture.path())
        .create_if_missing(true)
        .foreign_keys(true)
        .journal_mode(SqliteJournalMode::Wal)
        .busy_timeout(OPERATION_TIMEOUT);
    let writer_pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(options.clone())
        .await
        .expect("open synthetic WAL writer pool");
    sqlx::raw_sql(CHAT_SCHEMA)
        .execute(&writer_pool)
        .await
        .expect("seed synthetic parent and child rows");
    let reader_pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(options)
        .await
        .expect("open independent synthetic WAL reader pool");
    let journal_mode: String = sqlx::query_scalar("PRAGMA journal_mode")
        .fetch_one(&reader_pool)
        .await
        .expect("read the fixture journal mode");

    // Use the production owner, not a test-only BEGIN. Awaiting the first table
    // read establishes its snapshot before the writer starts.
    let mut snapshot = timeout(OPERATION_TIMEOUT, BackupSnapshot::begin(&reader_pool))
        .await
        .expect("start snapshot without borrowing another connection")
        .expect("begin production snapshot reader");
    let before_sessions = snapshot
        .read_table("chat_sessions")
        .await
        .expect("establish snapshot by reading the parent table");

    let mut writer = writer_pool.begin().await.expect("begin independent writer");
    sqlx::raw_sql(
        "INSERT INTO chat_sessions VALUES ('s-new', 'new title');
         INSERT INTO chat_messages VALUES ('m-new', 's-new', 'new content');
         UPDATE chat_sessions SET title = 'changed title' WHERE id = 's-old';
         UPDATE chat_messages SET session_id = 's-new', content = 'moved content'
             WHERE id = 'm-old';",
    )
    .execute(&mut *writer)
    .await
    .expect("write a new parent/child pair and move the old child");
    timeout(OPERATION_TIMEOUT, writer.commit())
        .await
        .expect("WAL writer must commit while the reader snapshot is still alive")
        .expect("commit the complete new generation");

    // The interleaving is deterministic: writer COMMIT completed, but this
    // owner has not finished. No sleeps or timing races arrange the boundary.
    let snapshot_messages = snapshot
        .read_table("chat_messages")
        .await
        .expect("read children from the same old snapshot");
    let sessions_again = snapshot
        .read_table("chat_sessions")
        .await
        .expect("reread parents from the same old snapshot");
    timeout(OPERATION_TIMEOUT, snapshot.finish())
        .await
        .expect("finish must release the snapshot connection")
        .expect("finish production snapshot");
    assert_connection_released(&reader_pool).await;

    let latest = timeout(
        OPERATION_TIMEOUT,
        read_backup_tables(&reader_pool, &["chat_sessions", "chat_messages"]),
    )
    .await
    .expect("a later public read can acquire the only reader connection")
    .expect("a new snapshot sees the committed writer generation");
    assert_connection_released(&reader_pool).await;

    // All transaction and connection owners have been consumed or dropped.
    // Close both pools before removing only this test's unique directory.
    reader_pool.close().await;
    writer_pool.close().await;
    fixture.remove_after_close();

    assert_eq!(journal_mode.to_ascii_lowercase(), "wal");
    assert_eq!(
        before_sessions,
        vec![json!({ "id": "s-old", "title": "old title" })]
    );
    assert_eq!(sessions_again, before_sessions);
    assert_eq!(
        snapshot_messages,
        vec![json!({ "id": "m-old", "session_id": "s-old", "content": "old content" })]
    );
    assert_eq!(
        sorted_rows(&latest["chat_sessions"]),
        vec![
            json!({ "id": "s-new", "title": "new title" }),
            json!({ "id": "s-old", "title": "changed title" }),
        ]
    );
    assert_eq!(
        sorted_rows(&latest["chat_messages"]),
        vec![
            json!({ "id": "m-new", "session_id": "s-new", "content": "new content" }),
            json!({ "id": "m-old", "session_id": "s-new", "content": "moved content" }),
        ]
    );
}
