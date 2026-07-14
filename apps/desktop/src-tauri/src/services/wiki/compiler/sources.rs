use super::SourceDocument;
use crate::services::wiki::shared::content_hash;
use anyhow::Result;
use sqlx::{Row, SqlitePool};
use std::collections::HashMap;

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

pub(super) async fn changed_sources(
    db: &SqlitePool,
    interest_id: &str,
    sources: &[SourceDocument],
    force: bool,
) -> Result<Vec<SourceDocument>> {
    if force {
        return Ok(sources.to_vec());
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
    Ok(sources
        .iter()
        .filter(|source| previous.get(&source.key) != Some(&source.hash))
        .cloned()
        .collect())
}
