use crate::links::paper_reference_url;
use anyhow::Result;
use sqlx::{Row, SqlitePool};

// ── Text chunking ───────────────────────────────────────────────

pub struct Chunk {
    pub chunk_index: usize,
    pub content: String,
}

fn floor_char_boundary(text: &str, mut idx: usize) -> usize {
    let len = text.len();
    if idx >= len {
        return len;
    }
    while idx > 0 && !text.is_char_boundary(idx) {
        idx -= 1;
    }
    idx
}

pub fn chunk_text(text: &str, chunk_size: usize, overlap: usize) -> Vec<Chunk> {
    if chunk_size == 0 {
        return Vec::new();
    }

    let text = normalize(text);
    let mut chunks = Vec::new();
    let mut start = 0usize;
    let mut idx = 0usize;
    let overlap = overlap.min(chunk_size.saturating_sub(1));

    while start < text.len() {
        let start_idx = floor_char_boundary(&text, start);
        let rough_end = (start_idx + chunk_size).min(text.len());
        let mut end = floor_char_boundary(&text, rough_end);

        if end <= start_idx {
            // Ensure forward progress even when chunk_size lands inside a multi-byte character.
            end = text[start_idx..]
                .char_indices()
                .nth(1)
                .map(|(offset, _)| start_idx + offset)
                .unwrap_or(text.len());
        }

        let end = if end < text.len() {
            text[start_idx..end]
                .rfind(". ")
                .filter(|&p| p > chunk_size / 2)
                .map(|p| start_idx + p + 1)
                .unwrap_or(end)
        } else {
            end
        };

        if end <= start_idx {
            break;
        }

        let content = text[start_idx..end].trim().to_string();
        if !content.is_empty() {
            chunks.push(Chunk { chunk_index: idx, content });
            idx += 1;
        }
        if end >= text.len() { break; }
        let next = end.saturating_sub(overlap);
        start = if next <= start_idx { end } else { next };
    }
    chunks
}

fn normalize(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut blank = 0u32;
    for line in text.lines() {
        let t = line.trim_end();
        if t.is_empty() {
            blank += 1;
            if blank <= 2 { out.push('\n'); }
        } else {
            blank = 0;
            out.push_str(t);
            out.push('\n');
        }
    }
    out
}

// ── Cosine similarity ───────────────────────────────────────────

pub fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    let dot: f32 = a.iter().zip(b).map(|(x, y)| x * y).sum();
    let na: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
    let nb: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();
    if na == 0.0 || nb == 0.0 { 0.0 } else { dot / (na * nb) }
}

pub fn parse_embedding(json_str: &str) -> Vec<f32> {
    serde_json::from_str(json_str).unwrap_or_default()
}

pub fn serialize_embedding(v: &[f32]) -> String {
    serde_json::to_string(v).unwrap_or_else(|_| "[]".into())
}

// ── Semantic search ─────────────────────────────────────────────

pub struct SearchResult {
    pub id: String,
    pub entity_type: String,
    pub entity_id: String,
    pub content: String,
    pub source: String,
    pub url: Option<String>,
    pub score: f32,
}

pub async fn search_paper_chunks(
    db: &SqlitePool,
    query_embedding: &[f32],
    paper_id: Option<&str>,
    top_k: usize,
) -> Result<Vec<SearchResult>> {
    let rows = if let Some(pid) = paper_id {
        sqlx::query(
            "SELECT pc.id, pc.content, pc.chunk_index, pc.embedding, p.id as paper_id, p.title, p.doi, p.file_path
             FROM paper_chunks pc
             JOIN papers p ON pc.paper_id = p.id
             WHERE pc.paper_id = ? AND pc.embedding IS NOT NULL",
        )
        .bind(pid)
        .fetch_all(db)
        .await?
        .into_iter()
        .map(|r| {
            let id: String = r.get("id");
            let content: String = r.get("content");
            let idx: i64 = r.get("chunk_index");
            let emb: Option<String> = r.get("embedding");
            let title: String = r.get("title");
            let doi: Option<String> = r.get("doi");
            let file_path: Option<String> = r.get("file_path");
            let source = format!("{} · chunk_{}", title, idx);
            let url = paper_reference_url(Some(&title), doi.as_deref(), file_path.as_deref());
            let paper_id: String = r.get("paper_id");
            (id, paper_id, content, source, emb, url)
        })
        .collect::<Vec<_>>()
    } else {
        sqlx::query(
            "SELECT pc.id, pc.content, pc.chunk_index, pc.embedding, p.id as paper_id, p.title, p.doi, p.file_path
             FROM paper_chunks pc JOIN papers p ON pc.paper_id = p.id
             WHERE pc.embedding IS NOT NULL",
        )
        .fetch_all(db)
        .await?
        .into_iter()
        .map(|r| {
            let id: String = r.get("id");
            let content: String = r.get("content");
            let title: String = r.get("title");
            let emb: Option<String> = r.get("embedding");
            let doi: Option<String> = r.get("doi");
            let file_path: Option<String> = r.get("file_path");
            let url = paper_reference_url(Some(&title), doi.as_deref(), file_path.as_deref());
            let paper_id: String = r.get("paper_id");
            (id, paper_id, content, title, emb, url)
        })
        .collect::<Vec<_>>()
    };

    let mut results: Vec<SearchResult> = rows
        .into_iter()
        .filter_map(|(id, paper_id, content, source, emb_opt, url)| {
            let emb = parse_embedding(emb_opt?.as_str());
            if emb.is_empty() { return None; }
            let score = cosine_similarity(query_embedding, &emb);
            Some(SearchResult {
                id,
                entity_type: "paper".to_string(),
                entity_id: paper_id,
                content,
                source,
                url,
                score,
            })
        })
        .collect();

    results.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
    results.truncate(top_k);
    Ok(results)
}

pub async fn search_knowledge_notes(
    db: &SqlitePool,
    query_embedding: &[f32],
    top_k: usize,
) -> Result<Vec<SearchResult>> {
    let rows = sqlx::query(
        "SELECT id, title, content, embedding FROM knowledge_notes WHERE embedding IS NOT NULL",
    )
    .fetch_all(db)
    .await?;

    let mut results: Vec<SearchResult> = rows
        .into_iter()
        .filter_map(|r| {
            let id: String = r.get("id");
            let content: String = r.get("content");
            let title: String = r.get("title");
            let emb_opt: Option<String> = r.get("embedding");
            let emb = parse_embedding(emb_opt?.as_str());
            if emb.is_empty() { return None; }
            let score = cosine_similarity(query_embedding, &emb);
            Some(SearchResult {
                id: id.clone(),
                entity_type: "note".to_string(),
                entity_id: id,
                content,
                source: title,
                url: None,
                score,
            })
        })
        .collect();

    results.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
    results.truncate(top_k);
    Ok(results)
}

pub async fn combined_search(
    db: &SqlitePool,
    query_embedding: &[f32],
    top_k: usize,
) -> Result<Vec<SearchResult>> {
    let mut results = Vec::new();
    results.extend(search_paper_chunks(db, query_embedding, None, top_k).await?);
    results.extend(search_knowledge_notes(db, query_embedding, top_k).await?);
    results.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
    results.truncate(top_k);
    Ok(results)
}
