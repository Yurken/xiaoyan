//! Database-only boundaries for sync. Files, encryption and network calls stay
//! outside these transactions so waiting for remote I/O never holds the writer.
use super::{
    effective_ts, is_excluded_column, is_local_only_settings_key, is_newer_timestamp,
    now_rfc3339, pk_column, ts_column, MergePlan, Tombstone, BACKUP_TABLES,
};
use crate::services::settings_service::row_to_json;
use futures_util::TryStreamExt;
use serde_json::Value;
use sqlx::{Sqlite, SqlitePool, Transaction};
use std::collections::{BTreeMap, HashMap, HashSet};

#[path = "sync_merge_row.rs"]
mod merge_row;

async fn begin_local_change(db: &SqlitePool) -> Result<Transaction<'static, Sqlite>, String> {
    // Reserve the writer before reading any timestamp or deletion baseline.
    // A deferred transaction could otherwise need a stale read-to-write upgrade.
    db.begin_with("BEGIN IMMEDIATE")
        .await
        .map_err(|error| format!("开始本地同步事务失败: {error}"))
}

async fn current_ids(
    tx: &mut Transaction<'_, Sqlite>,
    table: &str,
) -> Result<HashSet<String>, String> {
    let pk = pk_column(table);
    sqlx::query_scalar::<_, String>(&format!("SELECT {pk} FROM {table}"))
        .fetch_all(&mut **tx)
        .await
        .map(|ids| ids.into_iter().collect())
        .map_err(|error| format!("读取 {table} 主键失败: {error}"))
}

