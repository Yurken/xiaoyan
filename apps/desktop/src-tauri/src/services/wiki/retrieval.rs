use super::shared::{lexical_score, query_terms};
use crate::{
    links::paper_reference_url,
    rag::{cosine_similarity, parse_embedding, SearchResult},
};
use anyhow::Result;
use sqlx::{Row, SqlitePool};
use std::collections::HashMap;

pub async fn search_wiki_chunks(
    db: &SqlitePool,
    query_embedding: &[f32],
    top_k: usize,
) -> Result<Vec<SearchResult>> {
    let rows = sqlx::query(
        "SELECT c.id, c.content, c.heading_path, c.embedding,
                p.id AS page_id, p.title, p.slug, p.status
         FROM wiki_page_chunks c JOIN wiki_pages p ON p.id = c.page_id
         WHERE c.embedding IS NOT NULL AND p.status != 'archived'",
    )
    .fetch_all(db)
    .await?;
    let mut results = rows
        .into_iter()
        .filter_map(|row| {
            let embedding = parse_embedding(row.get::<Option<String>, _>("embedding")?.as_str());
            if embedding.is_empty() {
                return None;
            }
            let page_id: String = row.get("page_id");
            let title: String = row.get("title");
            let heading: String = row.get("heading_path");
            let status: String = row.get("status");
            let status_weight = wiki_status_weight(&status);
            let source_prefix = wiki_source_prefix(&status);
            Some(SearchResult {
                id: row.get("id"),
                entity_type: "wiki".into(),
                entity_id: page_id,
                content: row.get("content"),
                source: if heading.is_empty() {
                    format!("{source_prefix} · {title}")
                } else {
                    format!("{source_prefix} · {title} · {heading}")
                },
                url: None,
                score: cosine_similarity(query_embedding, &embedding) * status_weight,
            })
        })
        .collect::<Vec<_>>();
    sort_and_truncate(&mut results, top_k);
    Ok(results)
}

pub async fn hybrid_search(
    db: &SqlitePool,
    query: &str,
    query_embedding: Option<&[f32]>,
    top_k: usize,
) -> Result<Vec<SearchResult>> {
    if top_k == 0 {
        return Ok(Vec::new());
    }
    let semantic = match query_embedding {
        Some(embedding) => crate::rag::combined_search(db, embedding, top_k * 4).await?,
        None => Vec::new(),
    };
    let lexical = lexical_search(db, query, top_k * 6).await?;
    let direct = reciprocal_rank_fusion(semantic, lexical, top_k);
    expand_wiki_links(db, direct, top_k).await
}

async fn lexical_search(db: &SqlitePool, query: &str, top_k: usize) -> Result<Vec<SearchResult>> {
    let terms = query_terms(query);
    if terms.is_empty() {
        return Ok(Vec::new());
    }
    let mut results = Vec::new();

    let paper_rows = sqlx::query(
        "SELECT pc.id, pc.content, pc.chunk_index, p.id AS paper_id, p.title, p.doi, p.file_path
         FROM paper_chunks pc JOIN papers p ON p.id = pc.paper_id
         ORDER BY p.updated_at DESC, pc.chunk_index LIMIT 4000",
    )
    .fetch_all(db)
    .await?;
    for row in paper_rows {
        let title: String = row.get("title");
        let content: String = row.get("content");
        let score = lexical_score(&title, &content, &terms);
        if score <= 0.0 {
            continue;
        }
        let index: i64 = row.get("chunk_index");
        let doi: Option<String> = row.get("doi");
        let file_path: Option<String> = row.get("file_path");
        results.push(SearchResult {
            id: row.get("id"),
            entity_type: "paper".into(),
            entity_id: row.get("paper_id"),
            content,
            source: format!("{title} · chunk_{index}"),
            url: paper_reference_url(Some(&title), doi.as_deref(), file_path.as_deref()),
            score,
        });
    }

    let note_rows = sqlx::query(
        "SELECT id, title, content FROM knowledge_notes ORDER BY updated_at DESC LIMIT 2000",
    )
    .fetch_all(db)
    .await?;
    for row in note_rows {
        let title: String = row.get("title");
        let content: String = row.get("content");
        let score = lexical_score(&title, &content, &terms);
        if score <= 0.0 {
            continue;
        }
        let id: String = row.get("id");
        results.push(SearchResult {
            id: id.clone(),
            entity_type: "note".into(),
            entity_id: id,
            content,
            source: title,
            url: None,
            score,
        });
    }

    let wiki_rows = sqlx::query(
        "SELECT c.id, c.content, c.heading_path, p.id AS page_id, p.title, p.status
         FROM wiki_page_chunks c JOIN wiki_pages p ON p.id = c.page_id
         WHERE p.status != 'archived' ORDER BY p.updated_at DESC, c.chunk_index LIMIT 2000",
    )
    .fetch_all(db)
    .await?;
    for row in wiki_rows {
        let title: String = row.get("title");
        let content: String = row.get("content");
        let score = lexical_score(&title, &content, &terms);
        if score <= 0.0 {
            continue;
        }
        let heading: String = row.get("heading_path");
        let status: String = row.get("status");
        let source_prefix = wiki_source_prefix(&status);
        results.push(SearchResult {
            id: row.get("id"),
            entity_type: "wiki".into(),
            entity_id: row.get("page_id"),
            content,
            source: if heading.is_empty() {
                format!("{source_prefix} · {title}")
            } else {
                format!("{source_prefix} · {title} · {heading}")
            },
            url: None,
            score: score * wiki_status_weight(&status),
        });
    }
    sort_and_truncate(&mut results, top_k);
    Ok(results)
}

