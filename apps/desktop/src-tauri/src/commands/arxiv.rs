use crate::llm::{resolve_model, resolve_temperature, LlmClient, LlmMessage};
use crate::state::AppState;
use anyhow::{anyhow, Context};
use chrono::{DateTime, Duration, Utc};
use roxmltree::Document;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::{HashMap, HashSet};
use tauri::State;

const ARXIV_API_URL: &str = "https://export.arxiv.org/api/query";
const ARXIV_USER_AGENT: &str = "research-copilot-desktop/0.2.5";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
struct ArxivPaper {
    arxiv_id: String,
    title: String,
    authors: String,
    category: String,
    published_at: String,
    updated_at: String,
    abstract_text: String,
    abs_url: String,
    pdf_url: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
struct ArxivRecommendation {
    arxiv_id: String,
    title: String,
    title_zh: Option<String>,
    authors: String,
    category: String,
    published_at: String,
    updated_at: String,
    abstract_text: String,
    abs_url: String,
    pdf_url: String,
    score: i32,
    reason: String,
    tldr_zh: Option<String>,
    tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
struct ArxivSearchResponse {
    query: String,
    keywords: Vec<String>,
    days: i64,
    limit: usize,
    ranking_mode: String,
    candidate_count: usize,
    llm_used: bool,
    ranking_note: String,
    overall_summary: String,
    disclaimer: String,
    papers: Vec<ArxivRecommendation>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
struct LlmRankingResponse {
    overall_summary: Option<String>,
    ranking_note: Option<String>,
    papers: Vec<LlmRankingPaper>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
struct LlmRankingPaper {
    arxiv_id: String,
    score: Option<i32>,
    reason: Option<String>,
    title_zh: Option<String>,
    tldr_zh: Option<String>,
    tags: Option<Vec<String>>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum RankingMode {
    Relevance,
    Quality,
}

impl RankingMode {
    fn from_value(value: Option<&str>) -> Self {
        match value.unwrap_or("relevance").trim() {
            "quality" => Self::Quality,
            _ => Self::Relevance,
        }
    }

    fn as_str(self) -> &'static str {
        match self {
            Self::Relevance => "relevance",
            Self::Quality => "quality",
        }
    }

}

#[tauri::command]
pub async fn arxiv_search(
    state: State<'_, AppState>,
    query: String,
    days: Option<i64>,
    limit: Option<i32>,
    ranking_mode: Option<String>,
) -> Result<serde_json::Value, String> {
    let query = query.trim().to_string();
    if query.is_empty() {
        return Err("请输入关键词".into());
    }

    let keywords = parse_keywords(&query);
    if keywords.is_empty() {
        return Err("请输入至少一个有效关键词".into());
    }

    let day_window = days.unwrap_or(14).clamp(1, 365);
    let result_limit = limit.unwrap_or(5).clamp(1, 20) as usize;
    let mode = RankingMode::from_value(ranking_mode.as_deref());
    let settings = state.settings.read().await.clone();

    let candidates = fetch_arxiv_candidates(&keywords, day_window, candidate_pool_size(result_limit))
        .await
        .map_err(|error| error.to_string())?;

    if candidates.is_empty() {
        let empty = ArxivSearchResponse {
            query,
            keywords,
            days: day_window,
            limit: result_limit,
            ranking_mode: mode.as_str().to_string(),
            candidate_count: 0,
            llm_used: false,
            ranking_note: "当前时间窗口内没有找到匹配论文。".into(),
            overall_summary: "可以扩大最近天数，或改用更具体的关键词重试。".into(),
            disclaimer: disclaimer_for_mode(mode).into(),
            papers: Vec::new(),
        };
        return Ok(json!(empty));
    }

    let heuristic = heuristic_rank_papers(&candidates, &keywords, mode, result_limit);
    let (llm_used, ranking_note, overall_summary, papers) =
        match rerank_with_llm(&settings, &query, &keywords, mode, result_limit, &candidates).await {
            Ok(Some((note, summary, ranked))) => (true, note, summary, ranked),
            Ok(None) | Err(_) => (
                false,
                fallback_ranking_note(mode).to_string(),
                fallback_overall_summary(mode, candidates.len(), result_limit),
                heuristic,
            ),
        };

    let response = ArxivSearchResponse {
        query,
        keywords,
        days: day_window,
        limit: result_limit,
        ranking_mode: mode.as_str().to_string(),
        candidate_count: candidates.len(),
        llm_used,
        ranking_note,
        overall_summary,
        disclaimer: disclaimer_for_mode(mode).into(),
        papers,
    };

    Ok(json!(response))
}

async fn fetch_arxiv_candidates(
    keywords: &[String],
    days: i64,
    max_results: usize,
) -> anyhow::Result<Vec<ArxivPaper>> {
    let search_query = build_search_query(keywords);
    let client = reqwest::Client::new();
    let params = [
        ("search_query", search_query),
        ("start", "0".to_string()),
        ("max_results", max_results.to_string()),
        ("sortBy", "submittedDate".to_string()),
        ("sortOrder", "descending".to_string()),
    ];

    let response = client
        .get(ARXIV_API_URL)
        .header("User-Agent", ARXIV_USER_AGENT)
        .query(&params)
        .send()
        .await
        .context("请求 arXiv 失败")?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(anyhow!("arXiv 返回错误 {status}: {body}"));
    }

