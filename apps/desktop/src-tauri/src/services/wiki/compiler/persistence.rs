use super::{GeneratedPage, SourceDocument};
use crate::{
    llm::LlmClient,
    rag::serialize_embedding,
    services::wiki::shared::{chunk_markdown, content_hash, truncate_chars},
};
use anyhow::Result;
use sqlx::{Row, SqlitePool};
use std::collections::{HashMap, HashSet};
use uuid::Uuid;

pub(super) async fn persist_pages(
    db: &SqlitePool,
    interest_id: &str,
    run_id: &str,
    source_catalog: &[SourceDocument],
    processed_sources: &[SourceDocument],
    pages: &[GeneratedPage],
) -> Result<(usize, usize, Vec<String>)> {
    let source_map = source_catalog
        .iter()
        .map(|source| (source.key.clone(), source))
        .collect::<HashMap<_, _>>();
    let mut created = 0;
    let mut updated = 0;
    let mut page_ids = Vec::new();
    let now = chrono::Utc::now().to_rfc3339();
    let mut tx = db.begin().await?;

    for page in pages {
        let existing = sqlx::query("SELECT id, current_revision FROM wiki_pages WHERE research_interest_id = ? AND slug = ?")
            .bind(interest_id)
            .bind(&page.candidate.slug)
            .fetch_optional(&mut *tx)
            .await?;
        let (page_id, revision_number) = if let Some(row) = existing {
            updated += 1;
            (
                row.get::<String, _>("id"),
                row.get::<i64, _>("current_revision") + 1,
            )
        } else {
            created += 1;
            (Uuid::new_v4().to_string(), 1)
        };
        let revision_id = Uuid::new_v4().to_string();
        let mut manifest_items = page
            .candidate
            .source_keys
            .iter()
            .filter_map(|key| {
                source_map
                    .get(key)
                    .map(|source| format!("{}:{}", source.key, source.hash))
            })
            .collect::<Vec<_>>();
        manifest_items.sort();
        let manifest_hash = content_hash(&manifest_items.join("\n"));
        if revision_number == 1 {
            sqlx::query(
                "INSERT INTO wiki_pages
                 (id, research_interest_id, slug, title, page_type, summary, content, status,
                  confidence, current_revision, source_manifest_hash, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, 1, ?, ?, ?)",
            )
            .bind(&page_id)
            .bind(interest_id)
            .bind(&page.candidate.slug)
            .bind(&page.title)
            .bind(&page.candidate.page_type)
            .bind(&page.summary)
            .bind(&page.content)
            .bind(page.confidence)
            .bind(&manifest_hash)
            .bind(&now)
            .bind(&now)
            .execute(&mut *tx)
            .await?;
        } else {
            sqlx::query(
                "UPDATE wiki_pages SET title = ?, page_type = ?, summary = ?, content = ?, status = 'draft',
                 confidence = ?, current_revision = ?, source_manifest_hash = ?, updated_at = ? WHERE id = ?",
            )
            .bind(&page.title).bind(&page.candidate.page_type).bind(&page.summary).bind(&page.content)
            .bind(page.confidence).bind(revision_number).bind(&manifest_hash).bind(&now).bind(&page_id)
            .execute(&mut *tx).await?;
        }
        sqlx::query(
            "INSERT INTO wiki_page_revisions
             (id, page_id, revision_number, title, summary, content, change_summary, generator, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'llm-wiki', ?)",
        )
        .bind(&revision_id).bind(&page_id).bind(revision_number).bind(&page.title)
        .bind(&page.summary).bind(&page.content)
        .bind(if revision_number == 1 { "由来源编译创建" } else { "根据变更来源增量重编译" })
        .bind(&now).execute(&mut *tx).await?;

        sqlx::query("DELETE FROM wiki_page_sources WHERE page_id = ?")
            .bind(&page_id)
            .execute(&mut *tx)
            .await?;
        sqlx::query("DELETE FROM wiki_page_links WHERE from_page_id = ?")
            .bind(&page_id)
            .execute(&mut *tx)
            .await?;
        sqlx::query("DELETE FROM wiki_page_chunks WHERE page_id = ?")
            .bind(&page_id)
            .execute(&mut *tx)
            .await?;
        for key in &page.candidate.source_keys {
            let Some(source) = source_map.get(key) else {
                continue;
            };
            sqlx::query(
                "INSERT INTO wiki_page_sources
                 (id, page_id, revision_id, source_kind, source_id, source_title, locator, relation_kind, excerpt, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 'supports', ?, ?)",
            )
            .bind(Uuid::new_v4().to_string()).bind(&page_id).bind(&revision_id)
            .bind(&source.kind).bind(&source.id).bind(&source.title).bind(key)
            .bind(truncate_chars(&source.content, 500)).bind(&now)
            .execute(&mut *tx).await?;
        }
        for target_slug in &page.links {
            sqlx::query(
                "INSERT INTO wiki_page_links
                 (id, from_page_id, target_slug, relation_kind, created_at)
                 VALUES (?, ?, ?, 'related', ?)",
            )
            .bind(Uuid::new_v4().to_string())
            .bind(&page_id)
            .bind(target_slug)
            .bind(&now)
            .execute(&mut *tx)
            .await?;
        }
        for chunk in chunk_markdown(
            &format!("# {}\n\n{}\n\n{}", page.title, page.summary, page.content),
            1_200,
            160,
        ) {
            sqlx::query(
                "INSERT INTO wiki_page_chunks
                 (id, page_id, revision_id, chunk_index, heading_path, content, content_hash, token_count, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            )
            .bind(Uuid::new_v4().to_string()).bind(&page_id).bind(&revision_id)
            .bind(chunk.chunk_index as i64).bind(chunk.heading_path).bind(&chunk.content)
            .bind(chunk.content_hash).bind(chunk.content.chars().count() as i64 / 4).bind(&now)
            .execute(&mut *tx).await?;
        }
        page_ids.push(page_id);
    }

    for source in processed_sources {
        sqlx::query(
            "INSERT INTO wiki_compile_sources
             (id, research_interest_id, source_kind, source_id, content_hash, last_run_id, last_compiled_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(research_interest_id, source_kind, source_id) DO UPDATE SET
                content_hash = excluded.content_hash, last_run_id = excluded.last_run_id,
                last_compiled_at = excluded.last_compiled_at, last_error = NULL",
        )
        .bind(Uuid::new_v4().to_string()).bind(interest_id).bind(&source.kind).bind(&source.id)
        .bind(&source.hash).bind(run_id).bind(&now).execute(&mut *tx).await?;
    }
    tx.commit().await?;
    Ok((created, updated, page_ids))
}

/// 来源删除或移出研究方向时，立即让受影响页面退出检索，再清空该方向的编译哈希。
/// 后续自动编译会重新扫描全部现存来源；有剩余依据的页面会以同一 slug 恢复。
pub(super) async fn invalidate_removed_sources(
    db: &SqlitePool,
    interest_id: &str,
    removed_keys: &[String],
) -> Result<usize> {
    if removed_keys.is_empty() {
        return Ok(0);
    }
    let removed = removed_keys
        .iter()
        .map(String::as_str)
        .collect::<HashSet<_>>();
    let rows = sqlx::query(
        "SELECT DISTINCT sources.page_id, sources.source_kind, sources.source_id
         FROM wiki_page_sources sources
         JOIN wiki_pages pages ON pages.id = sources.page_id
         WHERE pages.research_interest_id = ?",
    )
    .bind(interest_id)
    .fetch_all(db)
    .await?;
    let mut affected_page_ids = rows
        .into_iter()
        .filter_map(|row| {
            let source_key = format!(
                "{}:{}",
                row.get::<String, _>("source_kind"),
                row.get::<String, _>("source_id")
            );
            removed
                .contains(source_key.as_str())
                .then(|| row.get::<String, _>("page_id"))
        })
        .collect::<Vec<_>>();
    affected_page_ids.sort();
    affected_page_ids.dedup();

    let now = chrono::Utc::now().to_rfc3339();
    let mut tx = db.begin().await?;
    for page_id in &affected_page_ids {
        sqlx::query("UPDATE wiki_pages SET status = 'archived', updated_at = ? WHERE id = ?")
            .bind(&now)
            .bind(page_id)
            .execute(&mut *tx)
            .await?;
        sqlx::query("DELETE FROM wiki_page_chunks WHERE page_id = ?")
            .bind(page_id)
            .execute(&mut *tx)
            .await?;
    }
    for key in removed_keys {
        let Some((source_kind, source_id)) = key.split_once(':') else {
            continue;
        };
        sqlx::query(
            "DELETE FROM wiki_page_sources
             WHERE page_id IN (SELECT id FROM wiki_pages WHERE research_interest_id = ?)
               AND source_kind = ? AND source_id = ?",
        )
        .bind(interest_id)
        .bind(source_kind)
        .bind(source_id)
        .execute(&mut *tx)
        .await?;
    }
    // 删除全部哈希，使剩余来源分批重新编译，而不是只处理删除事件。
    sqlx::query("DELETE FROM wiki_compile_sources WHERE research_interest_id = ?")
        .bind(interest_id)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(affected_page_ids.len())
}

pub(super) async fn resolve_links(db: &SqlitePool, interest_id: &str) -> Result<()> {
    sqlx::query(
        "UPDATE wiki_page_links SET to_page_id = (
            SELECT target.id FROM wiki_pages target
            JOIN wiki_pages source ON source.id = wiki_page_links.from_page_id
            WHERE target.research_interest_id = source.research_interest_id
              AND target.slug = wiki_page_links.target_slug
         ) WHERE from_page_id IN (SELECT id FROM wiki_pages WHERE research_interest_id = ?)",
    )
    .bind(interest_id)
    .execute(db)
    .await?;
    Ok(())
}

pub async fn refresh_embeddings_for_pages(
    db: &SqlitePool,
    settings: &HashMap<String, String>,
    page_ids: &[String],
) -> usize {
    if page_ids.is_empty() {
        return 0;
    }
    let client = match LlmClient::embed_client_from_settings(settings) {
        Ok(client) => client,
        Err(_) => return 0,
    };
    let mut rows = Vec::new();
    for page_id in page_ids {
        let Ok(mut chunks) = sqlx::query(
            "SELECT id, content FROM wiki_page_chunks WHERE page_id = ? AND embedding IS NULL ORDER BY chunk_index",
        )
        .bind(page_id)
        .fetch_all(db)
        .await else { continue; };
        rows.append(&mut chunks);
    }
    let mut refreshed = 0;
    for batch in rows.chunks(32) {
        let texts = batch
            .iter()
            .map(|row| row.get::<String, _>("content"))
            .collect::<Vec<_>>();
        let Ok(embeddings) = client.embed(&texts).await else {
            continue;
        };
        for (row, embedding) in batch.iter().zip(embeddings) {
            if sqlx::query("UPDATE wiki_page_chunks SET embedding = ? WHERE id = ?")
                .bind(serialize_embedding(&embedding))
                .bind(row.get::<String, _>("id"))
                .execute(db)
                .await
                .is_ok()
            {
                refreshed += 1;
            }
        }
    }
    refreshed
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::SqlitePoolOptions;

    #[tokio::test]
    async fn removed_sources_archive_affected_pages_and_clear_compile_hashes() -> Result<()> {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await?;
        sqlx::query("CREATE TABLE research_interests (id TEXT PRIMARY KEY)")
            .execute(&pool)
            .await?;
        super::super::super::schema::ensure_wiki_tables(&pool).await?;
        sqlx::query("INSERT INTO research_interests (id) VALUES ('interest-1')")
            .execute(&pool)
            .await?;
        sqlx::raw_sql(
            "INSERT INTO wiki_pages
                (id, research_interest_id, slug, title, summary, content, status)
             VALUES ('page-1', 'interest-1', 'topic', 'Topic', 'Summary', 'Body', 'draft');
             INSERT INTO wiki_page_sources
                (id, page_id, source_kind, source_id, source_title)
             VALUES ('page-source-1', 'page-1', 'note', 'note-1', 'Note');
             INSERT INTO wiki_page_chunks
                (id, page_id, chunk_index, content, content_hash)
             VALUES ('chunk-1', 'page-1', 0, 'Body', 'hash');
             INSERT INTO wiki_compile_sources
                (id, research_interest_id, source_kind, source_id, content_hash)
             VALUES ('compiled-1', 'interest-1', 'note', 'note-1', 'old-hash');",
        )
        .execute(&pool)
        .await?;

        let affected =
            invalidate_removed_sources(&pool, "interest-1", &["note:note-1".into()]).await?;
        let status: String =
            sqlx::query_scalar("SELECT status FROM wiki_pages WHERE id = 'page-1'")
                .fetch_one(&pool)
                .await?;
        let chunk_count: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM wiki_page_chunks WHERE page_id = 'page-1'")
                .fetch_one(&pool)
                .await?;
        let source_count: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM wiki_page_sources WHERE page_id = 'page-1'")
                .fetch_one(&pool)
                .await?;
        let compiled_count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM wiki_compile_sources WHERE research_interest_id = 'interest-1'",
        )
        .fetch_one(&pool)
        .await?;

        assert_eq!(affected, 1);
        assert_eq!(status, "archived");
        assert_eq!(chunk_count, 0);
        assert_eq!(source_count, 0);
        assert_eq!(compiled_count, 0);
        Ok(())
    }
}
