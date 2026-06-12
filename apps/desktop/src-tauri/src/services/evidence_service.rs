use serde::{Deserialize, Serialize};
use sqlx::Row;

#[derive(Debug, Serialize, Deserialize)]
pub struct EvidenceLink {
    pub id: String,
    #[serde(rename = "type")]
    pub link_type: String,
    pub title: String,
    #[serde(rename = "sourceId")]
    pub source_id: String,
    pub summary: String,
}

pub struct EvidenceService;

impl EvidenceService {
    /// Query evidence links for a given target (paper analysis, submission diagnosis, etc.)
    pub async fn get_links(
        db: &sqlx::SqlitePool,
        target_id: &str,
        target_type: &str,
    ) -> Result<Vec<EvidenceLink>, String> {
        match target_type {
            "paper_analysis" => Self::paper_analysis_evidence(db, target_id).await,
            "submission_diagnosis" => Self::submission_diagnosis_evidence(db, target_id).await,
            _ => Ok(vec![]),
        }
    }

    async fn paper_analysis_evidence(
        db: &sqlx::SqlitePool,
        paper_id: &str,
    ) -> Result<Vec<EvidenceLink>, String> {
        let mut links = Vec::new();

        // Paper itself is primary evidence
        let paper = sqlx::query(
            "SELECT id, title, authors, venue, year, abstract_text FROM papers WHERE id = ?",
        )
        .bind(paper_id)
        .fetch_optional(db)
        .await
        .map_err(|e| e.to_string())?;

        if let Some(row) = paper {
            let title: String = row.get("title");
            let authors: Option<String> = row.get("authors");
            let year: Option<i64> = row.get("year");
            let venue: Option<String> = row.get("venue");
            let summary = [
                authors.as_deref().unwrap_or(""),
                &year.map(|y| y.to_string()).unwrap_or_default(),
                venue.as_deref().unwrap_or(""),
            ]
            .into_iter()
            .filter(|s| !s.is_empty())
            .collect::<Vec<_>>()
            .join(" · ");

            links.push(EvidenceLink {
                id: format!("ev_paper_{}", paper_id),
                link_type: "paper".into(),
                title,
                source_id: paper_id.to_string(),
                summary: if summary.is_empty() {
                    "论文原文".into()
                } else {
                    summary
                },
            });
        }

        // Paper figures as evidence
        let figures = sqlx::query(
            "SELECT id, reference_label, caption FROM paper_figures WHERE paper_id = ? LIMIT 10",
        )
        .bind(paper_id)
        .fetch_all(db)
        .await
        .map_err(|e| e.to_string())?;

        for figure in figures {
            let figure_id: String = figure.get("id");
            let label: String = figure.get("reference_label");
            let caption: Option<String> = figure.get("caption");
            links.push(EvidenceLink {
                id: format!("ev_fig_{}", figure_id),
                link_type: "figure".into(),
                title: label,
                source_id: figure_id,
                summary: caption.unwrap_or_else(|| "论文图表".into()),
            });
        }

        // Analysis results as evidence
        let analyses = sqlx::query(
            "SELECT id, analysis_json FROM paper_analyses WHERE paper_id = ? ORDER BY created_at DESC LIMIT 1"
        )
        .bind(paper_id)
        .fetch_optional(db)
        .await
        .map_err(|e| e.to_string())?;

        if let Some(row) = analyses {
            let analysis_id: String = row.get("id");
            let analysis_json: Option<String> = row.get("analysis_json");
            if let Some(json_str) = analysis_json {
                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&json_str) {
                    let snippet = parsed
                        .get("research_question")
                        .and_then(|v| v.as_str())
                        .map(|s| s.chars().take(200).collect::<String>())
                        .unwrap_or_else(|| "论文精读分析".into());
                    links.push(EvidenceLink {
                        id: format!("ev_analysis_{}", analysis_id),
                        link_type: "analysis".into(),
                        title: "论文精读结论".into(),
                        source_id: analysis_id,
                        summary: snippet,
                    });
                }
            }
        }

        Ok(links)
    }

    async fn submission_diagnosis_evidence(
        db: &sqlx::SqlitePool,
        submission_id: &str,
    ) -> Result<Vec<EvidenceLink>, String> {
        let mut links = Vec::new();

        // Related paper versions
        let versions = sqlx::query(
            "SELECT id, version_tag, notes FROM paper_versions WHERE submission_id = ? LIMIT 5",
        )
        .bind(submission_id)
        .fetch_all(db)
        .await
        .map_err(|e| e.to_string())?;

        for version in versions {
            let version_id: String = version.get("id");
            let tag: String = version.get("version_tag");
            let notes: Option<String> = version.get("notes");
            links.push(EvidenceLink {
                id: format!("ev_ver_{}", version_id),
                link_type: "version".into(),
                title: format!("版本：{}", tag),
                source_id: version_id,
                summary: notes.unwrap_or_else(|| "论文版本快照".into()),
            });
        }

        // Related review comments
        let reviews = sqlx::query(
            "SELECT id, reviewer, content FROM review_comments WHERE submission_id = ? LIMIT 10",
        )
        .bind(submission_id)
        .fetch_all(db)
        .await
        .map_err(|e| e.to_string())?;

        for review in reviews {
            let review_id: String = review.get("id");
            let reviewer: String = review.get("reviewer");
            let content: String = review.get("content");
            let snippet = content.chars().take(200).collect::<String>();
            links.push(EvidenceLink {
                id: format!("ev_review_{}", review_id),
                link_type: "review".into(),
                title: format!("审稿意见：{}", reviewer),
                source_id: review_id,
                summary: snippet,
            });
        }

        // Diagnosis reports
        let reports = sqlx::query(
            "SELECT id, reviewer_name, report_json FROM submission_diagnosis_reports WHERE submission_id = ? LIMIT 5"
        )
        .bind(submission_id)
        .fetch_all(db)
        .await
        .map_err(|e| e.to_string())?;

        for report in reports {
            let report_id: String = report.get("id");
            let reviewer_name: String = report.get("reviewer_name");
            let report_json: String = report.get("report_json");
            let snippet = report_json.chars().take(200).collect::<String>();
            links.push(EvidenceLink {
                id: format!("ev_diag_{}", report_id),
                link_type: "diagnosis".into(),
                title: format!("诊断报告：{}", reviewer_name),
                source_id: report_id,
                summary: snippet,
            });
        }

        Ok(links)
    }
}
