//! Main-window commands for the desktop-assistant inbox.

use tauri::{command, Manager, State};

use crate::commands::papers::papers_upload;
use crate::services::desktop_assistant::inbox_service::{
    AssistantInboxActionResult, AssistantInboxOverview, AssistantInboxService,
};
use crate::state::AppState;

use super::desktop_assistant::ensure_assistant_enabled;

#[command]
pub async fn assistant_inbox_list(
    state: State<'_, AppState>,
) -> Result<AssistantInboxOverview, String> {
    ensure_assistant_enabled()?;
    AssistantInboxService::list(&state.db)
        .await
        .map_err(|error| error.to_string())
}

#[command]
pub async fn assistant_inbox_convert_later(
    state: State<'_, AppState>,
    item_id: String,
    research_theme_id: Option<String>,
) -> Result<AssistantInboxActionResult, String> {
    ensure_assistant_enabled()?;
    AssistantInboxService::convert_later_to_note(&state.db, &item_id, research_theme_id.as_deref())
        .await
        .map_err(|error| error.to_string())
}

#[command]
pub async fn assistant_inbox_discard_later(
    state: State<'_, AppState>,
    item_id: String,
) -> Result<(), String> {
    ensure_assistant_enabled()?;
    AssistantInboxService::discard_later(&state.db, &item_id)
        .await
        .map_err(|error| error.to_string())
}

#[command]
pub async fn assistant_inbox_import_paper(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    candidate_id: String,
    research_theme_id: Option<String>,
) -> Result<AssistantInboxActionResult, String> {
    ensure_assistant_enabled()?;
    let theme = AssistantInboxService::validate_theme(&state.db, research_theme_id.as_deref())
        .await
        .map_err(|error| error.to_string())?;
    let db = state.db.clone();
    let candidate = AssistantInboxService::claim_paper(&db, &candidate_id)
        .await
        .map_err(|error| error.to_string())?;
    let upload = papers_upload(
        app,
        state,
        tauri_plugin_fs::FilePath::Path(candidate.file_path),
        theme.clone(),
        Some(candidate.title),
    )
    .await;
    let response = match upload {
        Ok(response) => response,
        Err(error) => {
            let _ = AssistantInboxService::restore_paper(&db, &candidate.id).await;
            return Err(error);
        }
    };
    let paper_id = response
        .get("paper_id")
        .and_then(serde_json::Value::as_str)
        .ok_or_else(|| "论文导入完成，但返回结果缺少论文标识".to_string())?;
    AssistantInboxService::complete_paper(&db, &candidate.id, paper_id, theme.as_deref())
        .await
        .map_err(|error| error.to_string())?;
    Ok(AssistantInboxActionResult {
        target: "paper".to_string(),
        target_id: paper_id.to_string(),
    })
}

#[command]
pub async fn assistant_inbox_discard_paper(
    state: State<'_, AppState>,
    candidate_id: String,
) -> Result<(), String> {
    ensure_assistant_enabled()?;
    AssistantInboxService::discard_paper(&state.db, &candidate_id)
        .await
        .map_err(|error| error.to_string())
}

#[command]
pub async fn assistant_inbox_import_file(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    candidate_id: String,
    research_theme_id: Option<String>,
) -> Result<AssistantInboxActionResult, String> {
    ensure_assistant_enabled()?;
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    AssistantInboxService::import_file(
        &state.db,
        &app_data_dir,
        &candidate_id,
        research_theme_id.as_deref(),
    )
    .await
    .map_err(|error| error.to_string())
}

#[command]
pub async fn assistant_inbox_discard_file(
    state: State<'_, AppState>,
    candidate_id: String,
) -> Result<(), String> {
    ensure_assistant_enabled()?;
    AssistantInboxService::discard_file(&state.db, &candidate_id)
        .await
        .map_err(|error| error.to_string())
}
