use crate::llm::{LlmClient, LlmMessage};

use super::{BriefingDeadline, BriefingPaper, RawDeadlineCandidate, RawPaperCandidate};

const BRIEFING_GENERATION_PROMPT: &str = r#"你是一位研究情报分析助手。请基于下面某个研究兴趣在近期（最近 7 天）收集到的论文和会议截稿信息，生成一份结构化的「领域动态简报」。

输出必须是合法 JSON，格式如下：
{
  "summary": "用 2-4 句话概括本周该领域最值得关注的动态，中文。",
  "trends": ["趋势/热点 1", "趋势/热点 2"],
  "key_papers": [{"external_id": "候选论文唯一标识", "source": "arxiv 或 semantic_scholar", "relevance_score": 85, "relevance_reason": "为什么值得关注的 1 句话中文说明"}],
  "upcoming_deadlines": [{"external_id": "候选会议唯一标识"}]
}

要求：
- summary 要凝练、有洞察力，避免简单罗列标题。
- trends 控制在 3-6 条，每条是短语或短句。
- key_papers 只选最相关的 3-6 篇，且只能选择候选论文中的 external_id。
- upcoming_deadlines 只选候选列表中尚未截稿的会议，最多 4 个。
- 不要输出 Markdown 代码块，只输出纯 JSON。"#;

#[derive(Debug, Clone)]
pub(super) struct GeneratedBriefing {
    pub(super) summary: String,
    pub(super) trends: Vec<String>,
    pub(super) key_papers: Vec<BriefingPaper>,
    pub(super) upcoming_deadlines: Vec<BriefingDeadline>,
}

#[derive(Debug, serde::Deserialize)]
struct ModelBriefing {
    #[serde(default)]
    summary: String,
    #[serde(default)]
    trends: Vec<String>,
    #[serde(default)]
    key_papers: Vec<ModelPaperSelection>,
    #[serde(default)]
    upcoming_deadlines: Vec<ModelDeadlineSelection>,
}

#[derive(Debug, serde::Deserialize)]
struct ModelPaperSelection {
    #[serde(default)]
    external_id: String,
    #[serde(default)]
    source: String,
    #[serde(default = "default_relevance_score")]
    relevance_score: i32,
    #[serde(default)]
    relevance_reason: String,
}

#[derive(Debug, serde::Deserialize)]
struct ModelDeadlineSelection {
    #[serde(default)]
    external_id: String,
}

fn default_relevance_score() -> i32 {
    70
}

