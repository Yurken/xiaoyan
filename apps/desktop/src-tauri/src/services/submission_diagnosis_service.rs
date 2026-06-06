use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct DiagnosisTask {
    pub id: String,
    pub risk: String,
    pub suggestion: String,
    #[serde(rename = "isTaskCreated")]
    pub is_task_created: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateTaskResponse {
    #[serde(rename = "taskId")]
    pub task_id: String,
}

pub struct SubmissionDiagnosisService;

impl SubmissionDiagnosisService {
    pub fn get_diagnosis_tasks(_submission_id: &str) -> Result<Vec<DiagnosisTask>, String> {
        Ok(vec![
            DiagnosisTask {
                id: "diag_1".into(),
                risk: "实验部分缺少基线对比".into(),
                suggestion: "增加与 BERT 和 RoBERTa 的消融实验对比。".into(),
                is_task_created: false,
            },
            DiagnosisTask {
                id: "diag_2".into(),
                risk: "引用格式不统一".into(),
                suggestion: "请统一为 APA 格式，尤其是第 3 节的几个引用。".into(),
                is_task_created: true,
            },
        ])
    }

    pub fn create_task_from_diagnosis(diagnosis_id: &str) -> Result<CreateTaskResponse, String> {
        Ok(CreateTaskResponse {
            task_id: format!("task_from_{}", diagnosis_id),
        })
    }
}


#[derive(Debug, Serialize, Deserialize)]
pub struct ReviewerDiagnosisInput {
    pub reviewer: String,
    pub raw: String,
}

pub async fn save_ai_review_diagnosis_report(
    _db: &sqlx::SqlitePool,
    _submission_id: &str,
    _paper_text: &str,
    _reviews: &[ReviewerDiagnosisInput],
) -> Result<Vec<String>, String> {
    Ok(_reviews.iter().map(|r| format!("diag_{}", r.reviewer)).collect())
}

pub async fn list_submission_diagnosis_reports(
    _db: &sqlx::SqlitePool,
    _submission_id: &str,
) -> Result<serde_json::Value, String> {
    Ok(serde_json::json!([]))
}

pub async fn import_diagnosis_report_to_checklist(
    _db: &sqlx::SqlitePool,
    _report_id: &str,
) -> Result<Vec<String>, String> {
    Ok(vec![])
}

pub fn collect_issue_labels(_report: &serde_json::Value) -> Vec<String> {
    vec![]
}
