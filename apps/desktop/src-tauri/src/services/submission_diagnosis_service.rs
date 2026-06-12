use serde::{Deserialize, Serialize};
use sqlx::Row;

#[derive(Debug, Serialize, Deserialize)]
pub struct ReviewerDiagnosisInput {
    pub reviewer: String,
    pub raw: String,
}

pub async fn save_ai_review_diagnosis_report(
    db: &sqlx::SqlitePool,
    submission_id: &str,
    paper_text: &str,
    reviews: &[ReviewerDiagnosisInput],
) -> Result<Vec<String>, String> {
    let mut saved_ids = Vec::new();

    for review in reviews {
        let id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();

        sqlx::query(
            "INSERT INTO submission_diagnosis_reports (id, submission_id, reviewer_name, report_json, paper_text, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(&id)
        .bind(submission_id)
        .bind(&review.reviewer)
        .bind(&review.raw)
        .bind(paper_text)
        .bind(&now)
        .bind(&now)
        .execute(db)
        .await
        .map_err(|e| e.to_string())?;

        saved_ids.push(id);
    }

    Ok(saved_ids)
}

pub async fn list_submission_diagnosis_reports(
    db: &sqlx::SqlitePool,
    submission_id: &str,
) -> Result<serde_json::Value, String> {
    let rows = sqlx::query(
        "SELECT id, submission_id, reviewer_name, report_json, created_at
         FROM submission_diagnosis_reports WHERE submission_id = ?
         ORDER BY created_at DESC"
    )
    .bind(submission_id)
    .fetch_all(db)
    .await
    .map_err(|e| e.to_string())?;

    let reports: Vec<serde_json::Value> = rows
        .iter()
        .map(|row| {
            let id: String = row.get("id");
            let sid: String = row.get("submission_id");
            let reviewer_name: String = row.get("reviewer_name");
            let report_json: String = row.get("report_json");
            let created_at: String = row.get("created_at");
            let report: serde_json::Value =
                serde_json::from_str(&report_json).unwrap_or(serde_json::Value::Null);
            serde_json::json!({
                "id": id,
                "submissionId": sid,
                "reviewerName": reviewer_name,
                "report": report,
                "createdAt": created_at,
            })
        })
        .collect();

    Ok(serde_json::Value::Array(reports))
}

pub async fn import_diagnosis_report_to_checklist(
    db: &sqlx::SqlitePool,
    report_id: &str,
) -> Result<Vec<String>, String> {
    let row = sqlx::query(
        "SELECT report_json, submission_id FROM submission_diagnosis_reports WHERE id = ?"
    )
    .bind(report_id)
    .fetch_optional(db)
    .await
    .map_err(|e| e.to_string())?
    .ok_or("未找到诊断报告")?;

    let report_json: String = row.get("report_json");
    let submission_id: String = row.get("submission_id");
    let report: serde_json::Value =
        serde_json::from_str(&report_json).map_err(|e| e.to_string())?;

    let suggestions: Vec<String> = report
        .get("suggestions")
        .and_then(|s| s.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect()
        })
        .unwrap_or_default();

    let mut task_ids = Vec::new();
    for suggestion in &suggestions {
        let task_id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();

        sqlx::query(
            "INSERT INTO submission_checklist_items (id, submission_id, content, source, created_at, updated_at)
             VALUES (?, ?, ?, 'diagnosis', ?, ?)"
        )
        .bind(&task_id)
        .bind(&submission_id)
        .bind(suggestion)
        .bind(&now)
        .bind(&now)
        .execute(db)
        .await
        .map_err(|e| e.to_string())?;

        task_ids.push(task_id);
    }

    Ok(task_ids)
}

pub fn collect_issue_labels(report: &serde_json::Value) -> Vec<String> {
    report
        .get("weaknesses")
        .and_then(|w| w.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str())
                .take(10)
                .map(|s| s.to_string())
                .collect()
        })
        .unwrap_or_default()
}