fn wiki_status_weight(status: &str) -> f32 {
    match status {
        "reviewed" => 1.0,
        "contested" => 0.6,
        _ => 0.72,
    }
}

fn wiki_source_prefix(status: &str) -> &'static str {
    match status {
        "reviewed" => "Wiki",
        "contested" => "Wiki（有争议）",
        _ => "Wiki（待审阅）",
    }
}

async fn expand_wiki_links(
    db: &SqlitePool,
    direct: Vec<SearchResult>,
    top_k: usize,
) -> Result<Vec<SearchResult>> {
    let reserve = (top_k / 5).max(1).min(top_k);
    let mut expanded = Vec::new();
    let mut seen = direct
        .iter()
        .map(|result| format!("{}:{}", result.entity_type, result.entity_id))
        .collect::<std::collections::HashSet<_>>();
    for seed in direct
        .iter()
        .filter(|result| result.entity_type == "wiki")
        .take(3)
    {
        let rows = sqlx::query(
            "SELECT DISTINCT p.id, p.title, p.summary, p.content, p.status
             FROM wiki_pages p
             WHERE p.status != 'archived' AND p.id IN (
                SELECT to_page_id FROM wiki_page_links WHERE from_page_id = ? AND to_page_id IS NOT NULL
                UNION
                SELECT from_page_id FROM wiki_page_links WHERE to_page_id = ?
             ) LIMIT 6",
        )
        .bind(&seed.entity_id)
        .bind(&seed.entity_id)
        .fetch_all(db)
        .await?;
        for row in rows {
            let page_id: String = row.get("id");
            let key = format!("wiki:{page_id}");
            if !seen.insert(key) {
                continue;
            }
            let title: String = row.get("title");
            let summary: String = row.get("summary");
            let content: String = row.get("content");
            let status: String = row.get("status");
            expanded.push(SearchResult {
                id: page_id.clone(),
                entity_type: "wiki".into(),
                entity_id: page_id,
                content: super::shared::truncate_chars(&format!("{summary}\n\n{content}"), 1_200),
                source: format!("{} 关联 · {title}", wiki_source_prefix(&status)),
                url: None,
                score: seed.score * 0.45 * wiki_status_weight(&status),
            });
        }
    }
    expanded.sort_by(|a, b| {
        b.score
            .partial_cmp(&a.score)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    expanded.truncate(reserve);
    if expanded.is_empty() {
        return Ok(direct);
    }
    let direct_limit = top_k.saturating_sub(expanded.len());
    let mut results = direct.into_iter().take(direct_limit).collect::<Vec<_>>();
    results.extend(expanded);
    results.sort_by(|a, b| {
        b.score
            .partial_cmp(&a.score)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    Ok(results)
}

fn sort_and_truncate(results: &mut Vec<SearchResult>, top_k: usize) {
    results.sort_by(|a, b| {
        b.score
            .partial_cmp(&a.score)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    results.truncate(top_k);
}

fn reciprocal_rank_fusion(
    semantic: Vec<SearchResult>,
    lexical: Vec<SearchResult>,
    top_k: usize,
) -> Vec<SearchResult> {
    const RRF_K: f32 = 60.0;
    let mut fused: HashMap<String, (SearchResult, f32)> = HashMap::new();
    for (weight, ranked) in [(1.0_f32, semantic), (1.15_f32, lexical)] {
        let mut channel_seen = std::collections::HashSet::new();
        for (rank, result) in ranked.into_iter().enumerate() {
            let key = format!("{}:{}", result.entity_type, result.entity_id);
            let tail_weight = if channel_seen.insert(key.clone()) {
                1.0
            } else {
                0.3
            };
            let contribution = weight / (RRF_K + rank as f32 + 1.0) * tail_weight;
            fused
                .entry(key)
                .and_modify(|entry| {
                    entry.1 += contribution;
                })
                .or_insert((result, contribution));
        }
    }
    let normalizer = (1.0 + 1.15) / (RRF_K + 1.0);
    let mut results = fused
        .into_values()
        .map(|(mut result, score)| {
            result.score = (score / normalizer).min(1.0);
            result
        })
        .collect::<Vec<_>>();
    sort_and_truncate(&mut results, top_k);
    results
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::SqlitePoolOptions;

    fn result(id: &str, entity_id: &str) -> SearchResult {
        SearchResult {
            id: id.into(),
            entity_type: "wiki".into(),
            entity_id: entity_id.into(),
            content: id.into(),
            source: id.into(),
            url: None,
            score: 1.0,
        }
    }

    #[test]
    fn rrf_rewards_results_found_by_both_channels_and_aggregates_chunks() {
        let fused = reciprocal_rank_fusion(
            vec![result("a-1", "a"), result("b-1", "b"), result("b-2", "b")],
            vec![result("a-2", "a")],
            5,
        );
        assert_eq!(fused.len(), 2);
        assert_eq!(fused[0].entity_id, "a");
        assert!(fused
            .iter()
            .all(|item| item.score > 0.0 && item.score <= 1.0));
    }

    #[tokio::test]
    async fn lexical_fallback_searches_papers_notes_and_wiki_without_embeddings() -> Result<()> {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await?;
        sqlx::raw_sql(
            "CREATE TABLE research_interests (id TEXT PRIMARY KEY);
             CREATE TABLE papers (
                id TEXT PRIMARY KEY, title TEXT NOT NULL, doi TEXT, file_path TEXT,
                research_interest_id TEXT, updated_at TEXT NOT NULL
             );
             CREATE TABLE paper_chunks (
                id TEXT PRIMARY KEY, paper_id TEXT NOT NULL, chunk_index INTEGER NOT NULL,
                content TEXT NOT NULL, embedding TEXT
             );
             CREATE TABLE knowledge_notes (
                id TEXT PRIMARY KEY, title TEXT NOT NULL, content TEXT NOT NULL,
                embedding TEXT, updated_at TEXT NOT NULL
             );",
        )
        .execute(&pool)
        .await?;
        super::super::schema::ensure_wiki_tables(&pool).await?;
        sqlx::raw_sql(
            "INSERT INTO research_interests (id) VALUES ('interest-1');
             INSERT INTO papers (id, title, updated_at) VALUES ('paper-1', 'Graph Retrieval Paper', '2026-01-01');
             INSERT INTO paper_chunks (id, paper_id, chunk_index, content) VALUES ('chunk-1', 'paper-1', 0, 'hybrid graph retrieval evidence');
             INSERT INTO knowledge_notes (id, title, content, updated_at) VALUES ('note-1', 'Retrieval note', 'graph retrieval notes', '2026-01-01');
             INSERT INTO wiki_pages (id, research_interest_id, slug, title, content, status)
                VALUES ('page-1', 'interest-1', 'graph-retrieval', 'Graph Retrieval', 'hybrid graph retrieval overview', 'reviewed');
             INSERT INTO wiki_page_chunks (id, page_id, chunk_index, content, content_hash)
                VALUES ('wiki-chunk-1', 'page-1', 0, 'hybrid graph retrieval overview', 'hash');
             INSERT INTO wiki_pages (id, research_interest_id, slug, title, content, status)
                VALUES ('page-2', 'interest-1', 'linked-method', 'Linked Method', 'neighbor context', 'reviewed');
             INSERT INTO wiki_page_chunks (id, page_id, chunk_index, content, content_hash)
                VALUES ('wiki-chunk-2', 'page-2', 0, 'neighbor context', 'hash-2');
             INSERT INTO wiki_page_links (id, from_page_id, to_page_id, target_slug)
                VALUES ('link-1', 'page-1', 'page-2', 'linked-method');",
        )
        .execute(&pool)
        .await?;

        let results = hybrid_search(&pool, "graph retrieval", None, 10).await?;
        let entity_types = results
            .iter()
            .map(|result| result.entity_type.as_str())
            .collect::<std::collections::HashSet<_>>();
        assert!(entity_types.contains("paper"));
        assert!(entity_types.contains("note"));
        assert!(entity_types.contains("wiki"));
        assert!(results.iter().any(|result| result.entity_id == "page-2"));
        Ok(())
    }
}
