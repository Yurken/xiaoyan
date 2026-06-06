use tauri::command;
use crate::services::evidence_service::{EvidenceService, EvidenceLink};

#[command]
pub fn evidence_get_links(target_id: String, target_type: String) -> Result<Vec<EvidenceLink>, String> {
    EvidenceService::get_links(&target_id, &target_type)
}
