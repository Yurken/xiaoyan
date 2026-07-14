use super::shared::{chunk_markdown, extract_wiki_links, normalize_slug};
use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use sqlx::{Row, SqlitePool};
use uuid::Uuid;

#[derive(Clone, Debug, Serialize)]
pub struct WikiPage {
    pub id: String,
    pub research_interest_id: String,
    pub slug: String,
    pub title: String,
    pub page_type: String,
    pub summary: String,
    pub content: String,
    pub status: String,
    pub confidence: f64,
    pub current_revision: i64,
    pub source_count: i64,
    pub link_count: i64,
    pub backlink_count: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Clone, Debug, Serialize)]
pub struct WikiPageSource {
    pub id: String,
    pub source_kind: String,
    pub source_id: String,
    pub source_title: String,
    pub locator: String,
    pub relation_kind: String,
    pub excerpt: String,
}

#[derive(Clone, Debug, Serialize)]
pub struct WikiPageLink {
    pub id: String,
    pub target_slug: String,
    pub target_title: Option<String>,
    pub target_page_id: Option<String>,
    pub relation_kind: String,
}

#[derive(Clone, Debug, Serialize)]
pub struct WikiPageRevision {
    pub id: String,
    pub revision_number: i64,
    pub change_summary: String,
    pub generator: String,
    pub created_at: String,
}

#[derive(Clone, Debug, Serialize)]
pub struct WikiPageDetail {
    #[serde(flatten)]
    pub page: WikiPage,
    pub sources: Vec<WikiPageSource>,
    pub links: Vec<WikiPageLink>,
    pub backlinks: Vec<WikiPageLink>,
    pub revisions: Vec<WikiPageRevision>,
}

