use crate::services::evidence_service::{EvidenceLink, EvidenceService};
use crate::state::AppState;
use tauri::{command, State};

#[command]
pub async fn evidence_get_links(
    state: State<'_, AppState>,
    target_id: String,
    target_type: String,
) -> Result<Vec<EvidenceLink>, String> {
    EvidenceService::get_links(&state.db, &target_id, &target_type).await
}