    let xml = response.text().await.context("读取 arXiv 响应失败")?;
    let papers = parse_arxiv_feed(&xml)?;
    Ok(filter_recent_papers(papers, days))
}

fn parse_arxiv_feed(xml: &str) -> anyhow::Result<Vec<ArxivPaper>> {
    let document = Document::parse(xml).context("解析 arXiv Atom XML 失败")?;
    let mut seen_ids = HashSet::new();
    let mut papers = Vec::new();

    for entry in document
        .descendants()
        .filter(|node| node.is_element() && node.tag_name().name() == "entry")
    {
        let raw_id = child_text(entry, "id");
        if raw_id.is_empty() {
            continue;
        }

        let arxiv_id = normalize_arxiv_id(&raw_id);
        if arxiv_id.is_empty() || !seen_ids.insert(arxiv_id.clone()) {
            continue;
        }

        let title = clean_whitespace(&child_text(entry, "title"));
        let abstract_text = clean_whitespace(&child_text(entry, "summary"));
        let published_at = child_text(entry, "published");
        let updated_at = child_text(entry, "updated");
        let authors = entry
            .children()
            .filter(|node| node.is_element() && node.tag_name().name() == "author")
            .map(|author| child_text(author, "name"))
            .filter(|name| !name.is_empty())
            .collect::<Vec<_>>()
            .join(", ");
        let category = entry
            .children()
            .find(|node| node.is_element() && node.tag_name().name() == "primary_category")
            .and_then(|node| node.attribute("term"))
            .unwrap_or("")
            .to_string();

        let mut abs_url = raw_id.clone();
        let mut pdf_url = String::new();
        for link in entry
            .children()
            .filter(|node| node.is_element() && node.tag_name().name() == "link")
        {
            let href = link.attribute("href").unwrap_or("").trim();
            let rel = link.attribute("rel").unwrap_or("").trim();
            let link_type = link.attribute("type").unwrap_or("").trim();
            let title_attr = link.attribute("title").unwrap_or("").trim();

            if title_attr == "pdf" || link_type == "application/pdf" {
                pdf_url = href.to_string();
            } else if rel == "alternate" {
                abs_url = href.to_string();
            }
        }

        if abs_url.is_empty() {
            abs_url = format!("https://arxiv.org/abs/{arxiv_id}");
        }
        if pdf_url.is_empty() {
            pdf_url = format!("https://arxiv.org/pdf/{arxiv_id}.pdf");
        }

        papers.push(ArxivPaper {
            arxiv_id,
            title,
            authors,
            category,
            published_at,
            updated_at,
            abstract_text,
            abs_url,
            pdf_url,
        });
    }

    Ok(papers)
}

fn filter_recent_papers(papers: Vec<ArxivPaper>, days: i64) -> Vec<ArxivPaper> {
    let cutoff = Utc::now() - Duration::days(days.max(1));

    papers
        .into_iter()
        .filter(|paper| {
            parse_arxiv_datetime(&paper.published_at)
                .map(|published| published >= cutoff)
                .unwrap_or(true)
        })
        .collect()
}

async fn rerank_with_llm(
    settings: &HashMap<String, String>,
    query: &str,
    keywords: &[String],
    mode: RankingMode,
    limit: usize,
    candidates: &[ArxivPaper],
) -> anyhow::Result<Option<(String, String, Vec<ArxivRecommendation>)>> {
    let client = match LlmClient::from_settings(settings) {
        Ok(client) => client,
        Err(_) => return Ok(None),
    };

    let model = resolve_model(settings, &["survey_planner_model", "copilot_simple_model"]);
    let temperature = resolve_temperature(settings, "survey_planner_temperature", 0.2);
    let candidate_json = candidates
        .iter()
        .map(|paper| {
            json!({
                "arxiv_id": paper.arxiv_id,
                "title": paper.title,
                "authors": paper.authors,
                "category": paper.category,
                "published_at": paper.published_at,
                "abstract_text": truncate_chars(&paper.abstract_text, 900),
            })
        })
        .collect::<Vec<_>>();

    let prompt = format!(
        "请从给定的 arXiv 候选论文中，筛选出最适合用户需求的前 {limit} 篇论文。\n\
用户查询：{query}\n\
关键词：{keywords}\n\
筛选目标：{goal}\n\n\
限制条件：\n\
1. 只能基于标题、作者、类别、发布时间和摘要判断，不能编造不存在的信息。\n\
2. 只返回候选列表里已有的 arxiv_id。\n\
3. score 为 0-100 的整数。\n\
4. title_zh、tldr_zh、reason 必须使用简体中文。\n\
5. quality 模式下，这只是基于摘要的质量预测，不得写成“已被顶会接收”或“已有高引用”，除非候选材料明确说明。\n\
6. 若多篇论文相近，优先选择更贴合查询、信息密度更高、发布时间更新的论文。\n\n\
请只返回 JSON，结构必须为：\n\
{{\n\
  \"overall_summary\": \"一句到两句的中文总结\",\n\
  \"ranking_note\": \"说明当前排序依据\",\n\
  \"papers\": [\n\
    {{\n\
      \"arxiv_id\": \"候选中的 arxiv_id\",\n\
      \"score\": 88,\n\
      \"reason\": \"为什么入选\",\n\
      \"title_zh\": \"中文标题，可意译\",\n\
      \"tldr_zh\": \"一句话摘要\",\n\
      \"tags\": [\"标签1\", \"标签2\"]\n\
    }}\n\
  ]\n\
}}\n\n\
候选论文：\n{candidate_json}",
        keywords = keywords.join("、"),
        goal = mode_prompt(mode),
        candidate_json = serde_json::to_string_pretty(&candidate_json)?,
    );

    let messages = vec![
        LlmMessage::system(
            "你是科研论文筛选助手。你要从候选 arXiv 论文中做严格筛选和排序，结果必须精炼、可信、可溯源。",
        ),
        LlmMessage::user(prompt),
    ];

    let response = client.chat(&messages, model.as_deref(), temperature).await?;
    let parsed: LlmRankingResponse = serde_json::from_str(&extract_json(&response))
        .context("解析论文筛选 JSON 失败")?;

    let mut candidate_map = candidates
        .iter()
        .cloned()
        .map(|paper| (paper.arxiv_id.clone(), paper))
        .collect::<HashMap<_, _>>();
    let mut used = HashSet::new();
    let mut ranked = Vec::new();

    for paper in parsed.papers {
        if ranked.len() >= limit {
            break;
        }
        if !used.insert(paper.arxiv_id.clone()) {
            continue;
        }
        let Some(candidate) = candidate_map.remove(&paper.arxiv_id) else {
            continue;
        };
        ranked.push(ArxivRecommendation {
            arxiv_id: candidate.arxiv_id,
            title: candidate.title,
            title_zh: paper.title_zh.filter(|value| !value.trim().is_empty()),
            authors: candidate.authors,
            category: candidate.category,
            published_at: candidate.published_at,
            updated_at: candidate.updated_at,
            abstract_text: candidate.abstract_text,
            abs_url: candidate.abs_url,
            pdf_url: candidate.pdf_url,
            score: paper.score.unwrap_or(80).clamp(0, 100),
            reason: paper.reason.unwrap_or_else(|| "模型未返回入选理由".into()),
            tldr_zh: paper.tldr_zh.filter(|value| !value.trim().is_empty()),
            tags: paper.tags.unwrap_or_default(),
        });
    }

    if ranked.is_empty() {
        return Ok(None);
    }

    let fallback = heuristic_rank_papers(candidates, keywords, mode, limit);
    for paper in fallback {
        if ranked.len() >= limit {
            break;
        }
        if used.insert(paper.arxiv_id.clone()) {
            ranked.push(paper);
        }
    }

    Ok(Some((
        parsed
            .ranking_note
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| fallback_ranking_note(mode).to_string()),
        parsed
            .overall_summary
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| fallback_overall_summary(mode, candidates.len(), limit)),
        ranked,
    )))
}

fn heuristic_rank_papers(
    candidates: &[ArxivPaper],
    keywords: &[String],
    mode: RankingMode,
    limit: usize,
) -> Vec<ArxivRecommendation> {
    let mut ranked = candidates
        .iter()
        .map(|paper| {
            let score = heuristic_score(paper, keywords, mode);
            let reason = heuristic_reason(paper, keywords, mode);
            let title_zh = None;
            let tldr_zh = Some(match mode {
                RankingMode::Relevance => "按关键词命中度和时间新近度排序。".to_string(),
                RankingMode::Quality => "按摘要信息密度和实验信号做启发式质量预测。".to_string(),
            });
            let tags = heuristic_tags(paper, keywords, mode);

            ArxivRecommendation {
                arxiv_id: paper.arxiv_id.clone(),
                title: paper.title.clone(),
                title_zh,
                authors: paper.authors.clone(),
                category: paper.category.clone(),
                published_at: paper.published_at.clone(),
                updated_at: paper.updated_at.clone(),
                abstract_text: paper.abstract_text.clone(),
                abs_url: paper.abs_url.clone(),
                pdf_url: paper.pdf_url.clone(),
                score,
                reason,
                tldr_zh,
                tags,
            }
        })
        .collect::<Vec<_>>();

    ranked.sort_by(|left, right| right.score.cmp(&left.score));
    ranked.truncate(limit);
    ranked
}

fn heuristic_score(paper: &ArxivPaper, keywords: &[String], mode: RankingMode) -> i32 {
    let title = paper.title.to_lowercase();
    let abstract_text = paper.abstract_text.to_lowercase();
    let title_hits = keywords
        .iter()
        .filter(|keyword| title.contains(&keyword.to_lowercase()))
        .count() as i32;
    let abstract_hits = keywords
        .iter()
        .filter(|keyword| abstract_text.contains(&keyword.to_lowercase()))
        .count() as i32;
    let recency_score = recency_score(&paper.published_at);

    let mut score = 40 + title_hits * 15 + abstract_hits * 8 + recency_score;
    if mode == RankingMode::Quality {
        score += signal_score(
            &abstract_text,
            &[
                "state-of-the-art",
                "sota",
                "benchmark",
                "evaluation",
                "experiments",
                "outperform",
                "ablation",
                "analysis",
                "theoretical",
            ],
            18,
        );
        score += signal_score(
            &abstract_text,
            &["framework", "method", "approach", "algorithm", "dataset"],
            10,
        );
    }

    score.clamp(1, 100)
}

fn heuristic_reason(paper: &ArxivPaper, keywords: &[String], mode: RankingMode) -> String {
    let title = paper.title.to_lowercase();
    let abstract_text = paper.abstract_text.to_lowercase();
    let matched = keywords
        .iter()
        .filter(|keyword| {
            let lowered = keyword.to_lowercase();
            title.contains(&lowered) || abstract_text.contains(&lowered)
        })
        .cloned()
        .collect::<Vec<_>>();

    let mut signals = Vec::new();
    if !matched.is_empty() {
        signals.push(format!("关键词匹配到 {}", matched.join("、")));
    }
    if recency_score(&paper.published_at) >= 12 {
        signals.push("发布时间较新".into());
    }
    if mode == RankingMode::Quality {
        let quality_signals = collect_quality_signals(&abstract_text);
        if !quality_signals.is_empty() {
            signals.push(format!("摘要中出现 {}", quality_signals.join("、")));
        }
    }
    if signals.is_empty() {
        signals.push("与查询主题存在一定相关性".into());
    }

    let suffix = if mode == RankingMode::Quality {
        "这属于基于标题和摘要的质量预测，不等同于真实引用或录用情况。"
    } else {
        "适合作为当前关键词的优先阅读入口。"
    };
    format!("{}。{}", signals.join("，"), suffix)
}

fn heuristic_tags(paper: &ArxivPaper, keywords: &[String], mode: RankingMode) -> Vec<String> {
    let mut tags = Vec::new();
    let abstract_text = paper.abstract_text.to_lowercase();

    if mode == RankingMode::Relevance {
        for keyword in keywords.iter().take(3) {
            if abstract_text.contains(&keyword.to_lowercase()) || paper.title.to_lowercase().contains(&keyword.to_lowercase()) {
                tags.push(keyword.clone());
            }
        }
    } else {
        tags.extend(collect_quality_signals(&abstract_text));
    }

    if tags.is_empty() && !paper.category.is_empty() {
        tags.push(paper.category.clone());
    }

    tags.truncate(4);
    tags
}

fn collect_quality_signals(abstract_text: &str) -> Vec<String> {
    let candidates = [
        ("benchmark", "benchmark"),
        ("experiments", "实验"),
        ("evaluation", "评测"),
        ("ablation", "消融"),
        ("state-of-the-art", "SOTA"),
        ("outperform", "性能提升"),
        ("theoretical", "理论分析"),
        ("dataset", "数据集"),
    ];

    candidates
        .iter()
        .filter_map(|(needle, label)| abstract_text.contains(needle).then(|| (*label).to_string()))
        .collect()
}

fn recency_score(published_at: &str) -> i32 {
    let Some(published) = parse_arxiv_datetime(published_at) else {
        return 8;
    };
    let age_days = (Utc::now() - published).num_days();
    if age_days <= 3 {
        20
    } else if age_days <= 7 {
        16
    } else if age_days <= 14 {
        12
    } else if age_days <= 30 {
        8
    } else {
        4
    }
}

fn signal_score(text: &str, needles: &[&str], cap: i32) -> i32 {
    let raw = needles.iter().filter(|needle| text.contains(**needle)).count() as i32 * 4;
    raw.min(cap)
}

fn parse_keywords(query: &str) -> Vec<String> {
    let splitters = [',', '，', ';', '；', '\n'];
    let mut keywords = query
        .split(|ch| splitters.contains(&ch))
        .map(str::trim)
        .filter(|part| !part.is_empty())
        .map(ToString::to_string)
        .collect::<Vec<_>>();

    if keywords.is_empty() && !query.trim().is_empty() {
        keywords.push(query.trim().to_string());
    }

    keywords.dedup();
    keywords
}

fn build_search_query(keywords: &[String]) -> String {
    keywords
        .iter()
        .map(|keyword| format!("all:\"{}\"", keyword.replace('"', " ").trim()))
        .collect::<Vec<_>>()
        .join(" OR ")
}

fn candidate_pool_size(limit: usize) -> usize {
    limit.saturating_mul(4).clamp(16, 36)
}

fn parse_arxiv_datetime(value: &str) -> Option<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(value)
        .ok()
        .map(|parsed| parsed.with_timezone(&Utc))
}

