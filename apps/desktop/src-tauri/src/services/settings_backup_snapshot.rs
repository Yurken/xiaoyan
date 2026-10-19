use crate::services::settings_service::row_to_json;
use futures_util::TryStreamExt;
use serde_json::{Map, Value};
use sqlx::{Sqlite, SqlitePool, Transaction};

/// One owner keeps every table read on the same connection and transaction.
/// The first SELECT establishes SQLite's snapshot; later table reads cannot
/// observe commits made by another connection while this reader is alive.
struct BackupSnapshot {
    tx: Transaction<'static, Sqlite>,
}

impl BackupSnapshot {
    async fn begin(pool: &SqlitePool) -> Result<Self, String> {
        let tx = pool
            .begin()
            .await
            .map_err(|error| format!("开始备份读取事务失败: {error}"))?;
        Ok(Self { tx })
    }

    async fn read_table(&mut self, table: &str) -> Result<Vec<Value>, String> {
        // Names come from the application's fixed backup table list, not input.
        let sql = format!("SELECT * FROM {table}");
        let mut rows = sqlx::query(&sql).fetch(&mut *self.tx);
        let mut values = Vec::new();
        while let Some(row) = rows
            .try_next()
            .await
            .map_err(|error| format!("导出表 {table} 失败: {error}"))?
        {
            // Convert each row immediately instead of retaining a second,
            // table-sized Vec<SqliteRow> alongside the JSON payload.
            values.push(
                row_to_json(&row)
                    .map_err(|error| format!("转换备份表 {table} 失败: {error}"))?,
            );
        }
        Ok(values)
    }

    async fn finish(self) -> Result<(), String> {
        self.tx
            .commit()
            .await
            .map_err(|error| format!("结束备份读取事务失败: {error}"))
    }
}

/// Read all requested tables before releasing the snapshot. No file reads,
/// serialization or encryption happen while a database connection is held.
pub(crate) async fn read_backup_tables(
    pool: &SqlitePool,
    table_names: &[&str],
) -> Result<Map<String, Value>, String> {
    let mut snapshot = BackupSnapshot::begin(pool).await?;
    let mut tables = Map::new();
    for &table in table_names {
        tables.insert(
            table.to_string(),
            Value::Array(snapshot.read_table(table).await?),
        );
    }
    snapshot.finish().await?;
    Ok(tables)
}

#[cfg(test)]
#[path = "settings_backup_snapshot_tests.rs"]
mod tests;
