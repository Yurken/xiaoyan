//! Commands for managing durable image assets created by the desktop assistant.

use serde::{Deserialize, Serialize};
use tauri::{command, Emitter, Manager, State};

use crate::services::desktop_assistant::image_asset_service::{
    AssistantImageAsset, AssistantImageAssetService,
};
use crate::services::desktop_assistant::private_data_service::AssistantPrivateDataService;
use crate::state::AppState;

use super::desktop_assistant::ensure_assistant_enabled;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AssistantPrivateDataClearResult {
    pub capture_sessions: u32,
    pub image_assets: u32,
    pub file_previews: u32,
    pub cancelled_actions: u32,
}

#[command]
pub async fn assistant_list_image_assets(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<Vec<AssistantImageAsset>, String> {
    ensure_assistant_enabled()?;
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    AssistantImageAssetService::list(&state.db, &app_data_dir)
        .await
        .map_err(|error| error.to_string())
}

#[command]
pub async fn assistant_delete_image_asset(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    asset_id: String,
) -> Result<(), String> {
    ensure_assistant_enabled()?;
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    AssistantImageAssetService::delete(&state.db, &app_data_dir, &asset_id)
        .await
        .map_err(|error| error.to_string())
}

#[command]
pub async fn assistant_clear_private_data(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<AssistantPrivateDataClearResult, String> {
    // Block new stream registrations, then stop and join every active stream
    // before deleting rows so no cancelled task can write private metrics later.
    let _clear_guard = state.assistant_action_lifecycle.write().await;
    let actions = std::mem::take(&mut *state.assistant_action_handles.lock().await);
    let cancelled_actions = actions.len().min(u32::MAX as usize) as u32;
    for handle in actions.values() {
        handle.abort();
    }
    for (_, handle) in actions {
        let _ = handle.await;
    }

    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    let cleared = AssistantPrivateDataService::clear(&state.db, &app_data_dir)
        .await
        .map_err(|error| error.to_string())?;

    let result = AssistantPrivateDataClearResult {
        capture_sessions: cleared.capture_sessions,
        image_assets: cleared.image_assets,
        file_previews: cleared.file_previews,
        cancelled_actions,
    };
    app.emit("assistant://private-data-cleared", &result)
        .map_err(|error| format!("数据已清理，但同步到悬浮面板失败：{error}"))?;
    Ok(result)
}
