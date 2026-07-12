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
    pub has_saved_credentials: bool,
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
    let url = url.trim().trim_end_matches('/').to_string();
    let username = username.trim().to_string();
    let password = if password.trim().is_empty() {
        let Some(saved) = secure_store::load()? else {
            return Err("请填写 WebDAV 密码".to_string());
        };
        if saved.url != url || saved.username != username {
            return Err("服务器地址或用户名已变更，请填写 WebDAV 密码".to_string());
        }
        saved.password
    } else {
        password
    };
    let config = WebdavConfig {
        url,
        username,
        password,
    };
    webdav_service::test_connection(&config).await?;

    secure_store::save(&SyncCredentials {
        url: config.url.clone(),
        username: config.username.clone(),
        password: config.password.clone(),
        enabled: true,
    })?;

    {
        let mut s = state.sync_status.write().await;
        s.configured = true;
    }

    match sync_service::run_manual_sync(state.inner(), &app).await? {
        Some(summary) => Ok(summary),
        None => Err("同步正在进行中，请稍候".to_string()),
    }
}

/// 返回当前同步配置（不含密码）。
#[tauri::command]
pub async fn sync_get_config() -> Result<SyncConfigView, String> {
    match secure_store::load()? {
        Some(creds) => Ok(SyncConfigView {
            configured: creds.enabled,
            has_saved_credentials: true,
            url: creds.url,
            username: creds.username,
        }),
        None => Ok(SyncConfigView {
            configured: false,
            has_saved_credentials: false,
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
    sync_service::run_manual_sync(state.inner(), &app).await
}

/// 停用同步，但保留钥匙串中的凭据，便于之后无需重新填写即可启用。
#[tauri::command]
pub async fn sync_disable(state: State<'_, AppState>) -> Result<(), String> {
    if let Some(mut creds) = secure_store::load()? {
        creds.enabled = false;
        secure_store::save(&creds)?;
    }
    let mut s = state.sync_status.write().await;
    s.configured = false;
    s.last_message = None;
    s.last_error = None;
    Ok(())
}
