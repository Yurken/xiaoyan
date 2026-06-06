use tauri::{command, State};
use crate::services::submission_diagnosis_service::{SubmissionDiagnosisService, DiagnosisTask, CreateTaskResponse};
use crate::state::AppState;

#[command]
pub async fn submission_diagnosis_get_tasks(
    state: State<'_, AppState>,
    submission_id: String,
) -> Result<Vec<DiagnosisTask>, String> {
    SubmissionDiagnosisService::get_diagnosis_tasks(&state.db, &submission_id).await
}

#[command]
pub async fn submission_diagnosis_create_task(
    state: State<'_, AppState>,
    submission_id: String,
    diagnosis_id: String,
) -> Result<CreateTaskResponse, String> {
    SubmissionDiagnosisService::create_task_from_diagnosis(&state.db, &submission_id, &diagnosis_id).await
}
