use crate::commands::arxiv::{build_recent_hint_request, run_arxiv_search};
use crate::llm::{resolve_model, resolve_temperature_chain, LlmClient, LlmMessage};
use sqlx::{Row, SqlitePool};
use std::collections::HashMap;

const RESEARCHER_RANKING_PROMPT: &str = r#"你是一位研究助手，正在帮助研究者评估 arXiv 论文与其研究兴趣的相关性。

请为以下每篇论文输出：
1. **relevance_score**: 0-100 整数，表示与兴趣主题的相关度
2. **relevance_reason**: 简短的中文说明（1-2句），说明该论文与研究兴趣的具体关联点
3. **is_highly_relevant**: 布尔值，是否高度相关（relevance_score >= 70）

只输出 JSON 数组，不要其他内容。格式：[{"arxiv_id":"...", "relevance_score": 85, "relevance_reason": "...", "is_highly_relevant": true}]"#;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ActiveResearcherFinding {
    pub id: String,
    pub interest_id: String,
    pub interest_topic: String,
    pub arxiv_id: String,
    pub title: String,
    pub authors: String,
    pub published_at: String,
    pub abs_url: String,
    pub pdf_url: String,
    pub relevance_score: i32,
    pub relevance_reason: String,
    pub abstract_snippet: String,
    pub scanned_at: String,
    pub is_read: bool,
}

pub async fn ensure_table(pool: &SqlitePool) -> Result<(), String> {
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS active_researcher_findings (
            id TEXT PRIMARY KEY,
            interest_id TEXT NOT NULL,
            interest_topic TEXT NOT NULL,
            arxiv_id TEXT NOT NULL,
            title TEXT NOT NULL,
            authors TEXT NOT NULL DEFAULT '',
            published_at TEXT NOT NULL DEFAULT '',
            abs_url TEXT NOT NULL DEFAULT '',
            pdf_url TEXT NOT NULL DEFAULT '',
            relevance_score INTEGER NOT NULL DEFAULT 0,
            relevance_reason TEXT NOT NULL DEFAULT '',
            abstract_snippet TEXT NOT NULL DEFAULT '',
            scanned_at TEXT NOT NULL,
            is_read INTEGER NOT NULL DEFAULT 0
        )",
    )
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    // Index for efficient querying
    let _ = sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_findings_interest ON active_researcher_findings(interest_id, scanned_at DESC)"
    )
    .execute(pool)
    .await;

    let _ = sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_findings_scanned ON active_researcher_findings(scanned_at DESC)"
    )
    .execute(pool)
    .await;

    Ok(())
}

