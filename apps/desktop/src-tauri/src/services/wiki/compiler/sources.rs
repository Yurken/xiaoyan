use super::SourceDocument;
use crate::services::wiki::shared::content_hash;
use anyhow::Result;
use sqlx::{Row, SqlitePool};
use std::collections::HashMap;

pub(super) struct SourceChanges {
    pub changed: Vec<SourceDocument>,
    pub removed_keys: Vec<String>,
}

pub(super) async fn load_sources(
    db: &SqlitePool,
    interest_id: &str,
) -> Result<Vec<SourceDocument>> {
    let paper_rows = sqlx::query(
        "SELECT id, title, COALESCE(NULLIF(full_text, ''), NULLIF(abstract, ''), '') AS content
         FROM papers WHERE research_interest_id = ? ORDER BY updated_at DESC",
    )
    .bind(interest_id)
    .fetch_all(db)
    .await?;
    let note_rows = sqlx::query(
        "SELECT id, title, content FROM knowledge_notes
         WHERE research_interest_id = ? ORDER BY updated_at DESC",
    )
    .bind(interest_id)
    .fetch_all(db)
    .await?;
    let mut sources = Vec::new();
    for row in paper_rows {
        push_source(
            &mut sources,
            "paper",
            row.get("id"),
            row.get("title"),
            row.get("content"),
        );
    }
    for row in note_rows {
        push_source(
            &mut sources,
            "note",
            row.get("id"),
            row.get("title"),
            row.get("content"),
        );
    }
    Ok(sources)
}

fn push_source(
    sources: &mut Vec<SourceDocument>,
    kind: &str,
    id: String,
    title: String,
    content: String,
) {
    if content.trim().is_empty() {
        return;
    }
    let hash = content_hash(&format!("{title}\n{content}"));
    sources.push(SourceDocument {
        key: format!("{kind}:{id}"),
        kind: kind.into(),
        id,
        title,
        content,
        hash,
    });
}

pub(super) async fn source_changes(
    db: &SqlitePool,
    interest_id: &str,
    sources: &[SourceDocument],
    force: bool,
) -> Result<SourceChanges> {
    if force {
        return Ok(SourceChanges {
            changed: sources.to_vec(),
            removed_keys: Vec::new(),
        });
    }
    let rows = sqlx::query(
        "SELECT source_kind, source_id, content_hash FROM wiki_compile_sources
         WHERE research_interest_id = ?",
    )
    .bind(interest_id)
    .fetch_all(db)
    .await?;
    let previous = rows
        .into_iter()
        .map(|row| {
            (
                format!(
                    "{}:{}",
                    row.get::<String, _>("source_kind"),
                    row.get::<String, _>("source_id")
                ),
                row.get::<String, _>("content_hash"),
            )
        })
        .collect::<HashMap<_, _>>();
    let current_keys = sources
        .iter()
        .map(|source| source.key.as_str())
        .collect::<std::collections::HashSet<_>>();
    let mut tracked_keys = previous
        .keys()
        .cloned()
        .collect::<std::collections::HashSet<_>>();
    let page_source_rows = sqlx::query(
        "SELECT DISTINCT sources.source_kind, sources.source_id
         FROM wiki_page_sources sources
         JOIN wiki_pages pages ON pages.id = sources.page_id
         WHERE pages.research_interest_id = ?",
    )
    .bind(interest_id)
    .fetch_all(db)
    .await?;
    tracked_keys.extend(page_source_rows.into_iter().map(|row| {
        format!(
            "{}:{}",
            row.get::<String, _>("source_kind"),
            row.get::<String, _>("source_id")
        )
    }));
    let mut removed_keys = tracked_keys
        .into_iter()
        .filter(|key| !current_keys.contains(key.as_str()))
        .collect::<Vec<_>>();
    removed_keys.sort();
    let changed = sources
        .iter()
        .filter(|source| previous.get(&source.key) != Some(&source.hash))
        .cloned()
        .collect();
    Ok(SourceChanges {
        changed,
        removed_keys,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::SqlitePoolOptions;

    #[tokio::test]
    async fn detects_sources_removed_since_the_previous_compile() -> Result<()> {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await?;
        sqlx::raw_sql(
            "CREATE TABLE research_interests (id TEXT PRIMARY KEY);
             CREATE TABLE papers (
                id TEXT PRIMARY KEY, title TEXT NOT NULL, abstract TEXT, full_text TEXT,
                research_interest_id TEXT, updated_at TEXT
             );
             CREATE TABLE knowledge_notes (
                id TEXT PRIMARY KEY, title TEXT NOT NULL, content TEXT NOT NULL,
                research_interest_id TEXT, updated_at TEXT
             );",
        )
        .execute(&pool)
        .await?;
        super::super::super::schema::ensure_wiki_tables(&pool).await?;
        sqlx::raw_sql(
            "INSERT INTO research_interests (id) VALUES ('interest-1');
             INSERT INTO papers
                (id, title, full_text, research_interest_id)
             VALUES ('paper-1', 'Paper', 'current text', 'interest-1');
             INSERT INTO wiki_pages
                (id, research_interest_id, slug, title, summary, content)
             VALUES ('page-1', 'interest-1', 'deleted-note-topic', 'Topic', 'Summary', 'Body');
             INSERT INTO wiki_page_sources
                (id, page_id, source_kind, source_id, source_title)
             VALUES ('source-1', 'page-1', 'note', 'deleted-note', 'Deleted note');",
        )
        .execute(&pool)
        .await?;

        let sources = load_sources(&pool, "interest-1").await?;
        let changes = source_changes(&pool, "interest-1", &sources, false).await?;
        assert_eq!(changes.changed.len(), 1);
        assert_eq!(changes.removed_keys, vec!["note:deleted-note"]);
        Ok(())
    }
}
