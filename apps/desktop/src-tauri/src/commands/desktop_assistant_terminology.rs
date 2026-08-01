//! 桌面助手稳定术语偏好命令。

use tauri::{command, Emitter, State};

use crate::services::desktop_assistant::terminology_service::{
    AssistantTerminologyPreference, AssistantTerminologyService,
};
use crate::state::AppState;

const TERMINOLOGY_CHANGED_EVENT: &str = "assistant://terminology-preferences-changed";

#[command]
pub async fn assistant_list_terminology_preferences(
    state: State<'_, AppState>,
) -> Result<Vec<AssistantTerminologyPreference>, String> {
    AssistantTerminologyService::list(&state.db)
        .await
        .map_err(|error| error.to_string())
}

#[command]
pub async fn assistant_save_terminology_preference(
    state: State<'_, AppState>,
    app: tauri::AppHandle,
    source_term: String,
    preferred_translation: String,
    target_language: String,
) -> Result<Vec<AssistantTerminologyPreference>, String> {
    let preferences = AssistantTerminologyService::save(
        &state.db,
        &source_term,
        &preferred_translation,
        &target_language,
    )
    .await
    .map_err(|error| error.to_string())?;
    app.emit(TERMINOLOGY_CHANGED_EVENT, &preferences)
        .map_err(|error| format!("术语偏好已保存，但跨窗口同步失败：{error}"))?;
    Ok(preferences)
}

#[command]
pub async fn assistant_delete_terminology_preference(
    state: State<'_, AppState>,
    app: tauri::AppHandle,
    source_term: String,
    target_language: String,
) -> Result<Vec<AssistantTerminologyPreference>, String> {
    let preferences =
        AssistantTerminologyService::delete(&state.db, &source_term, &target_language)
            .await
            .map_err(|error| error.to_string())?;
    app.emit(TERMINOLOGY_CHANGED_EVENT, &preferences)
        .map_err(|error| format!("术语偏好已删除，但跨窗口同步失败：{error}"))?;
    Ok(preferences)
}