#[derive(Clone, Debug, Deserialize)]
pub struct WikiPageUpdate {
    pub title: Option<String>,
    pub summary: Option<String>,
    pub content: Option<String>,
    pub status: Option<String>,
    pub page_type: Option<String>,
    pub change_summary: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
pub struct WikiIssue {
    pub id: String,
    pub page_id: Option<String>,
    pub page_title: Option<String>,
    pub issue_type: String,
    pub severity: String,
    pub message: String,
    pub status: String,
    pub created_at: String,
}

#[derive(Clone, Debug, Serialize)]
pub struct WikiCompileRun {
    pub id: String,
    pub status: String,
    pub source_count: i64,
    pub changed_source_count: i64,
    pub pages_created: i64,
    pub pages_updated: i64,
    pub issue_count: i64,
    pub error: Option<String>,
    pub started_at: String,
    pub finished_at: Option<String>,
}

fn page_from_row(row: &sqlx::sqlite::SqliteRow) -> WikiPage {
    WikiPage {
        id: row.get("id"),
        research_interest_id: row.get("research_interest_id"),
        slug: row.get("slug"),
        title: row.get("title"),
        page_type: row.get("page_type"),
        summary: row.get("summary"),
        content: row.get("content"),
        status: row.get("status"),
        confidence: row.get("confidence"),
        current_revision: row.get("current_revision"),
        source_count: row.get("source_count"),
        link_count: row.get("link_count"),
        backlink_count: row.get("backlink_count"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }
}

const PAGE_SELECT: &str = "SELECT wp.*,
        (SELECT COUNT(*) FROM wiki_page_sources s WHERE s.page_id = wp.id) AS source_count,
        (SELECT COUNT(*) FROM wiki_page_links l WHERE l.from_page_id = wp.id) AS link_count,
        (SELECT COUNT(*) FROM wiki_page_links l WHERE l.to_page_id = wp.id) AS backlink_count
     FROM wiki_pages wp";

pub async fn list_pages(
    db: &SqlitePool,
    interest_id: &str,
    query: Option<&str>,
    status: Option<&str>,
) -> Result<Vec<WikiPage>> {
    let search = query.map(str::trim).filter(|value| !value.is_empty());
    let status = status.map(str::trim).filter(|value| !value.is_empty());
    let rows = match (search, status) {
        (Some(search), Some(status)) => {
            let like = format!("%{search}%");
            sqlx::query(&format!(
                "{PAGE_SELECT} WHERE wp.research_interest_id = ? AND wp.status = ?
                 AND (wp.title LIKE ? OR wp.summary LIKE ? OR wp.content LIKE ?)
                 ORDER BY wp.updated_at DESC"
            ))
            .bind(interest_id)
            .bind(status)
            .bind(&like)
            .bind(&like)
            .bind(&like)
            .fetch_all(db)
            .await?
        }
        (Some(search), None) => {
            let like = format!("%{search}%");
            sqlx::query(&format!(
                "{PAGE_SELECT} WHERE wp.research_interest_id = ?
                 AND (wp.title LIKE ? OR wp.summary LIKE ? OR wp.content LIKE ?)
                 ORDER BY wp.updated_at DESC"
            ))
            .bind(interest_id)
            .bind(&like)
            .bind(&like)
            .bind(&like)
            .fetch_all(db)
            .await?
        }
        (None, Some(status)) => sqlx::query(&format!(
            "{PAGE_SELECT} WHERE wp.research_interest_id = ? AND wp.status = ? ORDER BY wp.updated_at DESC"
        ))
        .bind(interest_id)
        .bind(status)
        .fetch_all(db)
        .await?,
        (None, None) => sqlx::query(&format!(
            "{PAGE_SELECT} WHERE wp.research_interest_id = ? ORDER BY wp.updated_at DESC"
        ))
        .bind(interest_id)
        .fetch_all(db)
        .await?,
    };
    Ok(rows.iter().map(page_from_row).collect())
}

pub async fn get_page(db: &SqlitePool, page_id: &str) -> Result<Option<WikiPageDetail>> {
    let Some(row) = sqlx::query(&format!("{PAGE_SELECT} WHERE wp.id = ?"))
        .bind(page_id)
        .fetch_optional(db)
        .await?
    else {
        return Ok(None);
    };
    let page = page_from_row(&row);

    let sources = sqlx::query(
        "SELECT id, source_kind, source_id, source_title, locator, relation_kind, excerpt
         FROM wiki_page_sources WHERE page_id = ? ORDER BY source_kind, source_title",
    )
    .bind(page_id)
    .fetch_all(db)
    .await?
    .into_iter()
    .map(|row| WikiPageSource {
        id: row.get("id"),
        source_kind: row.get("source_kind"),
        source_id: row.get("source_id"),
        source_title: row.get("source_title"),
        locator: row.get("locator"),
        relation_kind: row.get("relation_kind"),
        excerpt: row.get("excerpt"),
    })
    .collect();

    let links = sqlx::query(
        "SELECT l.id, l.target_slug, l.to_page_id, l.relation_kind, target.title AS target_title
         FROM wiki_page_links l LEFT JOIN wiki_pages target ON target.id = l.to_page_id
         WHERE l.from_page_id = ? ORDER BY l.target_slug",
    )
    .bind(page_id)
    .fetch_all(db)
    .await?
    .into_iter()
    .map(link_from_row)
    .collect();
    let backlinks = sqlx::query(
        "SELECT l.id, source.slug AS target_slug, source.id AS to_page_id,
                l.relation_kind, source.title AS target_title
         FROM wiki_page_links l JOIN wiki_pages source ON source.id = l.from_page_id
         WHERE l.to_page_id = ? ORDER BY source.title",
    )
    .bind(page_id)
    .fetch_all(db)
    .await?
    .into_iter()
    .map(link_from_row)
    .collect();
    let revisions = sqlx::query(
        "SELECT id, revision_number, change_summary, generator, created_at
         FROM wiki_page_revisions WHERE page_id = ? ORDER BY revision_number DESC LIMIT 30",
    )
    .bind(page_id)
    .fetch_all(db)
    .await?
    .into_iter()
    .map(|row| WikiPageRevision {
        id: row.get("id"),
        revision_number: row.get("revision_number"),
        change_summary: row.get("change_summary"),
        generator: row.get("generator"),
        created_at: row.get("created_at"),
    })
    .collect();

    Ok(Some(WikiPageDetail {
        page,
        sources,
        links,
        backlinks,
        revisions,
    }))
}

fn link_from_row(row: sqlx::sqlite::SqliteRow) -> WikiPageLink {
    WikiPageLink {
        id: row.get("id"),
        target_slug: row.get("target_slug"),
        target_title: row.get("target_title"),
        target_page_id: row.get("to_page_id"),
        relation_kind: row.get("relation_kind"),
    }
}

pub async fn update_page(db: &SqlitePool, page_id: &str, update: WikiPageUpdate) -> Result<()> {
    let row = sqlx::query(
        "SELECT research_interest_id, slug, title, page_type, summary, content, status, current_revision
         FROM wiki_pages WHERE id = ?",
    )
    .bind(page_id)
    .fetch_optional(db)
    .await?
    .ok_or_else(|| anyhow!("Wiki page not found"))?;

    let interest_id: String = row.get("research_interest_id");
    let title = update.title.unwrap_or_else(|| row.get("title"));
    let page_type = update.page_type.unwrap_or_else(|| row.get("page_type"));
    let summary = update.summary.unwrap_or_else(|| row.get("summary"));
    let content = update.content.unwrap_or_else(|| row.get("content"));
    let status = update.status.unwrap_or_else(|| row.get("status"));
    if !["draft", "reviewed", "contested", "archived"].contains(&status.as_str()) {
        return Err(anyhow!("Invalid wiki page status"));
    }
    let slug: String = row.get("slug");
    if normalize_slug(&title).is_empty() || slug.is_empty() {
        return Err(anyhow!("Wiki page title or slug is empty"));
    }
    let revision_number: i64 = row.get::<i64, _>("current_revision") + 1;
    let revision_id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let mut tx = db.begin().await?;
    sqlx::query(
        "UPDATE wiki_pages SET title = ?, page_type = ?, summary = ?, content = ?, status = ?,
         current_revision = ?, updated_at = ? WHERE id = ?",
    )
    .bind(&title)
    .bind(&page_type)
    .bind(&summary)
    .bind(&content)
    .bind(&status)
    .bind(revision_number)
    .bind(&now)
    .bind(page_id)
    .execute(&mut *tx)
    .await?;
    sqlx::query(
        "INSERT INTO wiki_page_revisions
         (id, page_id, revision_number, title, summary, content, change_summary, generator, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'manual', ?)",
    )
    .bind(&revision_id)
    .bind(page_id)
    .bind(revision_number)
    .bind(&title)
    .bind(&summary)
    .bind(&content)
    .bind(update.change_summary.unwrap_or_else(|| "人工编辑".into()))
    .bind(&now)
    .execute(&mut *tx)
    .await?;

    sqlx::query("DELETE FROM wiki_page_links WHERE from_page_id = ?")
        .bind(page_id)
        .execute(&mut *tx)
        .await?;
    for target_slug in extract_wiki_links(&content) {
        let to_page_id: Option<String> = sqlx::query_scalar(
            "SELECT id FROM wiki_pages WHERE research_interest_id = ? AND slug = ?",
        )
        .bind(&interest_id)
        .bind(&target_slug)
        .fetch_optional(&mut *tx)
        .await?;
        sqlx::query(
            "INSERT INTO wiki_page_links
             (id, from_page_id, to_page_id, target_slug, relation_kind, created_at)
             VALUES (?, ?, ?, ?, 'related', ?)",
        )
        .bind(Uuid::new_v4().to_string())
        .bind(page_id)
        .bind(to_page_id)
        .bind(target_slug)
        .bind(&now)
        .execute(&mut *tx)
        .await?;
    }
    sqlx::query("DELETE FROM wiki_page_chunks WHERE page_id = ?")
        .bind(page_id)
        .execute(&mut *tx)
        .await?;
    for chunk in chunk_markdown(&format!("# {title}\n\n{summary}\n\n{content}"), 1_200, 160) {
        sqlx::query(
            "INSERT INTO wiki_page_chunks
             (id, page_id, revision_id, chunk_index, heading_path, content, content_hash, token_count, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(Uuid::new_v4().to_string())
        .bind(page_id)
        .bind(&revision_id)
        .bind(chunk.chunk_index as i64)
        .bind(chunk.heading_path)
        .bind(&chunk.content)
        .bind(chunk.content_hash)
        .bind(chunk.content.chars().count() as i64 / 4)
        .bind(&now)
        .execute(&mut *tx)
        .await?;
    }
    tx.commit().await?;

    Ok(())
}

pub async fn list_issues(db: &SqlitePool, interest_id: &str) -> Result<Vec<WikiIssue>> {
    let rows = sqlx::query(
        "SELECT i.id, i.page_id, p.title AS page_title, i.issue_type, i.severity,
                i.message, i.status, i.created_at
         FROM wiki_issues i LEFT JOIN wiki_pages p ON p.id = i.page_id
         WHERE i.research_interest_id = ? AND i.status = 'open'
         ORDER BY CASE i.severity WHEN 'error' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END, i.created_at DESC",
    )
    .bind(interest_id)
    .fetch_all(db)
    .await?;
    Ok(rows
        .into_iter()
        .map(|row| WikiIssue {
            id: row.get("id"),
            page_id: row.get("page_id"),
            page_title: row.get("page_title"),
            issue_type: row.get("issue_type"),
            severity: row.get("severity"),
            message: row.get("message"),
            status: row.get("status"),
            created_at: row.get("created_at"),
        })
        .collect())
}

pub async fn list_compile_runs(db: &SqlitePool, interest_id: &str) -> Result<Vec<WikiCompileRun>> {
    let rows = sqlx::query(
        "SELECT id, status, source_count, changed_source_count, pages_created, pages_updated,
                issue_count, error, started_at, finished_at
         FROM wiki_compile_runs WHERE research_interest_id = ? ORDER BY started_at DESC LIMIT 20",
    )
    .bind(interest_id)
    .fetch_all(db)
    .await?;
    Ok(rows
        .into_iter()
        .map(|row| WikiCompileRun {
            id: row.get("id"),
            status: row.get("status"),
            source_count: row.get("source_count"),
            changed_source_count: row.get("changed_source_count"),
            pages_created: row.get("pages_created"),
            pages_updated: row.get("pages_updated"),
            issue_count: row.get("issue_count"),
            error: row.get("error"),
            started_at: row.get("started_at"),
            finished_at: row.get("finished_at"),
        })
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::SqlitePoolOptions;

    #[tokio::test]
    async fn manual_update_creates_revision_chunks_and_resolves_links() -> Result<()> {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await?;
        sqlx::query("CREATE TABLE research_interests (id TEXT PRIMARY KEY)")
            .execute(&pool)
            .await?;
        super::super::schema::ensure_wiki_tables(&pool).await?;
        sqlx::query("INSERT INTO research_interests (id) VALUES ('interest-1')")
            .execute(&pool)
            .await?;
        sqlx::raw_sql(
            "INSERT INTO wiki_pages
                (id, research_interest_id, slug, title, summary, content)
                VALUES ('page-1', 'interest-1', 'source-page', '来源页', '旧摘要', '旧正文');
             INSERT INTO wiki_pages
                (id, research_interest_id, slug, title, summary, content)
                VALUES ('page-2', 'interest-1', 'target-page', '目标页', '', '目标正文');",
        )
        .execute(&pool)
        .await?;

        update_page(
            &pool,
            "page-1",
            WikiPageUpdate {
                title: None,
                summary: Some("新摘要".into()),
                content: Some("## 关系\n参见 [[target-page|目标页]]。".into()),
                status: Some("reviewed".into()),
                page_type: None,
                change_summary: Some("审核修订".into()),
            },
        )
        .await?;

        let detail = get_page(&pool, "page-1").await?.expect("page exists");
        assert_eq!(detail.page.status, "reviewed");
        assert_eq!(detail.page.current_revision, 2);
        assert_eq!(detail.links[0].target_page_id.as_deref(), Some("page-2"));
        let chunk_count: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM wiki_page_chunks WHERE page_id = 'page-1'")
                .fetch_one(&pool)
                .await?;
        assert!(chunk_count > 0);

        let rejected = update_page(
            &pool,
            "page-1",
            WikiPageUpdate {
                title: Some("  ".into()),
                summary: None,
                content: None,
                status: None,
                page_type: None,
                change_summary: None,
            },
        )
        .await;
        assert!(rejected.is_err());
        let revision: i64 =
            sqlx::query_scalar("SELECT current_revision FROM wiki_pages WHERE id = 'page-1'")
                .fetch_one(&pool)
                .await?;
        assert_eq!(revision, 2);
        Ok(())
    }
}
