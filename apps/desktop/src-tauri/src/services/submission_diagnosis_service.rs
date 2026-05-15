use anyhow::Result;
use serde_json::{json, Value};
use sqlx::SqlitePool;
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct ReviewerDiagnosisInput {
    pub reviewer: String,
    pub raw: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum DiagnosisRiskLevel {
    Low,
    Medium,
    High,
}

impl DiagnosisRiskLevel {
    fn as_str(&self) -> &'static str {
        match self {
            Self::Low => "low",
            Self::Medium => "medium",
            Self::High => "high",
        }
    }
}

fn now_rfc3339() -> String {
    chrono::Utc::now().to_rfc3339()
}

fn compact_text(value: &str) -> String {
    value.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn safe_truncate(value: &str, max_bytes: usize) -> &str {
    if value.len() <= max_bytes {
        return value;
    }

    let mut end = max_bytes;
    while end > 0 && !value.is_char_boundary(end) {
        end -= 1;
    }
    &value[..end]
}

fn preview_text(value: &str, max_bytes: usize) -> String {
    let compact = compact_text(value);
    if compact.len() > max_bytes {
        format!("{}…", safe_truncate(&compact, max_bytes))
    } else {
        compact
    }
}

fn extract_json_object(raw: &str) -> Option<Value> {
    serde_json::from_str::<Value>(raw).ok().or_else(|| {
        let start = raw.find('{')?;
        let end = raw.rfind('}')?;
        serde_json::from_str::<Value>(&raw[start..=end]).ok()
    })
}

fn classify_risk(reviews: &[Value]) -> DiagnosisRiskLevel {
    let mut scores = Vec::new();
    let mut has_reject = false;

    for review in reviews {
        if let Some(score) = review.get("score").and_then(|value| value.as_i64()) {
            scores.push(score);
        }
        let verdict = review
            .get("verdict")
            .and_then(|value| value.as_str())
            .unwrap_or_default()
            .to_ascii_lowercase();
        if matches!(verdict.as_str(), "reject" | "weak_reject") {
            has_reject = true;
        }
    }

    if has_reject {
        return DiagnosisRiskLevel::High;
    }

    if scores.is_empty() {
        return DiagnosisRiskLevel::Medium;
    }

    let average = scores.iter().sum::<i64>() as f32 / scores.len() as f32;
    if average <= 4.5 {
        DiagnosisRiskLevel::High
    } else if average <= 6.5 {
        DiagnosisRiskLevel::Medium
    } else {
        DiagnosisRiskLevel::Low
    }
}

fn collect_json_list(reviews: &[Value], field: &str, limit: usize) -> Vec<String> {
    reviews
        .iter()
        .filter_map(|review| review.get(field).and_then(|value| value.as_array()))
        .flat_map(|items| items.iter())
        .filter_map(|item| item.as_str())
        .map(|item| preview_text(item, 160))
        .take(limit)
        .collect()
}

fn build_summary(risk: &DiagnosisRiskLevel, reviews: &[Value]) -> String {
    let weaknesses = collect_json_list(reviews, "weaknesses", 3);
    let questions = collect_json_list(reviews, "questions", 2);
    let risk_label = match risk {
        DiagnosisRiskLevel::Low => "低风险",
        DiagnosisRiskLevel::Medium => "中等风险",
        DiagnosisRiskLevel::High => "高风险",
    };

    let mut parts = vec![format!("投稿前诊断：{risk_label}")];
    if !weaknesses.is_empty() {
        parts.push(format!("主要薄弱点：{}", weaknesses.join("；")));
    }
    if !questions.is_empty() {
        parts.push(format!("待回应问题：{}", questions.join("；")));
    }
    parts.join("\n")
}

pub async fn save_ai_review_diagnosis_report(
    db: &SqlitePool,
    submission_id: &str,
    content_preview: &str,
    reviewer_inputs: &[ReviewerDiagnosisInput],
) -> Result<String> {
    let parsed_reviews = reviewer_inputs
        .iter()
        .filter_map(|item| extract_json_object(&item.raw))
        .collect::<Vec<_>>();
    let risk = classify_risk(&parsed_reviews);
    let summary = build_summary(&risk, &parsed_reviews);
    let now = now_rfc3339();
    let report_id = Uuid::new_v4().to_string();
    let report_json = json!({
        "content_preview": preview_text(content_preview, 1200),
        "reviewers": reviewer_inputs.iter().map(|item| json!({
            "reviewer": item.reviewer,
            "raw": item.raw,
        })).collect::<Vec<_>>(),
        "parsed_reviews": parsed_reviews,
    });

    sqlx::query(
        "INSERT INTO submission_diagnosis_reports (
            id, submission_id, source, status, risk_level, summary, report_json, created_at, updated_at
        ) VALUES (?, ?, 'ai_review', 'done', ?, ?, ?, ?, ?)",
    )
    .bind(&report_id)
    .bind(submission_id)
    .bind(risk.as_str())
    .bind(&summary)
    .bind(serde_json::to_string(&report_json)?)
    .bind(&now)
    .bind(&now)
    .execute(db)
    .await?;

    Ok(report_id)
}

#[cfg(test)]
mod tests {
    use super::{classify_risk, collect_json_list, DiagnosisRiskLevel};
    use serde_json::json;

    #[test]
    fn weak_reject_classifies_high_risk() {
        let reviews = vec![json!({ "verdict": "weak_reject", "score": 6 })];
        assert_eq!(classify_risk(&reviews), DiagnosisRiskLevel::High);
    }

    #[test]
    fn collects_weaknesses_from_reviews() {
        let reviews = vec![json!({ "weaknesses": ["实验不足", "相关工作偏少"] })];
        assert_eq!(
            collect_json_list(&reviews, "weaknesses", 1),
            vec!["实验不足"]
        );
    }
}
