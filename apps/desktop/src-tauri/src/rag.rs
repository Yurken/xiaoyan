use anyhow::Result;
use sqlx::{Row, SqlitePool};

// ── Text chunking ───────────────────────────────────────────────

pub struct Chunk {
    pub chunk_index: usize,
    pub content: String,
}

pub fn chunk_text(text: &str, chunk_size: usize, overlap: usize) -> Vec<Chunk> {
    let text = normalize(text);
    let mut chunks = Vec::new();
    let mut start = 0usize;
    let mut idx = 0usize;

    while start < text.len() {
        let end = (start + chunk_size).min(text.len());
        let end = if end < text.len() {
            text[start..end]
                .rfind(". ")
                .filter(|&p| p > chunk_size / 2)
                .map(|p| start + p + 1)
                .unwrap_or(end)
        } else {
            end
        };
        let content = text[start..end].trim().to_string();
        if !content.is_empty() {
            chunks.push(Chunk { chunk_index: idx, content });
            idx += 1;
        }
        if end >= text.len() { break; }
        start = end.saturating_sub(overlap);
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
    pub content: String,
    pub source: String,
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
            "SELECT id, content, chunk_index, embedding FROM paper_chunks WHERE paper_id = ? AND embedding IS NOT NULL",
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
            (id, content, format!("chunk_{}", idx), emb)
        })
        .collect::<Vec<_>>()
    } else {
        sqlx::query(
            "SELECT pc.id, pc.content, pc.chunk_index, pc.embedding, p.title
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
            (id, content, title, emb)
        })
        .collect::<Vec<_>>()
    };

    let mut results: Vec<SearchResult> = rows
        .into_iter()
        .filter_map(|(id, content, source, emb_opt)| {
            let emb = parse_embedding(emb_opt?.as_str());
            if emb.is_empty() { return None; }
            let score = cosine_similarity(query_embedding, &emb);
            Some(SearchResult { id, content, source, score })
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
            Some(SearchResult { id, content, source: title, score })
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
