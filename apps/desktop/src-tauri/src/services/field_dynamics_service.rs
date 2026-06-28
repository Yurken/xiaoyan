use crate::commands::arxiv::{build_recent_hint_request, run_arxiv_search};
use crate::commands::paper_search::fetch_semantic_scholar_candidates;
use crate::llm::{resolve_model, resolve_temperature_chain, LlmClient, LlmMessage};
use sqlx::{Row, SqlitePool};
use std::collections::HashMap;
use uuid::Uuid;

const BRIEFING_GENERATION_PROMPT: &str = r#"你是一位研究情报分析助手。请基于下面某个研究兴趣在近期（最近 7 天）收集到的论文和会议截稿信息，生成一份结构化的「领域动态简报」。

输出必须是合法 JSON，格式如下：
{
  "summary": "用 2-4 句话概括本周该领域最值得关注的动态，中文。",
  "trends": ["趋势/热点 1", "趋势/热点 2", ...],
  "key_papers": [
    {
      "external_id": "论文唯一标识",
      "source": "arxiv 或 semantic_scholar",
      "title": "论文标题",
      "authors": "作者",
      "published_at": "发表日期",
      "url": "详情页链接",
      "pdf_url": "PDF 链接（可为空）",
      "relevance_score": 85,
      "relevance_reason": "为什么值得关注的 1 句话中文说明"
    }
  ],
  "upcoming_deadlines": [
    {
      "external_id": "会议唯一标识",
      "name": "会议名",
      "deadline": "截稿日期",
      "url": "投稿页链接（可为空）",
      "days_remaining": 30
    }
  ]
}

