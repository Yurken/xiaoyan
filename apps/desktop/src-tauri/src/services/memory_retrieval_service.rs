use crate::rag::{cosine_similarity, parse_embedding};
use crate::services::memory_checkpoint_service::checkpoint_to_memory_line;
use serde::Serialize;
use sqlx::{Row, SqlitePool};
use std::collections::{HashMap, HashSet};

const CONTEXT_BUDGET: usize = 4000;
/// 近期候选窗口（天）与条数：保证 recency / 关键词覆盖。
const RECENT_WINDOW_DAYS: i64 = 90;
const RECENT_LIMIT: i64 = 150;
/// 语义候选条数：把更久远但已有 embedding 的观察也纳入候选，突破纯时间窗的盲区。
const EMBEDDED_LIMIT: i64 = 400;
/// 语义相似度并入打分时的权重（cosine ∈ [0,1] 时贡献 0..SEMANTIC_WEIGHT 分）。
const SEMANTIC_WEIGHT: f32 = 40.0;

#[derive(Debug, Clone, Serialize)]
pub struct RetrievedMemoryObservation {
    pub id: String,
    pub source: String,
    pub event_type: String,
    pub title: String,
    pub summary: String,
    pub narrative: String,
    pub importance: i64,
    pub created_at: String,
    pub score: i64,
}

#[derive(Debug, Clone)]
struct MemoryObservationCandidate {
    id: String,
    source: String,
    event_type: String,
    title: String,
    summary: String,
    narrative: String,
    importance: i64,
    created_at: String,
    recency_rank: usize,
    embedding: Option<Vec<f32>>,
}

fn safe_truncate(s: &str, max_bytes: usize) -> &str {
    if s.len() <= max_bytes {
        return s;
    }
    let mut end = max_bytes;
    while end > 0 && !s.is_char_boundary(end) {
        end -= 1;
    }
    &s[..end]
}

fn is_cjk(ch: char) -> bool {
    matches!(
        ch as u32,
        0x4E00..=0x9FFF | 0x3400..=0x4DBF | 0x20000..=0x2A6DF | 0x2A700..=0x2B73F
    )
}

fn flush_ascii_token(buffer: &mut String, tokens: &mut Vec<String>) {
    if buffer.len() >= 2 {
        tokens.push(buffer.to_lowercase());
    }
    buffer.clear();
}

fn flush_cjk_tokens(buffer: &mut String, tokens: &mut Vec<String>) {
    if buffer.is_empty() {
        return;
    }
    let chars = buffer.chars().collect::<Vec<_>>();
    if chars.len() == 1 {
        tokens.push(chars[0].to_string());
    } else {
        for window in chars.windows(2) {
            tokens.push(window.iter().collect::<String>());
        }
        for ch in chars {
            tokens.push(ch.to_string());
        }
    }
    buffer.clear();
}

fn extract_search_tokens(text: &str) -> Vec<String> {
    let mut ascii_buffer = String::new();
    let mut cjk_buffer = String::new();
    let mut tokens = Vec::new();

    for ch in text.chars() {
        if ch.is_ascii_alphanumeric() {
            flush_cjk_tokens(&mut cjk_buffer, &mut tokens);
            ascii_buffer.push(ch.to_ascii_lowercase());
        } else if is_cjk(ch) {
            flush_ascii_token(&mut ascii_buffer, &mut tokens);
            cjk_buffer.push(ch);
        } else {
            flush_ascii_token(&mut ascii_buffer, &mut tokens);
            flush_cjk_tokens(&mut cjk_buffer, &mut tokens);
        }
    }

    flush_ascii_token(&mut ascii_buffer, &mut tokens);
    flush_cjk_tokens(&mut cjk_buffer, &mut tokens);

    let mut seen = HashSet::new();
    tokens
        .into_iter()
        .filter(|token| seen.insert(token.clone()))
        .collect()
}

fn compact_query_text(text: &str) -> String {
    text.chars()
        .filter(|ch| !ch.is_whitespace())
        .collect::<String>()
}

