use super::super::is_asset_table;
use std::collections::HashMap;

pub(super) async fn upsert_row(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    table: &str,
    pk: &str,
    row: &serde_json::Value,
    asset_paths: &HashMap<String, String>,
) -> Result<(), String> {
    let Some(obj) = row.as_object() else {
        return Ok(());
    };
    if obj.is_empty() {
        return Ok(());
    }

    // 解析资产引用为本地路径。
    let mut resolved = obj.clone();
    if is_asset_table(table) {
        if let Some(fp) = resolved.get("file_path").and_then(|v| v.as_str()) {
            if let Some(hash) = fp.strip_prefix("asset://") {
                let local = asset_paths.get(hash).cloned().unwrap_or_default();
                resolved.insert("file_path".into(), serde_json::Value::String(local));
            }
        }
    }

    let entries: Vec<(&String, &serde_json::Value)> = resolved.iter().collect();
    let columns: Vec<String> = entries.iter().map(|(k, _)| (*k).clone()).collect();
    let columns_str = columns.join(", ");
    let placeholders = vec!["?"; entries.len()].join(", ");
    let updates: Vec<String> = columns
        .iter()
        .filter(|c| c.as_str() != pk)
        .map(|c| format!("{c} = excluded.{c}"))
        .collect();

    let sql = if updates.is_empty() {
        format!(
            "INSERT INTO {table} ({columns_str}) VALUES ({placeholders})
             ON CONFLICT({pk}) DO NOTHING"
        )
    } else {
        format!(
            "INSERT INTO {table} ({columns_str}) VALUES ({placeholders})
             ON CONFLICT({pk}) DO UPDATE SET {}",
            updates.join(", ")
        )
    };

    let mut query = sqlx::query(&sql);
    for (_, value) in entries {
        query = match value {
            serde_json::Value::Null => query.bind(Option::<String>::None),
            serde_json::Value::String(v) => query.bind(v.clone()),
            serde_json::Value::Bool(v) => query.bind(if *v { 1_i64 } else { 0_i64 }),
            serde_json::Value::Number(v) => {
                if let Some(i) = v.as_i64() {
                    query.bind(i)
                } else if let Some(f) = v.as_f64() {
                    query.bind(f)
                } else {
                    query.bind(v.to_string())
                }
            }
            other => query.bind(other.to_string()),
        };
    }
    query
        .execute(&mut **tx)
        .await
        .map_err(|e| format!("写入 {table} 失败: {e}"))?;
    Ok(())
}
