use tauri::command;
use crate::services::submission_diagnosis_service::{SubmissionDiagnosisService, DiagnosisTask, CreateTaskResponse};

#[command]
pub fn submission_diagnosis_get_tasks(submission_id: String) -> Result<Vec<DiagnosisTask>, String> {
    SubmissionDiagnosisService::get_diagnosis_tasks(&submission_id)
}

#[command]
pub fn submission_diagnosis_create_task(diagnosis_id: String) -> Result<CreateTaskResponse, String> {
    SubmissionDiagnosisService::create_task_from_diagnosis(&diagnosis_id)
}
