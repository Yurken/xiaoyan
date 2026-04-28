use sqlx::{Row, SqlitePool};
use std::collections::HashMap;

#[derive(Debug, Clone)]
pub struct SettingsHistoryRow {
    pub id: String,
    pub name: String,
    pub settings_json: String,
    pub created_at: String,
}

pub async fn load_all_settings(pool: &SqlitePool) -> Result<HashMap<String, String>, String> {
    let rows = sqlx::query("SELECT key, value FROM settings")
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;

    let mut map = HashMap::new();
    for row in rows {
        let key: String = row.get("key");
        let value: String = row.get("value");
        map.insert(key, value);
    }

    Ok(map)
}

pub async fn upsert_settings(
    pool: &SqlitePool,
    to_save: &HashMap<String, String>,
) -> Result<(), String> {
    if to_save.is_empty() {
        return Ok(());
    }

    let now = chrono::Utc::now().to_rfc3339();
    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;
    for (key, value) in to_save {
        sqlx::query(
            "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
        )
        .bind(key)
        .bind(value)
        .bind(&now)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    }
    tx.commit().await.map_err(|e| e.to_string())
}

pub async fn insert_settings_history(
    pool: &SqlitePool,
    id: &str,
    name: &str,
    settings_json: &str,
    created_at: &str,
) -> Result<(), String> {
    sqlx::query(
        "INSERT INTO settings_history (id, name, settings_json, created_at)
         VALUES (?, ?, ?, ?)",
    )
    .bind(id)
    .bind(name)
    .bind(settings_json)
    .bind(created_at)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

pub async fn list_settings_history(pool: &SqlitePool) -> Result<Vec<SettingsHistoryRow>, String> {
    let rows = sqlx::query(
        "SELECT id, name, settings_json, created_at
         FROM settings_history
         ORDER BY created_at DESC",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows
        .into_iter()
        .map(|row| SettingsHistoryRow {
            id: row.get("id"),
            name: row.get("name"),
            settings_json: row.get("settings_json"),
            created_at: row.get("created_at"),
        })
        .collect())
}

pub async fn get_settings_history(
    pool: &SqlitePool,
    id: &str,
) -> Result<Option<SettingsHistoryRow>, String> {
    let row = sqlx::query(
        "SELECT id, name, settings_json, created_at
         FROM settings_history
         WHERE id = ?",
    )
    .bind(id)
    .fetch_optional(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(row.map(|item| SettingsHistoryRow {
        id: item.get("id"),
        name: item.get("name"),
        settings_json: item.get("settings_json"),
        created_at: item.get("created_at"),
    }))
}

pub async fn delete_settings_history(pool: &SqlitePool, id: &str) -> Result<bool, String> {
    let result = sqlx::query("DELETE FROM settings_history WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(result.rows_affected() > 0)
}