pub(super) async fn generate_briefing(
    client: Option<&LlmClient>,
    model: Option<&str>,
    temperature: f32,
    topic: &str,
    keywords: &[String],
    papers: &[RawPaperCandidate],
    deadlines: &[RawDeadlineCandidate],
) -> GeneratedBriefing {
    let fallback = fallback_briefing(topic, keywords, papers, deadlines);
    if papers.is_empty() && deadlines.is_empty() {
        return fallback;
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

    let Some(client) = client else {
        return fallback;
    };
    let Some(response) = client.chat(&messages, model, temperature).await.ok() else {
        return fallback;
    };
    let Some(generated) = parse_generated_briefing(&response) else {
        return fallback;
    };

    normalize_generated_briefing(generated, fallback, papers, deadlines)
}

fn parse_generated_briefing(response: &str) -> Option<ModelBriefing> {
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

fn normalize_generated_briefing(
    generated: ModelBriefing,
    fallback: GeneratedBriefing,
    papers: &[RawPaperCandidate],
    deadlines: &[RawDeadlineCandidate],
) -> GeneratedBriefing {
    let mut seen_papers = std::collections::HashSet::new();
    let key_papers = generated
        .key_papers
        .iter()
        .filter_map(|selected| {
            let candidate = papers.iter().find(|candidate| {
                candidate.source == selected.source && candidate.external_id == selected.external_id
            })?;
            let key = format!("{}:{}", candidate.source, candidate.external_id);
            if !seen_papers.insert(key) {
                return None;
            }
            Some(BriefingPaper {
                external_id: candidate.external_id.clone(),
                source: candidate.source.clone(),
                title: candidate.title.clone(),
                authors: candidate.authors.clone(),
                published_at: candidate.published_at.clone(),
                url: candidate.url.clone(),
                pdf_url: candidate.pdf_url.clone(),
                relevance_score: selected.relevance_score.clamp(0, 100),
                relevance_reason: selected.relevance_reason.trim().chars().take(180).collect(),
            })
        })
        .take(6)
        .collect::<Vec<_>>();

    let mut seen_deadlines = std::collections::HashSet::new();
    let upcoming_deadlines = generated
        .upcoming_deadlines
        .iter()
        .filter_map(|selected| {
            let candidate = deadlines
                .iter()
                .find(|candidate| candidate.external_id == selected.external_id)?;
            if !seen_deadlines.insert(candidate.external_id.clone()) {
                return None;
            }
            Some(BriefingDeadline {
                external_id: candidate.external_id.clone(),
                name: candidate.name.clone(),
                deadline: candidate.deadline.clone(),
                url: candidate.url.clone(),
                days_remaining: candidate.days_remaining,
            })
        })
        .take(4)
        .collect::<Vec<_>>();

    let mut seen_trends = std::collections::HashSet::new();
    let trends = generated
        .trends
        .iter()
        .map(|trend| trend.trim())
        .filter(|trend| !trend.is_empty() && trend.chars().count() <= 48)
        .filter(|trend| seen_trends.insert((*trend).to_lowercase()))
        .take(6)
        .map(ToString::to_string)
        .collect::<Vec<_>>();

    GeneratedBriefing {
        summary: normalized_summary(&generated.summary, &fallback.summary),
        trends: if trends.is_empty() {
            fallback.trends
        } else {
            trends
        },
        key_papers: if key_papers.is_empty() {
            fallback.key_papers
        } else {
            key_papers
        },
        upcoming_deadlines: if upcoming_deadlines.is_empty() {
            fallback.upcoming_deadlines
        } else {
            upcoming_deadlines
        },
    }
}

fn normalized_summary(summary: &str, fallback: &str) -> String {
    let normalized = summary.trim();
    if normalized.is_empty() || normalized.chars().count() > 900 {
        fallback.to_string()
    } else {
        normalized.to_string()
    }
}

fn fallback_briefing(
    topic: &str,
    keywords: &[String],
    papers: &[RawPaperCandidate],
    deadlines: &[RawDeadlineCandidate],
) -> GeneratedBriefing {
    let key_papers = papers
        .iter()
        .take(6)
        .map(|paper| BriefingPaper {
            external_id: paper.external_id.clone(),
            source: paper.source.clone(),
            title: paper.title.clone(),
            authors: paper.authors.clone(),
            published_at: paper.published_at.clone(),
            url: paper.url.clone(),
            pdf_url: paper.pdf_url.clone(),
            relevance_score: 70,
            relevance_reason: "基于研究兴趣与关键词检索到的近期候选论文。".to_string(),
        })
        .collect();
    let upcoming_deadlines = deadlines
        .iter()
        .take(4)
        .map(|deadline| BriefingDeadline {
            external_id: deadline.external_id.clone(),
            name: deadline.name.clone(),
            deadline: deadline.deadline.clone(),
            url: deadline.url.clone(),
            days_remaining: deadline.days_remaining,
        })
        .collect();
    let trends = keywords
        .iter()
        .map(|keyword| keyword.trim())
        .filter(|keyword| !keyword.is_empty())
        .take(4)
        .map(ToString::to_string)
        .collect::<Vec<_>>();

    GeneratedBriefing {
        summary: format!(
            "本期为「{}」收集到 {} 篇近期候选论文{}。建议优先浏览高相关论文，并结合后续扫描观察趋势变化。",
            topic,
            papers.len(),
            if deadlines.is_empty() {
                "".to_string()
            } else {
                format!("，以及 {} 个相关截稿提醒", deadlines.len())
            }
        ),
        trends: if trends.is_empty() {
            vec!["近期研究追踪".to_string()]
        } else {
            trends
        },
        key_papers,
        upcoming_deadlines,
    }
}
