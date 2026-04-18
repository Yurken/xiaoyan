use std::sync::Mutex;

use reqwest::Url;
use serde::Serialize;
use tauri::{AppHandle, State};
use tauri_plugin_updater::{Update, UpdaterExt};

fn updater_endpoint() -> Option<String> {
    option_env!("RC_UPDATE_ENDPOINT")
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

fn updater_pubkey() -> Option<String> {
    option_env!("RC_UPDATE_PUBLIC_KEY")
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

#[derive(Default)]
pub struct PendingUpdate(pub Mutex<Option<Update>>);

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppUpdateInfo {
    pub configured: bool,
    pub available: bool,
    pub current_version: String,
    pub version: Option<String>,
    pub body: Option<String>,
    pub pub_date: Option<String>,
}

#[tauri::command]
pub async fn update_check(
    app: AppHandle,
    pending_update: State<'_, PendingUpdate>,
) -> Result<AppUpdateInfo, String> {
    let current_version = app.package_info().version.to_string();
    let mut updater_builder = app.updater_builder();
    if let Some(pubkey) = updater_pubkey() {
        updater_builder = updater_builder.pubkey(pubkey);
    }
    if let Some(endpoint) = updater_endpoint() {
        let endpoint =
            Url::parse(&endpoint).map_err(|error| format!("invalid update endpoint: {error}"))?;
        updater_builder = updater_builder
            .endpoints(vec![endpoint])
            .map_err(|error| error.to_string())?;
    }
    let updater = updater_builder.build().map_err(|error| error.to_string())?;

    let update = updater.check().await.map_err(|error| error.to_string())?;
    let info = if let Some(update_ref) = update.as_ref() {
        AppUpdateInfo {
            configured: true,
            available: true,
            current_version,
            version: Some(update_ref.version.clone()),
            body: update_ref.body.clone(),
            pub_date: update_ref.date.map(|value| value.to_string()),
        }
    } else {
        AppUpdateInfo {
            configured: true,
            available: false,
            current_version,
            version: None,
            body: None,
            pub_date: None,
        }
    };

    let mut guard = pending_update
        .0
        .lock()
        .map_err(|_| "failed to lock pending update state".to_string())?;
    *guard = update;

    Ok(info)
}

#[tauri::command]
pub async fn update_install(
    app: AppHandle,
    pending_update: State<'_, PendingUpdate>,
) -> Result<(), String> {
    let update = {
        let mut guard = pending_update
            .0
            .lock()
            .map_err(|_| "failed to lock pending update state".to_string())?;
        guard
            .take()
            .ok_or_else(|| "没有待安装的新版本，请先执行“检查更新”。".to_string())?
    };

    update
        .download_and_install(|_, _| {}, || {})
        .await
        .map_err(|error| error.to_string())?;
    app.restart();
    #[allow(unreachable_code)]
    Ok(())
}
