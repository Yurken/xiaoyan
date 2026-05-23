use crate::services::submission_diagnosis_service::collect_issue_labels;
use anyhow::{anyhow, Result};
use serde_json::{json, Value};
use sqlx::{Row, SqlitePool};
use std::collections::HashSet;
use uuid::Uuid;

fn now_rfc3339() -> String {
    chrono::Utc::now().to_rfc3339()
}

fn priority_for_risk(risk_level: &str) -> &'static str {
    match risk_level {
        "high" => "high",
        "low" => "low",
        _ => "medium",
    }
}

pub async fn list_revision_tasks(db: &SqlitePool, submission_id: &str) -> Result<Value> {
    let rows = sqlx::query(
        "SELECT
            t.id, t.submission_id, t.diagnosis_report_id, t.checklist_item_id,
            t.paper_version_id, t.experiment_id, t.title, t.detail, t.status, t.priority,
            t.created_at, t.updated_at,
            pv.tag AS paper_version_tag, pv.label AS paper_version_label,
            e.title AS experiment_title
         FROM submission_revision_tasks t
         LEFT JOIN paper_versions pv ON pv.id = t.paper_version_id
         LEFT JOIN experiment_records e ON e.id = t.experiment_id
         WHERE t.submission_id = ?
         ORDER BY
            CASE t.status WHEN 'todo' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END,
            CASE t.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
            t.updated_at DESC",
    )
    .bind(submission_id)
    .fetch_all(db)
    .await?;

    let tasks = rows
        .iter()
        .map(|row| {
            json!({
                "id": row.get::<String, _>("id"),
                "submissionId": row.get::<String, _>("submission_id"),
                "diagnosisReportId": row.get::<Option<String>, _>("diagnosis_report_id"),
                "checklistItemId": row.get::<Option<String>, _>("checklist_item_id"),
                "paperVersionId": row.get::<Option<String>, _>("paper_version_id"),
                "experimentId": row.get::<Option<String>, _>("experiment_id"),
                "title": row.get::<String, _>("title"),
                "detail": row.get::<String, _>("detail"),
                "status": row.get::<String, _>("status"),
                "priority": row.get::<String, _>("priority"),
                "paperVersionTag": row.get::<Option<String>, _>("paper_version_tag"),
                "paperVersionLabel": row.get::<Option<String>, _>("paper_version_label"),
                "experimentTitle": row.get::<Option<String>, _>("experiment_title"),
                "createdAt": row.get::<String, _>("created_at"),
                "updatedAt": row.get::<String, _>("updated_at"),
            })
        })
        .collect::<Vec<_>>();

    Ok(json!({ "tasks": tasks }))
}

pub async fn import_diagnosis_report_to_revision_tasks(
    db: &SqlitePool,
    report_id: &str,
) -> Result<usize> {
    let row = sqlx::query(
        "SELECT submission_id, risk_level, summary, report_json
         FROM submission_diagnosis_reports
         WHERE id = ?",
    )
    .bind(report_id)
    .fetch_optional(db)
    .await?
    .ok_or_else(|| anyhow!("Diagnosis report not found"))?;

    let submission_id = row.get::<String, _>("submission_id");
    let risk_level = row.get::<String, _>("risk_level");
    let summary = row.get::<String, _>("summary");
    let report_json_raw = row.get::<String, _>("report_json");
    let report_json = serde_json::from_str::<Value>(&report_json_raw).unwrap_or_else(|_| json!({}));
    let labels = collect_issue_labels(&report_json);
    if labels.is_empty() {
        return Ok(0);
    }

    let existing_rows =
        sqlx::query("SELECT title FROM submission_revision_tasks WHERE submission_id = ?")
            .bind(&submission_id)
            .fetch_all(db)
            .await?;
    let mut existing_titles = existing_rows
        .iter()
        .map(|row| row.get::<String, _>("title"))
        .collect::<HashSet<_>>();

    let now = now_rfc3339();
    let priority = priority_for_risk(&risk_level);
    let mut created = 0usize;

    for title in labels {
        if !existing_titles.insert(title.clone()) {
            continue;
        }

        sqlx::query(
            "INSERT INTO submission_revision_tasks (
                id, submission_id, diagnosis_report_id, title, detail, status, priority, created_at, updated_at
             ) VALUES (?, ?, ?, ?, ?, 'todo', ?, ?, ?)",
        )
        .bind(Uuid::new_v4().to_string())
        .bind(&submission_id)
        .bind(report_id)
        .bind(&title)
        .bind(&summary)
        .bind(priority)
        .bind(&now)
        .bind(&now)
        .execute(db)
        .await?;
        created += 1;
    }

    Ok(created)
}

pub async fn update_revision_task(
    db: &SqlitePool,
    id: &str,
    status: Option<String>,
    paper_version_id: Option<String>,
    experiment_id: Option<String>,
) -> Result<()> {
    let now = now_rfc3339();

    if let Some(value) = status {
        if !matches!(value.as_str(), "todo" | "in_progress" | "done") {
            return Err(anyhow!("Invalid revision task status"));
        }
        sqlx::query("UPDATE submission_revision_tasks SET status = ?, updated_at = ? WHERE id = ?")
            .bind(value)
            .bind(&now)
            .bind(id)
            .execute(db)
            .await?;
    }

    if let Some(value) = paper_version_id {
        let normalized = if value.trim().is_empty() {
            None::<String>
        } else {
            Some(value)
        };
        sqlx::query(
            "UPDATE submission_revision_tasks SET paper_version_id = ?, updated_at = ? WHERE id = ?",
        )
        .bind(normalized)
        .bind(&now)
        .bind(id)
        .execute(db)
        .await?;
    }

    if let Some(value) = experiment_id {
        let normalized = if value.trim().is_empty() {
            None::<String>
        } else {
            Some(value)
        };
        sqlx::query(
            "UPDATE submission_revision_tasks SET experiment_id = ?, updated_at = ? WHERE id = ?",
        )
        .bind(normalized)
        .bind(&now)
        .bind(id)
        .execute(db)
        .await?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::priority_for_risk;

    #[test]
    fn risk_maps_to_task_priority() {
        assert_eq!(priority_for_risk("high"), "high");
        assert_eq!(priority_for_risk("low"), "low");
        assert_eq!(priority_for_risk("medium"), "medium");
        assert_eq!(priority_for_risk("unknown"), "medium");
    }
}
