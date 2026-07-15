use crate::commands::arxiv::{build_recent_hint_request, run_arxiv_search};
use crate::commands::paper_search::fetch_semantic_scholar_candidates;
use crate::llm::{resolve_model, resolve_temperature_chain, LlmClient};
use sqlx::{Row, SqlitePool};
use std::collections::{HashMap, HashSet};
use uuid::Uuid;

mod briefing;
mod storage;

pub use storage::{
    append_briefing_history, count_unread, ensure_table, get_briefing_by_id, get_briefing_history,
    get_briefings, mark_briefing_read, upsert_briefing,
};

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ResearchFieldBriefing {
    pub id: String,
    pub interest_id: String,
    pub interest_topic: String,
    pub period_start: String,
    pub period_end: String,
    pub summary: String,
    pub trends: Vec<String>,
    pub key_papers: Vec<BriefingPaper>,
    pub upcoming_deadlines: Vec<BriefingDeadline>,
    pub generated_at: String,
    pub is_read: bool,
    pub stats: FieldDynamicsStats,
}

#[derive(Debug, Clone, Default, serde::Serialize, serde::Deserialize)]
pub struct FieldDynamicsStats {
    pub candidate_paper_count: usize,
    pub selected_paper_count: usize,
    pub upcoming_deadline_count: usize,
    pub trend_count: usize,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct BriefingPaper {
    pub external_id: String,
    pub source: String,
    pub title: String,
    pub authors: String,
    pub published_at: String,
    pub url: String,
    pub pdf_url: String,
    pub relevance_score: i32,
    pub relevance_reason: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct BriefingDeadline {
    pub external_id: String,
    pub name: String,
    pub deadline: String,
    pub url: String,
    pub days_remaining: i32,
}

#[derive(Debug, Clone, serde::Serialize)]
pub(super) struct RawPaperCandidate {
    source: String,
    external_id: String,
    title: String,
    authors: String,
    published_at: String,
    url: String,
    pdf_url: String,
    abstract_snippet: String,
}

#[derive(Debug, Clone, serde::Serialize)]
pub(super) struct RawDeadlineCandidate {
    external_id: String,
    name: String,
    deadline: String,
    url: String,
    days_remaining: i32,
}

pub async fn scan_interests(
    pool: &SqlitePool,
    settings: &HashMap<String, String>,
    days: i64,
    max_per_interest: usize,
) -> Result<Vec<ResearchFieldBriefing>, String> {
    let interests = sqlx::query("SELECT id, topic, keywords FROM research_interests")
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;

    if interests.is_empty() {
        return Ok(vec![]);
    }

    // A usable briefing is still preferable to no briefing when the model is
    // temporarily unavailable or has not been configured yet.
    let client = LlmClient::from_settings(settings).ok();
    let model = resolve_model(settings, &["copilot_simple_model"]);
    let temperature = resolve_temperature_chain(settings, &["copilot_simple_temperature"], 0.3);

    let now = chrono::Utc::now();
    let period_end = now.to_rfc3339();
    let period_start = (now - chrono::TimeDelta::days(days)).to_rfc3339();
    let generated_at = now.to_rfc3339();

    let mut briefings: Vec<ResearchFieldBriefing> = Vec::new();

    for row in &interests {
        let interest_id: String = row.get("id");
        let topic: String = row.get("topic");
        let keywords_str: Option<String> = row.get("keywords");
        let keywords: Vec<String> = keywords_str
            .as_deref()
            .and_then(|s| serde_json::from_str(s).ok())
            .unwrap_or_default();

        let papers = fetch_papers_for_interest(settings, &topic, &keywords, days, max_per_interest)
            .await
            .unwrap_or_default();
        let deadlines = fetch_deadlines_for_interest(pool, &topic, &keywords)
            .await
            .unwrap_or_default();

        if papers.is_empty() && deadlines.is_empty() {
            continue;
        }

        let generated = briefing::generate_briefing(
            client.as_ref(),
            model.as_deref(),
            temperature,
            &topic,
            &keywords,
            &papers,
            &deadlines,
        )
        .await;
        let selected_paper_count = generated.key_papers.len();
        let upcoming_deadline_count = generated.upcoming_deadlines.len();
        let trend_count = generated.trends.len();

        let briefing = ResearchFieldBriefing {
            id: Uuid::new_v4().to_string(),
            interest_id: interest_id.clone(),
            interest_topic: topic.clone(),
            period_start: period_start.clone(),
            period_end: period_end.clone(),
            summary: generated.summary,
            trends: generated.trends,
            key_papers: generated.key_papers,
            upcoming_deadlines: generated.upcoming_deadlines,
            generated_at: generated_at.clone(),
            is_read: false,
            stats: FieldDynamicsStats {
                candidate_paper_count: papers.len(),
                selected_paper_count,
                upcoming_deadline_count,
                trend_count,
            },
        };

        if let Err(e) = upsert_briefing(pool, &briefing).await {
            eprintln!("[field-dynamics] upsert briefing failed: {}", e);
            continue;
        }
        if let Err(e) = append_briefing_history(pool, &briefing).await {
            eprintln!("[field-dynamics] append history failed: {}", e);
        }

        briefings.push(briefing);
    }

    Ok(briefings)
}

async fn fetch_papers_for_interest(
    settings: &HashMap<String, String>,
    topic: &str,
    keywords: &[String],
    days: i64,
    max_per_interest: usize,
) -> Result<Vec<RawPaperCandidate>, String> {
    let mut all_papers: Vec<RawPaperCandidate> = Vec::new();

    // arXiv
    match fetch_arxiv_candidates(settings, topic, keywords, days, max_per_interest).await {
        Ok(items) => all_papers.extend(items),
        Err(e) => eprintln!("[field-dynamics] arxiv fetch failed for {}: {}", topic, e),
    }

    // Semantic Scholar
    match fetch_semantic_scholar_candidates_for_interest(
        settings,
        topic,
        keywords,
        days,
        max_per_interest,
    )
    .await
    {
        Ok(items) => all_papers.extend(items),
        Err(e) => eprintln!(
            "[field-dynamics] semantic scholar failed for {}: {}",
            topic, e
        ),
    }

    Ok(deduplicate_papers(
        all_papers,
        max_per_interest.saturating_mul(2),
    ))
}

fn deduplicate_papers(papers: Vec<RawPaperCandidate>, limit: usize) -> Vec<RawPaperCandidate> {
    let mut seen_external_ids = HashSet::new();
    let mut seen_titles = HashSet::new();

    papers
        .into_iter()
        .filter(|paper| {
            let external_key = format!("{}:{}", paper.source, paper.external_id.trim());
            let title_key = paper
                .title
                .chars()
                .filter(|character| character.is_alphanumeric())
                .flat_map(char::to_lowercase)
                .collect::<String>();
            !paper.external_id.trim().is_empty()
                && !paper.title.trim().is_empty()
                && seen_external_ids.insert(external_key)
                && !title_key.is_empty()
                && seen_titles.insert(title_key)
        })
        .take(limit.max(1))
        .collect()
}

async fn fetch_arxiv_candidates(
    settings: &HashMap<String, String>,
    topic: &str,
    keywords: &[String],
    days: i64,
    max_per_interest: usize,
) -> Result<Vec<RawPaperCandidate>, String> {
    let request = build_recent_hint_request(topic, keywords);
    let result = run_arxiv_search(
        settings,
        request,
        Some(days),
        Some(max_per_interest as i32),
        Some("relevance".to_string()),
    )
    .await?;

    let papers = result
        .get("papers")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    Ok(papers
        .into_iter()
        .map(|paper| RawPaperCandidate {
            source: "arxiv".to_string(),
            external_id: paper
                .get("arxiv_id")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            title: paper
                .get("title")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            authors: paper
                .get("authors")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            published_at: paper
                .get("published_at")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            url: paper
                .get("abs_url")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            pdf_url: paper
                .get("pdf_url")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            abstract_snippet: paper
                .get("abstract_text")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .chars()
                .take(400)
                .collect(),
        })
        .collect())
}

async fn fetch_semantic_scholar_candidates_for_interest(
    settings: &HashMap<String, String>,
    topic: &str,
    keywords: &[String],
    days: i64,
    max_per_interest: usize,
) -> Result<Vec<RawPaperCandidate>, String> {
    let mut query_terms = vec![topic.to_string()];
    query_terms.extend(keywords.iter().cloned());
    let query = query_terms.join(" ");

    let candidates =
        fetch_semantic_scholar_candidates(settings, &query, &[], days, max_per_interest.max(6))
            .await
            .map_err(|e| e.to_string())?;

    Ok(candidates
        .into_iter()
        .map(|candidate| RawPaperCandidate {
            source: "semantic_scholar".to_string(),
            external_id: candidate.id,
            title: candidate.title,
            authors: candidate.authors,
            published_at: candidate.published_at,
            url: candidate.detail_url.clone(),
            pdf_url: candidate.pdf_url,
            abstract_snippet: candidate.abstract_text.chars().take(400).collect(),
        })
        .collect())
}

async fn fetch_deadlines_for_interest(
    pool: &SqlitePool,
    topic: &str,
    keywords: &[String],
) -> Result<Vec<RawDeadlineCandidate>, String> {
    let mut match_terms: Vec<String> = vec![topic.to_string()];
    match_terms.extend(keywords.iter().cloned());
    let match_terms: Vec<String> = match_terms
        .into_iter()
        .map(|s| s.to_lowercase())
        .filter(|s| !s.is_empty())
        .collect();

    if match_terms.is_empty() {
        return Ok(vec![]);
    }

    let rows = sqlx::query(
        "SELECT id, name, full_name, website, area, deadline
         FROM venues
         WHERE deadline IS NOT NULL AND deadline != ''
           AND deadline >= date('now')
           AND deadline <= date('now', '+90 days')
         ORDER BY deadline ASC",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    let today = chrono::Utc::now().date_naive();
    let mut candidates = Vec::new();

    for row in &rows {
        let id: String = row.get("id");
        let name: String = row.get("name");
        let full_name: String = row.get("full_name");
        let website: String = row.get("website");
        let area: String = row.get("area");
        let deadline: String = row.get("deadline");

        let haystack = format!("{} {} {}", name, full_name, area).to_lowercase();
        let matched = match_terms.iter().any(|term| haystack.contains(term));
        if !matched {
            continue;
        }

        let display_name = if full_name.is_empty() {
            name.clone()
        } else {
            format!("{} ({})", full_name, name)
        };

        let days_remaining = if let Ok(d) = chrono::NaiveDate::parse_from_str(&deadline, "%Y-%m-%d")
        {
            d.signed_duration_since(today).num_days() as i32
        } else {
            0
        };

        candidates.push(RawDeadlineCandidate {
            external_id: id,
            name: display_name,
            deadline,
            url: website,
            days_remaining,
        });
    }

    Ok(candidates)
}
