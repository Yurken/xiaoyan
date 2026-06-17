//! 无冲突 WebDAV 同步对外命令。

use crate::services::secure_store::{self, SyncCredentials};
use crate::services::sync_service::{self, SyncStatus, SyncSummary};
use crate::services::webdav_service::{self, WebdavConfig};
use crate::state::AppState;
use serde::Serialize;
use tauri::State;

#[derive(Debug, Serialize)]
pub struct SyncConfigView {
    pub configured: bool,
    pub url: String,
    pub username: String,
}

/// 配置并启用自动同步：校验连接、存入系统钥匙串，并立即跑一次同步。
#[tauri::command]
pub async fn sync_configure(
    state: State<'_, AppState>,
    app: tauri::AppHandle,
    url: String,
    username: String,
    password: String,
) -> Result<SyncSummary, String> {
    let config = WebdavConfig {
        url: url.trim().trim_end_matches('/').to_string(),
        username,
        password,
    };
    webdav_service::test_connection(&config).await?;

    secure_store::save(&SyncCredentials {
        url: config.url.clone(),
        username: config.username.clone(),
        password: config.password.clone(),
    })?;

    {
        let mut s = state.sync_status.write().await;
        s.configured = true;
    }

    match sync_service::run_sync(state.inner(), &app).await? {
        Some(summary) => Ok(summary),
        None => Err("同步正在进行中，请稍候".to_string()),
    }
}

/// 返回当前同步配置（不含密码）。
#[tauri::command]
pub async fn sync_get_config() -> Result<SyncConfigView, String> {
    match secure_store::load()? {
        Some(creds) => Ok(SyncConfigView {
            configured: true,
            url: creds.url,
            username: creds.username,
        }),
        None => Ok(SyncConfigView {
            configured: false,
            url: String::new(),
            username: String::new(),
        }),
    }
}

/// 当前同步状态（运行中 / 上次时间 / 错误等）。
#[tauri::command]
pub async fn sync_status(state: State<'_, AppState>) -> Result<SyncStatus, String> {
    Ok(sync_service::current_status(state.inner()).await)
}

/// 立即手动同步一次。
#[tauri::command]
pub async fn sync_now(
    state: State<'_, AppState>,
    app: tauri::AppHandle,
) -> Result<Option<SyncSummary>, String> {
    sync_service::run_sync(state.inner(), &app).await
}

/// 停用同步并清除钥匙串中的凭据。
#[tauri::command]
pub async fn sync_disable(state: State<'_, AppState>) -> Result<(), String> {
    secure_store::clear()?;
    let mut s = state.sync_status.write().await;
    s.configured = false;
    s.last_message = None;
    s.last_error = None;
    Ok(())
}