fn child_text(node: roxmltree::Node<'_, '_>, child_name: &str) -> String {
    node.children()
        .find(|child| child.is_element() && child.tag_name().name() == child_name)
        .and_then(|child| child.text())
        .map(clean_whitespace)
        .unwrap_or_default()
}

fn clean_whitespace(value: &str) -> String {
    value.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn normalize_arxiv_id(raw_id: &str) -> String {
    let value = raw_id.trim();
    let value = value
        .rsplit("/abs/")
        .next()
        .unwrap_or(value)
        .trim_end_matches('/');
    if let Some(index) = value.rfind('v') {
        let suffix = &value[index + 1..];
        if !suffix.is_empty() && suffix.chars().all(|ch| ch.is_ascii_digit()) {
            return value[..index].to_string();
        }
    }
    value.to_string()
}

fn mode_prompt(mode: RankingMode) -> &'static str {
    match mode {
        RankingMode::Relevance => "优先挑出和用户关键词最贴合、最值得现在阅读的论文。",
        RankingMode::Quality => {
            "优先挑出从标题和摘要看研究完成度、方法信息密度和潜在影响更高的论文。"
        }
    }
}

fn fallback_ranking_note(mode: RankingMode) -> &'static str {
    match mode {
        RankingMode::Relevance => "当前按关键词匹配度与发布时间进行启发式排序。",
        RankingMode::Quality => "当前按摘要信息密度、实验信号与发布时间进行启发式质量预测排序。",
    }
}

