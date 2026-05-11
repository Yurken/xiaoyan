use crate::services::settings_service::{export_all_data, import_all_data};
use crate::state::AppState;
use tauri::State;

#[tauri::command]
pub async fn data_backup_export(
    state: State<'_, AppState>,
    password: String,
) -> Result<String, String> {
    export_all_data(state.inner(), &password).await
}

#[tauri::command]
pub async fn data_backup_import(
    state: State<'_, AppState>,
    data: String,
    password: String,
) -> Result<(), String> {
    import_all_data(state.inner(), &data, &password).await
}