要求：
- summary 要凝练、有洞察力，避免简单罗列标题。
- trends 控制在 3-6 条，每条是短语或短句。
- key_papers 只选最相关的 3-6 篇。
- upcoming_deadlines 只选与该兴趣明显相关且尚未截稿的会议，最多 4 个。
- 不要输出 Markdown 代码块，只输出纯 JSON。"#;

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
struct RawPaperCandidate {
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
struct RawDeadlineCandidate {
    external_id: String,
    name: String,
    deadline: String,
    url: String,
    days_remaining: i32,
}

pub async fn ensure_table(pool: &SqlitePool) -> Result<(), String> {
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS research_field_briefings (
            id              TEXT PRIMARY KEY,
            interest_id     TEXT NOT NULL UNIQUE,
            interest_topic  TEXT NOT NULL,
            period_start    TEXT NOT NULL,
            period_end      TEXT NOT NULL,
            summary         TEXT NOT NULL DEFAULT '',
            trends          TEXT NOT NULL DEFAULT '[]',
            key_papers      TEXT NOT NULL DEFAULT '[]',
            upcoming_deadlines TEXT NOT NULL DEFAULT '[]',
            generated_at    TEXT NOT NULL,
            is_read         INTEGER NOT NULL DEFAULT 0
        )",
    )
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    let _ = sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_field_briefings_interest ON research_field_briefings(interest_id)",
    )
    .execute(pool)
    .await;

    let _ = sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_field_briefings_generated ON research_field_briefings(generated_at DESC)",
    )
    .execute(pool)
    .await;

    let _ = sqlx::query("DROP TABLE IF EXISTS research_field_updates")
        .execute(pool)
        .await;

    Ok(())
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

    let client = LlmClient::from_settings(settings).map_err(|e| e.to_string())?;
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

        let generated = match generate_briefing(
            &client,
            model.as_deref(),
            temperature,
            &topic,
            &keywords,
            &papers,
            &deadlines,
        )
        .await
        {
            Some(b) => b,
            None => continue,
        };

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
        };

        if let Err(e) = upsert_briefing(pool, &briefing).await {
            eprintln!("[field-dynamics] upsert briefing failed: {}", e);
            continue;
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
        Err(e) => eprintln!("[field-dynamics] semantic scholar failed for {}: {}", topic, e),
    }

    Ok(all_papers)
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

    let candidates = fetch_semantic_scholar_candidates(
        settings,
        &query,
        &[],
        days,
        max_per_interest.max(6),
    )
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

        let days_remaining = if let Ok(d) = chrono::NaiveDate::parse_from_str(&deadline, "%Y-%m-%d") {
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

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
struct GeneratedBriefing {
    summary: String,
    trends: Vec<String>,
    key_papers: Vec<BriefingPaper>,
    upcoming_deadlines: Vec<BriefingDeadline>,
}

async fn generate_briefing(
    client: &LlmClient,
    model: Option<&str>,
    temperature: f32,
    topic: &str,
    keywords: &[String],
    papers: &[RawPaperCandidate],
    deadlines: &[RawDeadlineCandidate],
) -> Option<GeneratedBriefing> {
    if papers.is_empty() && deadlines.is_empty() {
        return None;
    }

    let papers_json = serde_json::to_string(papers).unwrap_or_else(|_| "[]".to_string());
    let deadlines_json = serde_json::to_string(deadlines).unwrap_or_else(|_| "[]".to_string());

    let messages = vec![
        LlmMessage::system(BRIEFING_GENERATION_PROMPT),
        LlmMessage::user(format!(
            "研究兴趣：{}\n关键词：{}\n\n候选论文：{}\n\n候选会议截稿：{}",
            topic,
            keywords.join(", "),
            papers_json,
            deadlines_json
        )),
    ];

    let response = client.chat(&messages, model, temperature).await.ok()?;
    let trimmed = response.trim();
    let json_str = if trimmed.starts_with("```") {
        trimmed
            .trim_start_matches("```json")
            .trim_start_matches("```")
            .trim_end_matches("```")
            .trim()
    } else {
        trimmed
    };

    serde_json::from_str(json_str).ok()
}

async fn upsert_briefing(pool: &SqlitePool, briefing: &ResearchFieldBriefing) -> Result<(), String> {
    sqlx::query(
        "INSERT INTO research_field_briefings (
            id, interest_id, interest_topic, period_start, period_end,
            summary, trends, key_papers, upcoming_deadlines, generated_at, is_read
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(interest_id) DO UPDATE SET
            interest_topic = excluded.interest_topic,
            period_start = excluded.period_start,
            period_end = excluded.period_end,
            summary = excluded.summary,
            trends = excluded.trends,
            key_papers = excluded.key_papers,
            upcoming_deadlines = excluded.upcoming_deadlines,
            generated_at = excluded.generated_at,
            is_read = excluded.is_read",
    )
    .bind(&briefing.id)
    .bind(&briefing.interest_id)
    .bind(&briefing.interest_topic)
    .bind(&briefing.period_start)
    .bind(&briefing.period_end)
    .bind(&briefing.summary)
    .bind(&serde_json::to_string(&briefing.trends).unwrap_or_else(|_| "[]".to_string()))
    .bind(&serde_json::to_string(&briefing.key_papers).unwrap_or_else(|_| "[]".to_string()))
    .bind(&serde_json::to_string(&briefing.upcoming_deadlines).unwrap_or_else(|_| "[]".to_string()))
    .bind(&briefing.generated_at)
    .bind(if briefing.is_read { 1 } else { 0 })
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

pub async fn get_briefings(
    pool: &SqlitePool,
    interest_id: Option<String>,
) -> Result<Vec<ResearchFieldBriefing>, String> {
    let sql = if interest_id.is_some() {
        "SELECT id, interest_id, interest_topic, period_start, period_end, summary, trends,
                key_papers, upcoming_deadlines, generated_at, is_read
         FROM research_field_briefings
         WHERE interest_id = ?
         ORDER BY generated_at DESC"
    } else {
        "SELECT id, interest_id, interest_topic, period_start, period_end, summary, trends,
                key_papers, upcoming_deadlines, generated_at, is_read
         FROM research_field_briefings
         ORDER BY generated_at DESC"
    };

    let rows = if let Some(id) = interest_id {
        sqlx::query_as::<_, ResearchFieldBriefingRow>(sql)
            .bind(id)
            .fetch_all(pool)
            .await
    } else {
        sqlx::query_as::<_, ResearchFieldBriefingRow>(sql)
            .fetch_all(pool)
            .await
    }
    .map_err(|e| e.to_string())?;

    Ok(rows.into_iter().map(into_briefing).collect())
}

#[derive(sqlx::FromRow)]
struct ResearchFieldBriefingRow {
    id: String,
    interest_id: String,
    interest_topic: String,
    period_start: String,
    period_end: String,
    summary: String,
    trends: String,
    key_papers: String,
    upcoming_deadlines: String,
    generated_at: String,
    is_read: i32,
}

fn into_briefing(row: ResearchFieldBriefingRow) -> ResearchFieldBriefing {
    ResearchFieldBriefing {
        id: row.id,
        interest_id: row.interest_id,
        interest_topic: row.interest_topic,
        period_start: row.period_start,
        period_end: row.period_end,
        summary: row.summary,
        trends: serde_json::from_str(&row.trends).unwrap_or_default(),
        key_papers: serde_json::from_str(&row.key_papers).unwrap_or_default(),
        upcoming_deadlines: serde_json::from_str(&row.upcoming_deadlines).unwrap_or_default(),
        generated_at: row.generated_at,
        is_read: row.is_read != 0,
    }
}

pub async fn mark_briefing_read(pool: &SqlitePool, id: Option<String>) -> Result<(), String> {
    if let Some(briefing_id) = id {
        sqlx::query("UPDATE research_field_briefings SET is_read = 1 WHERE id = ?")
            .bind(&briefing_id)
            .execute(pool)
            .await
            .map_err(|e| e.to_string())?;
    } else {
        sqlx::query("UPDATE research_field_briefings SET is_read = 1")
            .execute(pool)
            .await
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub async fn count_unread(pool: &SqlitePool) -> Result<i64, String> {
    let row: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM research_field_briefings WHERE is_read = 0")
        .fetch_one(pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(row.0)
}

pub async fn get_briefing_by_id(
    pool: &SqlitePool,
    id: &str,
) -> Result<Option<ResearchFieldBriefing>, String> {
    let row = sqlx::query_as::<_, ResearchFieldBriefingRow>(
        "SELECT id, interest_id, interest_topic, period_start, period_end, summary, trends,
                key_papers, upcoming_deadlines, generated_at, is_read
         FROM research_field_briefings WHERE id = ?",
    )
    .bind(id)
    .fetch_optional(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(row.map(into_briefing))
}