pub async fn scan_interests(
    pool: &SqlitePool,
    settings: &HashMap<String, String>,
    days: i64,
    max_per_interest: usize,
) -> Result<Vec<ActiveResearcherFinding>, String> {
    let interests = sqlx::query("SELECT id, topic, keywords FROM research_interests")
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;

    if interests.is_empty() {
        return Ok(vec![]);
    }

    let client = LlmClient::from_settings(settings).map_err(|e| e.to_string())?;
    let model = resolve_model(settings, &["copilot_simple_model"]);
    let temperature = resolve_temperature_chain(settings, &["copilot_simple_temperature"], 0.2);
    let now = chrono::Utc::now().to_rfc3339();
    let mut _all_findings: Vec<ActiveResearcherFinding> = Vec::new();

    for row in &interests {
        let interest_id: String = row.get("id");
        let topic: String = row.get("topic");
        let keywords_str: Option<String> = row.get("keywords");
        let keywords: Vec<String> = keywords_str
            .as_deref()
            .and_then(|s| serde_json::from_str(s).ok())
            .unwrap_or_default();

        // Search arXiv for this interest
        let request = build_recent_hint_request(&topic, &keywords);
        let search_result = match run_arxiv_search(
            settings,
            request,
            Some(days),
            Some(max_per_interest as i32),
            Some("relevance".to_string()),
        )
        .await
        {
            Ok(r) => r,
            Err(_) => continue,
        };

        let papers = match search_result.get("papers").and_then(|v| v.as_array()) {
            Some(p) => p,
            None => continue,
        };

        if papers.is_empty() {
            continue;
        }

        // Ask LLM to evaluate relevance
        let mut paper_list = String::new();
        let mut paper_map: HashMap<String, serde_json::Value> = HashMap::new();
        for paper in papers {
            let arxiv_id = paper
                .get("arxiv_id")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let title = paper
                .get("title")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let abstract_text = paper
                .get("abstract_text")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let snippet: String = abstract_text.chars().take(300).collect();

            paper_list.push_str(&format!(
                "arxiv_id: {}\n标题: {}\n摘要: {}\n\n",
                arxiv_id, title, snippet
            ));
            paper_map.insert(arxiv_id.clone(), paper.clone());
        }

        let messages = vec![
            LlmMessage::system(&format!(
                "{RESEARCHER_RANKING_PROMPT}\n\n当前研究兴趣：{topic}\n关键词：{}",
                keywords.join(", ")
            )),
            LlmMessage::user(format!(
                "请评估以下论文与「{topic}」的相关性：\n\n{paper_list}"
            )),
        ];

        let response = match client.chat(&messages, model.as_deref(), temperature).await {
            Ok(r) => r,
            Err(_) => continue,
        };

        // Parse LLM response
        let rankings: Vec<serde_json::Value> = {
            let trimmed = response.trim();
            // Handle possible markdown code block wrapping
            let json_str = if trimmed.starts_with("```") {
                trimmed
                    .trim_start_matches("```json")
                    .trim_start_matches("```")
                    .trim_end_matches("```")
                    .trim()
            } else {
                trimmed
            };
            serde_json::from_str(json_str).unwrap_or_default()
        };

        for ranking in &rankings {
            let arxiv_id = ranking
                .get("arxiv_id")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let score = ranking
                .get("relevance_score")
                .and_then(|v| v.as_i64())
                .unwrap_or(0) as i32;
            let is_highly = ranking
                .get("is_highly_relevant")
                .and_then(|v| v.as_bool())
                .unwrap_or(false);

            if !is_highly && score < 60 {
                continue; // Skip low-relevance papers
            }

            if let Some(paper) = paper_map.get(arxiv_id) {
                let finding_id = format!("{}_{}", interest_id, arxiv_id);

                // Upsert to avoid duplicates
                let _ = sqlx::query(
                    "INSERT OR REPLACE INTO active_researcher_findings
                     (id, interest_id, interest_topic, arxiv_id, title, authors, published_at, abs_url, pdf_url, relevance_score, relevance_reason, abstract_snippet, scanned_at, is_read)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)"
                )
                .bind(&finding_id)
                .bind(&interest_id)
                .bind(&topic)
                .bind(arxiv_id)
                .bind(paper.get("title").and_then(|v| v.as_str()).unwrap_or(""))
                .bind(paper.get("authors").and_then(|v| v.as_str()).unwrap_or(""))
                .bind(paper.get("published_at").and_then(|v| v.as_str()).unwrap_or(""))
                .bind(paper.get("abs_url").and_then(|v| v.as_str()).unwrap_or(""))
                .bind(paper.get("pdf_url").and_then(|v| v.as_str()).unwrap_or(""))
                .bind(score)
                .bind(ranking.get("relevance_reason").and_then(|v| v.as_str()).unwrap_or(""))
                .bind(paper.get("abstract_text").and_then(|v| v.as_str()).map(|s| s.chars().take(300).collect::<String>()).unwrap_or_default())
                .bind(&now)
                .execute(pool)
                .await
                .map_err(|e| e.to_string())?;
            }
        }
    }

    // Return fresh findings
    get_recent_findings(pool, 50).await
}

pub async fn get_recent_findings(
    pool: &SqlitePool,
    limit: i64,
) -> Result<Vec<ActiveResearcherFinding>, String> {
    let rows = sqlx::query(
        "SELECT id, interest_id, interest_topic, arxiv_id, title, authors, published_at, abs_url, pdf_url, relevance_score, relevance_reason, abstract_snippet, scanned_at, is_read
         FROM active_researcher_findings
         ORDER BY scanned_at DESC, relevance_score DESC
         LIMIT ?"
    )
    .bind(limit)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows
        .iter()
        .map(|r| ActiveResearcherFinding {
            id: r.get("id"),
            interest_id: r.get("interest_id"),
            interest_topic: r.get("interest_topic"),
            arxiv_id: r.get("arxiv_id"),
            title: r.get("title"),
            authors: r.get("authors"),
            published_at: r.get("published_at"),
            abs_url: r.get("abs_url"),
            pdf_url: r.get("pdf_url"),
            relevance_score: r.get("relevance_score"),
            relevance_reason: r.get("relevance_reason"),
            abstract_snippet: r.get("abstract_snippet"),
            scanned_at: r.get("scanned_at"),
            is_read: r.get::<i32, _>("is_read") != 0,
        })
        .collect())
}

pub async fn mark_finding_read(pool: &SqlitePool, id: &str) -> Result<(), String> {
    sqlx::query("UPDATE active_researcher_findings SET is_read = 1 WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub async fn mark_all_read(pool: &SqlitePool) -> Result<(), String> {
    sqlx::query("UPDATE active_researcher_findings SET is_read = 1 WHERE is_read = 0")
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub async fn count_unread(pool: &SqlitePool) -> Result<i64, String> {
    let row =
        sqlx::query("SELECT COUNT(*) as cnt FROM active_researcher_findings WHERE is_read = 0")
            .fetch_one(pool)
            .await
            .map_err(|e| e.to_string())?;
    Ok(row.get::<i64, _>("cnt"))
}