fn fallback_overall_summary(mode: RankingMode, candidate_count: usize, limit: usize) -> String {
    match mode {
        RankingMode::Relevance => format!(
            "已从最近抓到的 {candidate_count} 篇候选论文中，按相关性筛出前 {limit} 篇，适合先作为阅读入口。"
        ),
        RankingMode::Quality => format!(
            "已从最近抓到的 {candidate_count} 篇候选论文中，按质量预测筛出前 {limit} 篇。该结果只基于标题和摘要，不代表真实影响力。"
        ),
    }
}

fn disclaimer_for_mode(mode: RankingMode) -> &'static str {
    match mode {
        RankingMode::Relevance => "arXiv 结果来自实时检索；推荐优先级由当前项目模型设置或本地启发式规则生成。",
        RankingMode::Quality => {
            "“质量最高”是基于标题和摘要做的质量预测，不等同于真实引用、录用结果或社区长期共识。"
        }
    }
}

fn extract_json(input: &str) -> String {
    let trimmed = input.trim();
    let body = if trimmed.starts_with("```") {
        let lines = trimmed.lines().collect::<Vec<_>>();
        lines[1..lines.len().saturating_sub(1)].join("\n")
    } else {
        trimmed.to_string()
    };
    let start = body.find('{').unwrap_or(0);
    let end = body.rfind('}').map(|index| index + 1).unwrap_or(body.len());
    body[start..end].to_string()
}

