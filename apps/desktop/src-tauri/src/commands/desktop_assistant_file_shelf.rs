use tauri::{command, AppHandle, Emitter, Manager, State};

use crate::{
    services::desktop_assistant::file_shelf_service::{
        read_file_paths_from_clipboard, FileShelfItem, FileShelfService, FileShelfStashResult,
    },
    state::AppState,
};

use super::desktop_assistant::ensure_assistant_enabled;

const CHANGED_EVENT: &str = "assistant://file-shelf-changed";

#[command]
pub async fn assistant_file_shelf_list(
    state: State<'_, AppState>,
) -> Result<Vec<FileShelfItem>, String> {
    ensure_assistant_enabled()?;
    FileShelfService::list(&state.db)
        .await
        .map_err(|error| error.to_string())
}

#[command]
pub async fn assistant_file_shelf_stash_paths(
    app: AppHandle,
    state: State<'_, AppState>,
    paths: Vec<String>,
    source_type: String,
) -> Result<FileShelfStashResult, String> {
    ensure_assistant_enabled()?;
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    let result = FileShelfService::stash_paths(&state.db, &app_data_dir, paths, &source_type)
        .await
        .map_err(|error| error.to_string())?;
    if !result.items.is_empty() {
        app.emit(CHANGED_EVENT, result.items.len())
            .map_err(|error| error.to_string())?;
    }
    Ok(result)
}

#[command]
pub async fn assistant_file_shelf_stash_clipboard(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<FileShelfStashResult, String> {
    ensure_assistant_enabled()?;
    let paths = tokio::task::spawn_blocking(read_file_paths_from_clipboard)
        .await
        .map_err(|error| format!("读取剪贴板任务失败：{error}"))?
        .map_err(|error| error.to_string())?;
    if paths.is_empty() {
        return Err("剪贴板里没有可暂存的文件或文件夹".to_string());
    }
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    let result = FileShelfService::stash_paths(&state.db, &app_data_dir, paths, "clipboard")
        .await
        .map_err(|error| error.to_string())?;
    if !result.items.is_empty() {
        app.emit(CHANGED_EVENT, result.items.len())
            .map_err(|error| error.to_string())?;
    }
    Ok(result)
}

#[command]
pub async fn assistant_file_shelf_copy(
    app: AppHandle,
    state: State<'_, AppState>,
    item_ids: Vec<String>,
) -> Result<usize, String> {
    ensure_assistant_enabled()?;
    let count = FileShelfService::copy_to_clipboard(&state.db, item_ids)
        .await
        .map_err(|error| error.to_string())?;
    app.emit(CHANGED_EVENT, 0_usize)
        .map_err(|error| error.to_string())?;
    Ok(count)
}

#[command]
pub async fn assistant_file_shelf_remove(
    app: AppHandle,
    state: State<'_, AppState>,
    item_ids: Vec<String>,
) -> Result<usize, String> {
    ensure_assistant_enabled()?;
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    let count = FileShelfService::remove(&state.db, &app_data_dir, item_ids)
        .await
        .map_err(|error| error.to_string())?;
    app.emit(CHANGED_EVENT, 0_usize)
        .map_err(|error| error.to_string())?;
    Ok(count)
}

#[command]
pub async fn assistant_file_shelf_reveal(
    state: State<'_, AppState>,
    item_id: String,
) -> Result<(), String> {
    ensure_assistant_enabled()?;
    FileShelfService::reveal(&state.db, item_id)
        .await
        .map_err(|error| error.to_string())
}
