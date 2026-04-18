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
pub async fn settings_list_ollama_models(base_url: Option<String>) -> Result<Vec<String>, String> {
    settings_service::list_ollama_models(base_url).await
}
