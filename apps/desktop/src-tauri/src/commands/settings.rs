use crate::services::settings_service;
use crate::state::AppState;
use std::collections::HashMap;
use tauri::State;

#[tauri::command]
pub async fn settings_get(state: State<'_, AppState>) -> Result<HashMap<String, String>, String> {
    settings_service::get_exposed_settings(state.inner()).await
}

#[tauri::command]
pub async fn settings_update(
    state: State<'_, AppState>,
    data: serde_json::Value,
) -> Result<serde_json::Value, String> {
    let updated = settings_service::update_settings(state.inner(), &data).await?;
    Ok(serde_json::json!({ "ok": true, "updated": updated }))
}

#[tauri::command]
pub async fn settings_export(
    state: State<'_, AppState>,
    password: String,
) -> Result<String, String> {
    settings_service::export_settings(state.inner(), &password).await
}

#[tauri::command]
pub async fn settings_import(
    state: State<'_, AppState>,
    data: String,
    password: String,
) -> Result<Vec<String>, String> {
    settings_service::import_settings(state.inner(), &data, &password).await
}

#[tauri::command]
pub async fn settings_test(
    state: State<'_, AppState>,
    data: serde_json::Value,
) -> Result<String, String> {
    settings_service::test_settings(state.inner(), &data).await
}

#[tauri::command]
pub async fn settings_test_vision(
    state: State<'_, AppState>,
    data: serde_json::Value,
) -> Result<String, String> {
    settings_service::test_vision_settings(state.inner(), &data).await
}

#[tauri::command]
pub async fn settings_list_ollama_models(base_url: Option<String>) -> Result<Vec<String>, String> {
    settings_service::list_ollama_models(base_url).await
}

#[tauri::command]
pub async fn settings_list_models(
    state: State<'_, AppState>,
    data: serde_json::Value,
) -> Result<Vec<String>, String> {
    settings_service::list_models(state.inner(), &data).await
}

#[tauri::command]
pub async fn settings_test_tavily(
    state: State<'_, AppState>,
    data: serde_json::Value,
) -> Result<Vec<settings_service::TavilyKeyTest>, String> {
    settings_service::test_tavily(state.inner(), &data).await
}

#[tauri::command]
pub async fn settings_history_list(
    state: State<'_, AppState>,
) -> Result<Vec<settings_service::SettingsHistoryEntry>, String> {
    settings_service::list_settings_history_entries(state.inner()).await
}

#[tauri::command]
pub async fn settings_history_save(
    state: State<'_, AppState>,
    data: serde_json::Value,
    name: Option<String>,
) -> Result<settings_service::SettingsHistoryEntry, String> {
    settings_service::save_settings_history_entry(state.inner(), &data, name.as_deref()).await
}

#[tauri::command]
pub async fn settings_history_update(
    state: State<'_, AppState>,
    id: String,
    data: serde_json::Value,
    name: Option<String>,
) -> Result<settings_service::SettingsHistoryEntry, String> {
    settings_service::update_settings_history_entry(state.inner(), &id, &data, name.as_deref()).await
}

#[tauri::command]
pub async fn settings_history_apply(
    state: State<'_, AppState>,
    id: String,
) -> Result<HashMap<String, String>, String> {
    settings_service::apply_settings_history_entry(state.inner(), &id).await
}

#[tauri::command]
pub async fn settings_history_delete(state: State<'_, AppState>, id: String) -> Result<(), String> {
    settings_service::delete_settings_history_entry(state.inner(), &id).await
}