fn truncate_chars(value: &str, max_chars: usize) -> String {
    let mut chars = value.chars();
    let truncated = chars.by_ref().take(max_chars).collect::<String>();
    if chars.next().is_some() {
        format!("{truncated}…")
    } else {
        truncated
    }
}

#[cfg(test)]
mod tests {
    use super::{
        build_search_query, candidate_pool_size, normalize_arxiv_id, parse_arxiv_feed,
        parse_keywords, RankingMode,
    };

    #[test]
    fn parse_keywords_supports_multiple_separators() {
        let keywords = parse_keywords("agent memory，rag\nplanning; benchmark");
        assert_eq!(keywords, vec!["agent memory", "rag", "planning", "benchmark"]);
    }

    #[test]
    fn build_search_query_wraps_keywords() {
        let query = build_search_query(&["agent memory".into(), "tool use".into()]);
        assert_eq!(query, "all:\"agent memory\" OR all:\"tool use\"");
    }

    #[test]
    fn normalize_arxiv_id_removes_version() {
        assert_eq!(normalize_arxiv_id("https://arxiv.org/abs/2503.01234v2"), "2503.01234");
    }

    #[test]
    fn candidate_pool_has_reasonable_bounds() {
        assert_eq!(candidate_pool_size(2), 16);
        assert_eq!(candidate_pool_size(10), 36);
    }