fn score_field(field: &str, token: &str, base_score: i64) -> i64 {
    if field.contains(token) {
        if token.chars().count() > 1 {
            base_score
        } else {
            1
        }
    } else {
        0
    }
}

fn score_candidate(
    candidate: &MemoryObservationCandidate,
    query: &str,
    query_tokens: &[String],
    query_embedding: Option<&[f32]>,
) -> i64 {
    let title = candidate.title.to_lowercase();
    let summary = candidate.summary.to_lowercase();
    let narrative = candidate.narrative.to_lowercase();
    let source = candidate.source.to_lowercase();
    let event_type = candidate.event_type.to_lowercase();
    let compact_query = compact_query_text(query);

    let mut score = candidate.importance * 4;
    for token in query_tokens {
        score += score_field(&title, token, 9);
        score += score_field(&summary, token, 7);
        score += score_field(&narrative, token, 4);
        score += score_field(&source, token, 3);
        score += score_field(&event_type, token, 2);
    }

    if compact_query.chars().count() >= 2 {
        if title.contains(&compact_query) {
            score += 16;
        }
        if summary.contains(&compact_query) {
            score += 12;
        }
        if narrative.contains(&compact_query) {
            score += 8;
        }
    }

    // 语义相似度并入打分：让概念相关但字面不命中的观察也能被召回。
    // 仅在 query 与候选都有 embedding 时生效；否则保持纯关键词行为。
    if let (Some(query_vec), Some(candidate_vec)) =
        (query_embedding, candidate.embedding.as_deref())
    {
        let similarity = cosine_similarity(query_vec, candidate_vec);
        if similarity > 0.0 {
            score += (similarity * SEMANTIC_WEIGHT).round() as i64;
        }
    }

    let recency_bonus = (12_i64 - (candidate.recency_rank as i64 / 8)).max(0);
    score + recency_bonus
}

fn row_to_candidate(row: &sqlx::sqlite::SqliteRow) -> MemoryObservationCandidate {
    let embedding = row
        .get::<Option<String>, _>("embedding")
        .map(|raw| parse_embedding(&raw))
        .filter(|vector| !vector.is_empty());
    MemoryObservationCandidate {
        id: row.get::<String, _>("id"),
        source: row.get::<String, _>("source"),
        event_type: row.get::<String, _>("event_type"),
        title: row.get::<String, _>("title"),
        summary: row.get::<String, _>("summary"),
        narrative: row.get::<String, _>("narrative"),
        importance: row.get::<i64, _>("importance"),
        created_at: row.get::<String, _>("created_at"),
        recency_rank: 0,
        embedding,
    }
}

/// 候选集 = 近期窗口（recency / 关键词覆盖）∪ 已有 embedding 的更久远观察（语义覆盖）。
/// 当存在 query embedding 时才纳入第二部分，避免无谓全表扫描。合并去重后按时间重排，
/// 重新计算 recency_rank。
async fn load_candidates(db: &SqlitePool, want_semantic: bool) -> Vec<MemoryObservationCandidate> {
    let recent = sqlx::query(
        "SELECT id, source, event_type, title, summary, narrative, importance, created_at, embedding
         FROM memory_observations
         WHERE created_at >= datetime('now', ?)
         ORDER BY created_at DESC
         LIMIT ?",
    )
    .bind(format!("-{RECENT_WINDOW_DAYS} days"))
    .bind(RECENT_LIMIT)
    .fetch_all(db)
    .await
    .unwrap_or_default();

    let mut by_id: HashMap<String, MemoryObservationCandidate> = HashMap::new();
    for row in &recent {
        let candidate = row_to_candidate(row);
        by_id.insert(candidate.id.clone(), candidate);
    }

    if want_semantic {
        let embedded = sqlx::query(
            "SELECT id, source, event_type, title, summary, narrative, importance, created_at, embedding
             FROM memory_observations
             WHERE embedding IS NOT NULL
             ORDER BY created_at DESC
             LIMIT ?",
        )
        .bind(EMBEDDED_LIMIT)
        .fetch_all(db)
        .await
        .unwrap_or_default();
        for row in &embedded {
            let candidate = row_to_candidate(row);
            by_id.entry(candidate.id.clone()).or_insert(candidate);
        }
    }

    let mut candidates: Vec<MemoryObservationCandidate> = by_id.into_values().collect();
    candidates.sort_by(|left, right| right.created_at.cmp(&left.created_at));
    for (index, candidate) in candidates.iter_mut().enumerate() {
        candidate.recency_rank = index;
    }
    candidates
}

