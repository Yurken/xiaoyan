use crate::state::default_settings;
use sqlx::{Sqlite, Transaction};
use std::collections::HashMap;
use tokio::sync::RwLock;

/// Read the final settings on the restoring transaction before committing it.
/// After commit there is no fallible SQL read that could turn a completed restore
/// into a reported readback failure. File restoration is outside this boundary.
pub(crate) async fn commit_restored_settings(
    mut tx: Transaction<'_, Sqlite>,
    settings: &RwLock<HashMap<String, String>>,
) -> Result<(), String> {
    let rows = sqlx::query_as::<_, (String, String)>("SELECT key, value FROM settings")
        .fetch_all(&mut *tx)
        .await
        .map_err(|error| format!("读取恢复后的设置失败: {error}"))?;

    // Keep raw values, including unknown keys, secrets and explicit empty strings.
    // This is the internal cache, not the masked settings API response.
    let mut restored_settings = default_settings();
    restored_settings.extend(rows);

    tx.commit()
        .await
        .map_err(|error| format!("提交备份恢复失败: {error}"))?;

    *settings.write().await = restored_settings;
    Ok(())
}

#[cfg(test)]
#[path = "settings_backup_commit_tests.rs"]
mod tests;
