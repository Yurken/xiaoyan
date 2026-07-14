use super::shared::extract_source_refs;
use anyhow::Result;
use serde::Serialize;
use sqlx::{Row, SqlitePool};
use std::collections::{HashMap, HashSet};
use uuid::Uuid;

#[derive(Clone, Debug, Serialize)]
pub struct WikiLintSummary {
    pub issue_count: usize,
    pub errors: usize,
    pub warnings: usize,
}

struct NewIssue {
    page_id: Option<String>,
    issue_type: &'static str,
    severity: &'static str,
    message: String,
}

pub async fn lint_interest(db: &SqlitePool, interest_id: &str) -> Result<WikiLintSummary> {
    let pages = sqlx::query(
        "SELECT id, title, summary, content,
                (SELECT COUNT(*) FROM wiki_page_sources s WHERE s.page_id = wiki_pages.id) AS source_count,
                (SELECT COUNT(*) FROM wiki_page_links l WHERE l.from_page_id = wiki_pages.id) AS outbound_count,
                (SELECT COUNT(*) FROM wiki_page_links l WHERE l.to_page_id = wiki_pages.id) AS inbound_count
         FROM wiki_pages WHERE research_interest_id = ? AND status != 'archived'",
    )
    .bind(interest_id)
    .fetch_all(db)
    .await?;

    let source_rows = sqlx::query(
        "SELECT s.page_id, s.source_kind, s.source_id
         FROM wiki_page_sources s JOIN wiki_pages p ON p.id = s.page_id
         WHERE p.research_interest_id = ?",
    )
    .bind(interest_id)
    .fetch_all(db)
    .await?;
    let mut sources: HashMap<String, HashSet<(String, String)>> = HashMap::new();
    let mut missing_records = Vec::new();
    for row in source_rows {
        let page_id: String = row.get("page_id");
        let source_kind: String = row.get("source_kind");
        let source_id: String = row.get("source_id");
        let exists = match source_kind.as_str() {
            "paper" => {
                sqlx::query_scalar::<_, bool>("SELECT EXISTS(SELECT 1 FROM papers WHERE id = ?)")
                    .bind(&source_id)
                    .fetch_one(db)
                    .await?
            }
            "note" => {
                sqlx::query_scalar::<_, bool>(
                    "SELECT EXISTS(SELECT 1 FROM knowledge_notes WHERE id = ?)",
                )
                .bind(&source_id)
                .fetch_one(db)
                .await?
            }
            _ => false,
        };
        if !exists {
            missing_records.push((page_id.clone(), source_kind.clone(), source_id.clone()));
        }
        sources
            .entry(page_id)
            .or_default()
            .insert((source_kind, source_id));
    }

    let mut issues = Vec::new();
    for (page_id, source_kind, source_id) in missing_records {
        issues.push(NewIssue {
            page_id: Some(page_id),
            issue_type: "missing_source_record",
            severity: "error",
            message: format!("来源 {source_kind}:{source_id} 已不存在，需要重新编译或人工修订"),
        });
    }
    for row in &pages {
        let page_id: String = row.get("id");
        let title: String = row.get("title");
        let summary: String = row.get("summary");
        let content: String = row.get("content");
        let source_count: i64 = row.get("source_count");
        let outbound_count: i64 = row.get("outbound_count");
        let inbound_count: i64 = row.get("inbound_count");
        if source_count == 0 {
            issues.push(NewIssue {
                page_id: Some(page_id.clone()),
                issue_type: "missing_source",
                severity: "warning",
                message: format!("「{title}」没有可追溯来源"),
            });
        }
        if summary.trim().is_empty() {
            issues.push(NewIssue {
                page_id: Some(page_id.clone()),
                issue_type: "missing_summary",
                severity: "warning",
                message: format!("「{title}」缺少摘要"),
            });
        }
        if pages.len() > 1 && outbound_count == 0 && inbound_count == 0 {
            issues.push(NewIssue {
                page_id: Some(page_id.clone()),
                issue_type: "orphan_page",
                severity: "info",
                message: format!("「{title}」尚未连接到其他 Wiki 页面"),
            });
        }
        let page_sources = sources.get(&page_id);
        for source_ref in extract_source_refs(&content) {
            if !page_sources.is_some_and(|items| items.contains(&source_ref)) {
                issues.push(NewIssue {
                    page_id: Some(page_id.clone()),
                    issue_type: "invalid_source_ref",
                    severity: "error",
                    message: format!(
                        "「{title}」引用了未登记来源 [source:{}:{}]",
                        source_ref.0, source_ref.1
                    ),
                });
            }
        }
    }

    let broken_links = sqlx::query(
        "SELECT l.from_page_id, p.title, l.target_slug
         FROM wiki_page_links l JOIN wiki_pages p ON p.id = l.from_page_id
         WHERE p.research_interest_id = ? AND l.to_page_id IS NULL",
    )
    .bind(interest_id)
    .fetch_all(db)
    .await?;
    for row in broken_links {
        let title: String = row.get("title");
        let target_slug: String = row.get("target_slug");
        issues.push(NewIssue {
            page_id: Some(row.get("from_page_id")),
            issue_type: "broken_link",
            severity: "warning",
            message: format!("「{title}」链接到不存在的页面 [[{target_slug}]]"),
        });
    }

    let mut tx = db.begin().await?;
    sqlx::query("DELETE FROM wiki_issues WHERE research_interest_id = ? AND status = 'open'")
        .bind(interest_id)
        .execute(&mut *tx)
        .await?;
    let now = chrono::Utc::now().to_rfc3339();
    for issue in &issues {
        sqlx::query(
            "INSERT INTO wiki_issues
             (id, research_interest_id, page_id, issue_type, severity, message, status, created_at)
             VALUES (?, ?, ?, ?, ?, ?, 'open', ?)",
        )
        .bind(Uuid::new_v4().to_string())
        .bind(interest_id)
        .bind(&issue.page_id)
        .bind(issue.issue_type)
        .bind(issue.severity)
        .bind(&issue.message)
        .bind(&now)
        .execute(&mut *tx)
        .await?;
    }
    tx.commit().await?;

    Ok(WikiLintSummary {
        issue_count: issues.len(),
        errors: issues
            .iter()
            .filter(|issue| issue.severity == "error")
            .count(),
        warnings: issues
            .iter()
            .filter(|issue| issue.severity == "warning")
            .count(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::SqlitePoolOptions;

    #[tokio::test]
    async fn lint_reports_missing_sources_summary_and_broken_links() -> Result<()> {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await?;
        sqlx::raw_sql(
            "CREATE TABLE research_interests (id TEXT PRIMARY KEY);
             CREATE TABLE papers (id TEXT PRIMARY KEY);
             CREATE TABLE knowledge_notes (id TEXT PRIMARY KEY);",
        )
        .execute(&pool)
        .await?;
        super::super::schema::ensure_wiki_tables(&pool).await?;
        sqlx::query("INSERT INTO research_interests (id) VALUES ('interest-1')")
            .execute(&pool)
            .await?;
        sqlx::query(
            "INSERT INTO wiki_pages
             (id, research_interest_id, slug, title, summary, content)
             VALUES ('page-1', 'interest-1', 'graph-rag', 'Graph RAG', '', '正文')",
        )
        .execute(&pool)
        .await?;
        sqlx::query(
            "INSERT INTO wiki_page_sources
             (id, page_id, source_kind, source_id, source_title)
             VALUES ('source-1', 'page-1', 'paper', 'deleted-paper', 'Deleted paper')",
        )
        .execute(&pool)
        .await?;
        sqlx::query(
            "INSERT INTO wiki_page_links (id, from_page_id, target_slug)
             VALUES ('link-1', 'page-1', 'missing-page')",
        )
        .execute(&pool)
        .await?;

        let summary = lint_interest(&pool, "interest-1").await?;
        assert_eq!(summary.issue_count, 3);
        assert_eq!(summary.errors, 1);
        assert_eq!(summary.warnings, 2);
        let issue_types = sqlx::query_scalar::<_, String>(
            "SELECT issue_type FROM wiki_issues ORDER BY issue_type",
        )
        .fetch_all(&pool)
        .await?;
        assert_eq!(
            issue_types,
            vec!["broken_link", "missing_source_record", "missing_summary"]
        );
        Ok(())
    }
}