fn fallback_recent_observations(
    candidates: &[MemoryObservationCandidate],
    limit: usize,
) -> Vec<RetrievedMemoryObservation> {
    candidates
        .iter()
        .filter(|candidate| candidate.importance >= 2)
        .take(limit)
        .map(|candidate| RetrievedMemoryObservation {
            id: candidate.id.clone(),
            source: candidate.source.clone(),
            event_type: candidate.event_type.clone(),
            title: candidate.title.clone(),
            summary: candidate.summary.clone(),
            narrative: candidate.narrative.clone(),
            importance: candidate.importance,
            created_at: candidate.created_at.clone(),
            score: candidate.importance * 4,
        })
        .collect()
}

pub async fn search_relevant_observations(
    db: &SqlitePool,
    query: &str,
    query_embedding: Option<&[f32]>,
    limit: usize,
) -> Vec<RetrievedMemoryObservation> {
    let candidates = load_candidates(db, query_embedding.is_some()).await;
    let query_tokens = extract_search_tokens(query);

    // 关键词与语义都无从下手时，退回「近期高重要度观察」。
    if query_tokens.is_empty() && query_embedding.is_none() {
        return fallback_recent_observations(&candidates, limit);
    }

    let normalized_query = query.to_lowercase();
    let mut scored = candidates
        .iter()
        .map(|candidate| {
            let score =
                score_candidate(candidate, &normalized_query, &query_tokens, query_embedding);
            RetrievedMemoryObservation {
                id: candidate.id.clone(),
                source: candidate.source.clone(),
                event_type: candidate.event_type.clone(),
                title: candidate.title.clone(),
                summary: candidate.summary.clone(),
                narrative: candidate.narrative.clone(),
                importance: candidate.importance,
                created_at: candidate.created_at.clone(),
                score,
            }
        })
        .filter(|candidate| candidate.score > 0)
        .collect::<Vec<_>>();

    scored.sort_by(|left, right| {
        right
            .score
            .cmp(&left.score)
            .then_with(|| right.importance.cmp(&left.importance))
            .then_with(|| right.created_at.cmp(&left.created_at))
    });

    let mut results = scored.into_iter().take(limit).collect::<Vec<_>>();
    if results.is_empty() {
        results = fallback_recent_observations(&candidates, limit);
    }
    results
}

fn format_short_timestamp(timestamp: &str) -> String {
    if timestamp.len() >= 16 {
        timestamp[5..16].to_string()
    } else {
        timestamp.to_string()
    }
}