async fn save_baseline(
    tx: &mut Transaction<'_, Sqlite>,
    table: &str,
    ids: HashSet<String>,
) -> Result<(), String> {
    let mut ids: Vec<String> = ids.into_iter().collect();
    ids.sort_unstable();
    let json = serde_json::to_string(&ids).map_err(|error| error.to_string())?;
    sqlx::query(
        "INSERT INTO sync_meta (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .bind(format!("baseline:{table}"))
    .bind(json)
    .execute(&mut **tx)
    .await
    .map_err(|error| error.to_string())?;
    Ok(())
}

async fn tombstone_timestamp(
    tx: &mut Transaction<'_, Sqlite>,
    table: &str,
    id: &str,
) -> Result<Option<String>, String> {
    sqlx::query_scalar::<_, String>(
        "SELECT deleted_at FROM sync_tombstones WHERE entity_table = ? AND entity_id = ?",
    )
    .bind(table)
    .bind(id)
    .fetch_optional(&mut **tx)
    .await
    .map_err(|error| error.to_string())
}

async fn store_tombstone(
    tx: &mut Transaction<'_, Sqlite>,
    table: &str,
    id: &str,
    deleted_at: &str,
) -> Result<(), String> {
    let current = tombstone_timestamp(tx, table, id).await?;
    if current
        .as_deref()
        .is_some_and(|current| !is_newer_timestamp(deleted_at, current))
    {
        return Ok(());
    }
    sqlx::query(
        "INSERT INTO sync_tombstones (entity_table, entity_id, deleted_at) VALUES (?, ?, ?)
         ON CONFLICT(entity_table, entity_id) DO UPDATE SET deleted_at = excluded.deleted_at",
    )
    .bind(table)
    .bind(id)
    .bind(deleted_at)
    .execute(&mut **tx)
    .await
    .map_err(|error| error.to_string())?;
    Ok(())
}

/// A baseline is the last local observation, not an upload acknowledgement.
/// Advancing it with the tombstones prevents repeat observations from dating
/// the same deletion again, while a later restore/delete can advance its clock.
async fn checkpoint_in_tx(tx: &mut Transaction<'_, Sqlite>) -> Result<(), String> {
    let deleted_at = now_rfc3339();
    for &table in BACKUP_TABLES {
        let current = current_ids(tx, table).await?;
        let baseline = sqlx::query_scalar::<_, String>("SELECT value FROM sync_meta WHERE key = ?")
            .bind(format!("baseline:{table}"))
            .fetch_optional(&mut **tx)
            .await
            .map_err(|error| error.to_string())?;
        if let Some(json) = baseline {
            let baseline: HashSet<String> = serde_json::from_str(&json)
                .map_err(|error| format!("读取 {table} 同步基线失败: {error}"))?;
            for gone in baseline.difference(&current) {
                store_tombstone(tx, table, gone, &deleted_at).await?;
            }
        }
        save_baseline(tx, table, current).await?;
    }
    Ok(())
}

/// The no-remote path must also record deletes made while awaiting the network.
pub(super) async fn checkpoint_local_deletes(db: &SqlitePool) -> Result<(), String> {
    let mut tx = begin_local_change(db).await?;
    checkpoint_in_tx(&mut tx).await?;
    tx.commit().await.map_err(|error| error.to_string())
}

async fn read_tombstones(tx: &mut Transaction<'_, Sqlite>) -> Result<Vec<Tombstone>, String> {
    sqlx::query_as::<_, (String, String, String)>(
        "SELECT entity_table, entity_id, deleted_at FROM sync_tombstones",
    )
    .fetch_all(&mut **tx)
    .await
    .map(|rows| {
        rows.into_iter()
            .map(|(table, id, deleted_at)| Tombstone {
                table,
                id,
                deleted_at,
            })
            .collect()
    })
    .map_err(|error| error.to_string())
}

/// Capture rows, tombstones and their baseline under the same writer reservation.
/// Stream and discard excluded columns before retaining each JSON row.
pub(super) async fn capture_local_state(
    db: &SqlitePool,
) -> Result<(BTreeMap<String, Vec<Value>>, Vec<Tombstone>), String> {
    let mut tx = begin_local_change(db).await?;
    checkpoint_in_tx(&mut tx).await?;
    let mut tables = BTreeMap::new();
    for &table in BACKUP_TABLES {
        let sql = format!("SELECT * FROM {table}");
        let mut rows = sqlx::query(&sql).fetch(&mut *tx);
        let mut values = Vec::new();
        while let Some(row) = rows
            .try_next()
            .await
            .map_err(|error| format!("导出 {table} 失败: {error}"))?
        {
            let Value::Object(mut object) = row_to_json(&row)? else {
                continue;
            };
            if table == "settings"
                && object
                    .get("key")
                    .and_then(Value::as_str)
                    .is_some_and(is_local_only_settings_key)
            {
                continue;
            }
            object.retain(|column, _| !is_excluded_column(table, column));
            values.push(Value::Object(object));
        }
        tables.insert(table.to_string(), values);
    }
    let tombstones = read_tombstones(&mut tx).await?;
    tx.commit().await.map_err(|error| error.to_string())?;
    Ok((tables, tombstones))
}

async fn row_timestamp(
    tx: &mut Transaction<'_, Sqlite>,
    table: &str,
    id: &str,
) -> Result<Option<String>, String> {
    let pk = pk_column(table);
    let clock = ts_column(table);
    sqlx::query_scalar::<_, Option<String>>(&format!(
        "SELECT {clock} FROM {table} WHERE {pk} = ?"
    ))
    .bind(id)
    .fetch_optional(&mut **tx)
    .await
    .map(|timestamp| timestamp.map(Option::unwrap_or_default))
    .map_err(|error| format!("读取 {table} 时间戳失败: {error}"))
}

/// Decisions and writes use the same transaction, including local deletions
/// observed after outbound capture. No pre-transaction timestamp cache is used.
pub(super) async fn apply_merge(
    db: &SqlitePool,
    plan: &MergePlan,
    asset_paths: &HashMap<String, String>,
) -> Result<(usize, usize), String> {
    let mut tx = begin_local_change(db).await?;
    sqlx::query("PRAGMA defer_foreign_keys = ON")
        .execute(&mut *tx)
        .await
        .map_err(|error| error.to_string())?;
    checkpoint_in_tx(&mut tx).await?;
    for ((table, id), deleted_at) in &plan.tombstones {
        store_tombstone(&mut tx, table, id, deleted_at).await?;
    }

    let mut applied = 0usize;
    let mut deleted = 0usize;
    // Include persisted local tombstones as well as those just received.
    for tombstone in read_tombstones(&mut tx).await? {
        let table = &tombstone.table;
        // Preserve unknown-version tombstones without interpolating their table
        // names into SQL. Only the application's fixed table list is executable.
        if !BACKUP_TABLES.contains(&table.as_str()) {
            continue;
        }
        let id = &tombstone.id;
        let local = row_timestamp(&mut tx, table, id).await?;
        if local
            .as_deref()
            .is_some_and(|timestamp| !is_newer_timestamp(timestamp, &tombstone.deleted_at))
        {
            let pk = pk_column(table);
            deleted += sqlx::query(&format!("DELETE FROM {table} WHERE {pk} = ?"))
                .bind(id)
                .execute(&mut *tx)
                .await
                .map_err(|error| format!("删除 {table} 失败: {error}"))?
                .rows_affected() as usize;
        }
    }

    // Parent tables precede children. Query again for each row because earlier
    // operations in this transaction may also have changed it through cascades.
    for &table in BACKUP_TABLES {
        let Some(bucket) = plan.rows.get(table) else {
            continue;
        };
        for (id, row) in bucket {
            let remote = effective_ts(table, row);
            let deleted_at = tombstone_timestamp(&mut tx, table, id).await?;
            if deleted_at
                .as_deref()
                .is_some_and(|deleted_at| !is_newer_timestamp(&remote, deleted_at))
            {
                continue;
            }
            let local = row_timestamp(&mut tx, table, id).await?;
            if local
                .as_deref()
                .is_some_and(|local| !is_newer_timestamp(&remote, local))
            {
                continue;
            }
            merge_row::upsert_row(&mut tx, table, pk_column(table), row, asset_paths).await?;
            applied += 1;
        }
    }

    // These changes came from the merge, so do not create local tombstones for
    // them. The next local deletion will be compared with this committed state.
    for &table in BACKUP_TABLES {
        let ids = current_ids(&mut tx, table).await?;
        save_baseline(&mut tx, table, ids).await?;
    }
    tx.commit().await.map_err(|error| error.to_string())?;
    Ok((applied, deleted))
}

#[cfg(test)]
#[path = "sync_local_state_tests.rs"]
mod tests;
