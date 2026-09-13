//! Commands for viewing and editing durable assistant provenance.

use tauri::{command, State};

use crate::services::desktop_assistant::source_service::{
    AssistantSourceMetadata, AssistantSourceService,
};
use crate::state::AppState;

#[command]
pub async fn assistant_get_source_metadata(
    state: State<'_, AppState>,
    target: String,
    target_id: String,
) -> Result<Option<AssistantSourceMetadata>, String> {
    AssistantSourceService::get(&state.db, &target, &target_id)
        .await
        .map_err(|error| error.to_string())
}

#[command]
pub async fn assistant_update_source_metadata(
    state: State<'_, AppState>,
    target: String,
    target_id: String,
    source_app: Option<String>,
    window_title: Option<String>,
    source_title: Option<String>,
    source_url: Option<String>,
) -> Result<AssistantSourceMetadata, String> {
    AssistantSourceService::update(
        &state.db,
        &target,
        &target_id,
        source_app.as_deref(),
        window_title.as_deref(),
        source_title.as_deref(),
        source_url.as_deref(),
    )
    .await
    .map_err(|error| error.to_string())
}