    #[test]
    fn parse_arxiv_feed_extracts_entry_fields() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:arxiv="http://arxiv.org/schemas/atom">
  <entry>
    <id>http://arxiv.org/abs/2503.01234v2</id>
    <updated>2026-03-20T10:00:00Z</updated>
    <published>2026-03-19T09:00:00Z</published>
    <title>  Tool-Using Agents for Planning </title>
    <summary> A paper about tool use and planning. </summary>
    <author><name>Alice</name></author>
    <author><name>Bob</name></author>
    <arxiv:primary_category term="cs.AI" />
    <link rel="alternate" type="text/html" href="https://arxiv.org/abs/2503.01234v2" />
    <link title="pdf" type="application/pdf" href="https://arxiv.org/pdf/2503.01234v2.pdf" />
  </entry>
</feed>"#;

        let papers = parse_arxiv_feed(xml).expect("feed should parse");
        assert_eq!(papers.len(), 1);
        assert_eq!(papers[0].arxiv_id, "2503.01234");
        assert_eq!(papers[0].title, "Tool-Using Agents for Planning");
        assert_eq!(papers[0].authors, "Alice, Bob");
        assert_eq!(papers[0].category, "cs.AI");
    }

    #[test]
    fn ranking_mode_defaults_to_relevance() {
        assert_eq!(RankingMode::from_value(None).as_str(), "relevance");
        assert_eq!(RankingMode::from_value(Some("quality")).as_str(), "quality");
    }
}