async fn build_memory_context_internal(
    db: &SqlitePool,
    query: Option<&str>,
    query_embedding: Option<&[f32]>,
) -> String {
    let manual_rows = sqlx::query(
        "SELECT summary FROM user_memories WHERE type = 'manual'
         ORDER BY created_at DESC LIMIT 10",
    )
    .fetch_all(db)
    .await
    .unwrap_or_default();

    let manual_lines: Vec<String> = manual_rows
        .iter()
        .map(|row| format!("• {}", row.get::<String, _>("summary")))
        .collect();

    let relevant_observations = if let Some(raw_query) = query {
        let trimmed = raw_query.trim();
        if trimmed.is_empty() {
            fallback_recent_observations(&load_candidates(db, false).await, 6)
        } else {
            search_relevant_observations(db, trimmed, query_embedding, 5).await
        }
    } else {
        fallback_recent_observations(&load_candidates(db, false).await, 6)
    };

    let observation_lines = relevant_observations
        .iter()
        .map(|item| {
            format!(
                "  {} [{}] {}",
                format_short_timestamp(&item.created_at),
                item.source,
                item.summary
            )
        })
        .collect::<Vec<_>>();

    let checkpoint_lines = load_recent_checkpoint_lines(db).await;

    let recent_rows = sqlx::query(
        "SELECT summary, created_at FROM user_memories
         WHERE type = 'auto'
           AND created_at >= datetime('now', '-3 hours')
         ORDER BY created_at DESC LIMIT 20",
    )
    .fetch_all(db)
    .await
    .unwrap_or_default();

    let recent_lines: Vec<String> = recent_rows
        .iter()
        .map(|row| {
            let summary: String = row.get("summary");
            let created_at: String = row.get("created_at");
            let time = if created_at.len() >= 16 {
                created_at[11..16].to_string()
            } else {
                created_at
            };
            format!("  {time} {summary}")
        })
        .collect();

    let hist_rows = sqlx::query(
        "SELECT date(created_at) AS day, group_concat(summary, '；') AS summaries
         FROM user_memories
         WHERE type = 'auto'
           AND created_at < datetime('now', '-3 hours')
           AND created_at >= datetime('now', '-7 days')
         GROUP BY date(created_at)
         ORDER BY day DESC LIMIT 7",
    )
    .fetch_all(db)
    .await
    .unwrap_or_default();

    let hist_lines: Vec<String> = hist_rows
        .iter()
        .map(|row| {
            let day: String = row.get("day");
            let summaries: String = row.get("summaries");
            let truncated = if summaries.len() > 200 {
                format!("{}…", safe_truncate(&summaries, 200))
            } else {
                summaries
            };
            format!("  {day}: {truncated}")
        })
        .collect();

    if manual_lines.is_empty()
        && observation_lines.is_empty()
        && checkpoint_lines.is_empty()
        && recent_lines.is_empty()
        && hist_lines.is_empty()
    {
        return String::new();
    }

    let mut parts = Vec::new();
    if !manual_lines.is_empty() {
        parts.push(format!("[用户备忘]\n{}", manual_lines.join("\n")));
    }
    if !observation_lines.is_empty() {
        let section_title = if query.is_some() {
            "[相关过程记忆]"
        } else {
            "[近期过程记忆]"
        };
        parts.push(format!("{section_title}\n{}", observation_lines.join("\n")));
    }
    if !checkpoint_lines.is_empty() {
        parts.push(format!(
            "[会话 Checkpoint]\n{}",
            checkpoint_lines.join("\n")
        ));
    }
    if !recent_lines.is_empty() {
        parts.push(format!(
            "[近期操作（最近3小时）]\n{}",
            recent_lines.join("\n")
        ));
    }
    if !hist_lines.is_empty() {
        parts.push(format!("[历史摘要（近7天）]\n{}", hist_lines.join("\n")));
    }

    let result = parts.join("\n\n");
    if result.len() > CONTEXT_BUDGET {
        format!("{}…", safe_truncate(&result, CONTEXT_BUDGET))
    } else {
        result
    }
}

async fn load_recent_checkpoint_lines(db: &SqlitePool) -> Vec<String> {
    let rows = sqlx::query(
        "SELECT goal, summary, next_steps, updated_at
         FROM memory_session_summaries
         WHERE updated_at >= datetime('now', '-14 days')
         ORDER BY updated_at DESC
         LIMIT 6",
    )
    .fetch_all(db)
    .await
    .unwrap_or_default();

    rows.iter()
        .map(|row| {
            checkpoint_to_memory_line(
                &row.get::<String, _>("updated_at"),
                &row.get::<String, _>("goal"),
                &row.get::<String, _>("summary"),
                &row.get::<String, _>("next_steps"),
            )
        })
        .collect()
}

pub async fn build_memory_context(db: &SqlitePool) -> String {
    build_memory_context_internal(db, None, None).await
}

pub async fn build_memory_context_for_query(
    db: &SqlitePool,
    query: &str,
    query_embedding: Option<&[f32]>,
) -> String {
    build_memory_context_internal(db, Some(query), query_embedding).await
}
