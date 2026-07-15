use super::{
    lint::lint_interest,
    shared::{extract_json_object, extract_wiki_links, normalize_slug, truncate_chars},
};
use crate::llm::{LlmClient, LlmMessage};
use anyhow::{anyhow, Context, Result};
use serde::{Deserialize, Serialize};
use sqlx::{Row, SqlitePool};
use std::collections::{HashMap, HashSet};
use uuid::Uuid;

mod persistence;
mod sources;

pub use persistence::refresh_embeddings_for_pages;
use persistence::{invalidate_removed_sources, persist_pages, resolve_links};
use sources::{load_sources, source_changes};

const MAX_SOURCES_PER_RUN: usize = 10;
const MAX_SOURCE_CHARS: usize = 6_000;
const MAX_PAGES_PER_RUN: usize = 12;

#[derive(Clone, Debug)]
pub(super) struct SourceDocument {
    pub key: String,
    pub kind: String,
    pub id: String,
    pub title: String,
    pub content: String,
    pub hash: String,
}

#[derive(Clone, Debug, Deserialize)]
struct CandidateEnvelope {
    #[serde(default)]
    candidates: Vec<WikiCandidate>,
}

#[derive(Clone, Debug, Deserialize)]
pub(super) struct WikiCandidate {
    #[serde(default)]
    pub slug: String,
    #[serde(default)]
    pub title: String,
    #[serde(default = "default_page_type")]
    pub page_type: String,
    #[serde(default)]
    pub summary: String,
    #[serde(default)]
    pub source_keys: Vec<String>,
    #[serde(default)]
    pub links: Vec<String>,
    #[serde(default)]
    pub confidence: f64,
}

#[derive(Clone, Debug, Deserialize)]
struct GeneratedPageResponse {
    #[serde(default)]
    title: String,
    #[serde(default)]
    summary: String,
    #[serde(default)]
    content: String,
    #[serde(default)]
    links: Vec<String>,
    #[serde(default)]
    confidence: f64,
}

#[derive(Clone, Debug)]
pub(super) struct GeneratedPage {
    pub candidate: WikiCandidate,
    pub title: String,
    pub summary: String,
    pub content: String,
    pub links: Vec<String>,
    pub confidence: f64,
}

#[derive(Clone, Debug, Serialize)]
pub struct WikiCompileSummary {
    pub run_id: String,
    pub status: String,
    pub source_count: usize,
    pub changed_source_count: usize,
    pub removed_source_count: usize,
    pub remaining_source_count: usize,
    pub pages_created: usize,
    pub pages_updated: usize,
    pub embeddings_refreshed: usize,
    pub issue_count: usize,
}

fn default_page_type() -> String {
    "concept".into()
}

pub async fn compile_interest(
    db: &SqlitePool,
    settings: &HashMap<String, String>,
    interest_id: &str,
    force: bool,
) -> Result<WikiCompileSummary> {
    let interest_exists: bool =
        sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM research_interests WHERE id = ?)")
            .bind(interest_id)
            .fetch_one(db)
            .await?;
    if !interest_exists {
        return Err(anyhow!("Research interest not found"));
    }

    let run_id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    sqlx::query(
        "INSERT INTO wiki_compile_runs (id, research_interest_id, status, started_at)
         VALUES (?, ?, 'running', ?)",
    )
    .bind(&run_id)
    .bind(interest_id)
    .bind(&now)
    .execute(db)
    .await?;

    match compile_inner(db, settings, interest_id, &run_id, force).await {
        Ok(summary) => Ok(summary),
        Err(error) => {
            let finished_at = chrono::Utc::now().to_rfc3339();
            let _ = sqlx::query(
                "UPDATE wiki_compile_runs SET status = 'failed', error = ?, finished_at = ? WHERE id = ?",
            )
            .bind(error.to_string())
            .bind(finished_at)
            .bind(&run_id)
            .execute(db)
            .await;
            Err(error)
        }
    }
}

async fn compile_inner(
    db: &SqlitePool,
    settings: &HashMap<String, String>,
    interest_id: &str,
    run_id: &str,
    force: bool,
) -> Result<WikiCompileSummary> {
    let sources = load_sources(db, interest_id).await?;
    let changes = source_changes(db, interest_id, &sources, force).await?;
    let removed_source_count = changes.removed_keys.len();
    if removed_source_count > 0 {
        invalidate_removed_sources(db, interest_id, &changes.removed_keys).await?;
    }
    let changed = if removed_source_count > 0 {
        // 哈希已在失效处理里清空；本次先处理第一批，其余由后台 continuation 接续。
        sources.clone()
    } else {
        changes.changed
    };
    let remaining_source_count = changed.len().saturating_sub(MAX_SOURCES_PER_RUN);
    let selected = changed
        .into_iter()
        .take(MAX_SOURCES_PER_RUN)
        .collect::<Vec<_>>();
    let manifest = sources
        .iter()
        .map(|source| {
            serde_json::json!({
                "key": source.key,
                "hash": source.hash,
            })
        })
        .collect::<Vec<_>>();
    sqlx::query(
        "UPDATE wiki_compile_runs SET source_count = ?, changed_source_count = ?, source_manifest = ? WHERE id = ?",
    )
    .bind(sources.len() as i64)
    .bind((selected.len() + removed_source_count) as i64)
    .bind(serde_json::to_string(&manifest)?)
    .bind(run_id)
    .execute(db)
    .await?;

    if selected.is_empty() {
        let lint = lint_interest(db, interest_id).await?;
        let finished_at = chrono::Utc::now().to_rfc3339();
        sqlx::query(
            "UPDATE wiki_compile_runs SET status = ?, issue_count = ?, finished_at = ? WHERE id = ?",
        )
        .bind(if removed_source_count > 0 {
            "completed"
        } else {
            "unchanged"
        })
        .bind(lint.issue_count as i64)
        .bind(&finished_at)
        .bind(run_id)
        .execute(db)
        .await?;
        return Ok(WikiCompileSummary {
            run_id: run_id.into(),
            status: if removed_source_count > 0 {
                "completed".into()
            } else {
                "unchanged".into()
            },
            source_count: sources.len(),
            changed_source_count: 0,
            removed_source_count,
            remaining_source_count: 0,
            pages_created: 0,
            pages_updated: 0,
            embeddings_refreshed: 0,
            issue_count: lint.issue_count,
        });
    }

    let client = LlmClient::from_settings(settings).context("Wiki 编译需要先配置可用的对话模型")?;
    let candidates = extract_candidates(db, &client, interest_id, &selected).await?;
    let mut generated = Vec::new();
    for candidate in candidates.into_iter().take(MAX_PAGES_PER_RUN) {
        generated.push(generate_page(db, &client, interest_id, &sources, candidate).await?);
    }
    let (created, updated, page_ids) =
        persist_pages(db, interest_id, run_id, &sources, &selected, &generated).await?;
    let embeddings_refreshed = refresh_embeddings_for_pages(db, settings, &page_ids).await;
    resolve_links(db, interest_id).await?;
    let lint = lint_interest(db, interest_id).await?;
    let status = if remaining_source_count > 0 {
        "partial"
    } else {
        "completed"
    };
    let finished_at = chrono::Utc::now().to_rfc3339();
    sqlx::query(
        "UPDATE wiki_compile_runs SET status = ?, pages_created = ?, pages_updated = ?,
         issue_count = ?, finished_at = ? WHERE id = ?",
    )
    .bind(status)
    .bind(created as i64)
    .bind(updated as i64)
    .bind(lint.issue_count as i64)
    .bind(&finished_at)
    .bind(run_id)
    .execute(db)
    .await?;

    Ok(WikiCompileSummary {
        run_id: run_id.into(),
        status: status.into(),
        source_count: sources.len(),
        changed_source_count: selected.len(),
        removed_source_count,
        remaining_source_count,
        pages_created: created,
        pages_updated: updated,
        embeddings_refreshed,
        issue_count: lint.issue_count,
    })
}

async fn extract_candidates(
    db: &SqlitePool,
    client: &LlmClient,
    interest_id: &str,
    sources: &[SourceDocument],
) -> Result<Vec<WikiCandidate>> {
    let existing = sqlx::query(
        "SELECT slug, title, summary FROM wiki_pages pages
         WHERE research_interest_id = ? AND (
            status != 'archived' OR EXISTS (
                SELECT 1 FROM wiki_page_sources sources WHERE sources.page_id = pages.id
            )
         ) ORDER BY updated_at DESC LIMIT 40",
    )
    .bind(interest_id)
    .fetch_all(db)
    .await?
    .into_iter()
    .map(|row| {
        format!(
            "- [[{}|{}]]：{}",
            row.get::<String, _>("slug"),
            row.get::<String, _>("title"),
            truncate_chars(&row.get::<String, _>("summary"), 180)
        )
    })
    .collect::<Vec<_>>()
    .join("\n");
    let source_text = sources
        .iter()
        .map(|source| {
            format!(
                "\n=== SOURCE {} | {} ===\n{}",
                source.key,
                source.title,
                truncate_chars(&source.content, MAX_SOURCE_CHARS)
            )
        })
        .collect::<Vec<_>>()
        .join("\n");
    let system = r#"你是研究知识库的 Wiki 概念抽取器，只完成“候选概念抽取”，不要撰写页面正文。
把多个来源中的同一实体、方法或概念合并为稳定页面；已有页面应优先复用已有 slug。保留来源间的分歧，不要凭空补事实。
仅返回 JSON 对象，格式：
{"candidates":[{"slug":"stable-slug","title":"标题","page_type":"overview|concept|method|entity|comparison|synthesis","summary":"一句话摘要","source_keys":["paper:原始ID"],"links":["related-slug"],"confidence":0.0}]}
source_keys 必须逐字使用输入中的 SOURCE key。最多 12 个候选。"#;
    let user = format!("已有 Wiki 索引：\n{existing}\n\n本次变更来源：{source_text}");
    let raw = client
        .chat(
            &[LlmMessage::system(system), LlmMessage::user(user)],
            None,
            0.1,
        )
        .await?;
    let json = extract_json_object(&raw).ok_or_else(|| anyhow!("Wiki 概念抽取未返回 JSON"))?;
    let envelope: CandidateEnvelope =
        serde_json::from_str(json).with_context(|| "Wiki 概念抽取 JSON 无法解析")?;
    Ok(normalize_candidates(envelope.candidates, sources))
}

fn normalize_candidates(
    candidates: Vec<WikiCandidate>,
    sources: &[SourceDocument],
) -> Vec<WikiCandidate> {
    let allowed_sources = sources
        .iter()
        .map(|source| source.key.clone())
        .collect::<HashSet<_>>();
    let mut merged: HashMap<String, WikiCandidate> = HashMap::new();
    for mut candidate in candidates {
        candidate.slug = normalize_slug(if candidate.slug.is_empty() {
            &candidate.title
        } else {
            &candidate.slug
        });
        candidate.title = candidate.title.trim().to_string();
        if candidate.slug.is_empty() || candidate.title.is_empty() {
            continue;
        }
        if ![
            "overview",
            "concept",
            "method",
            "entity",
            "comparison",
            "synthesis",
        ]
        .contains(&candidate.page_type.as_str())
        {
            candidate.page_type = default_page_type();
        }
        candidate
            .source_keys
            .retain(|key| allowed_sources.contains(key));
        candidate.source_keys.sort();
        candidate.source_keys.dedup();
        if candidate.source_keys.is_empty() {
            continue;
        }
        candidate.links = candidate
            .links
            .into_iter()
            .map(|link| normalize_slug(&link))
            .filter(|link| !link.is_empty() && link != &candidate.slug)
            .collect();
        candidate.links.sort();
        candidate.links.dedup();
        candidate.confidence = candidate.confidence.clamp(0.0, 1.0);
        merged
            .entry(candidate.slug.clone())
            .and_modify(|existing| {
                existing.source_keys.extend(candidate.source_keys.clone());
                existing.source_keys.sort();
                existing.source_keys.dedup();
                existing.links.extend(candidate.links.clone());
                existing.links.sort();
                existing.links.dedup();
                existing.confidence = existing.confidence.max(candidate.confidence);
            })
            .or_insert(candidate);
    }
    let mut values = merged.into_values().collect::<Vec<_>>();
    values.sort_by(|a, b| {
        b.source_keys
            .len()
            .cmp(&a.source_keys.len())
            .then_with(|| a.slug.cmp(&b.slug))
    });
    values
}

async fn generate_page(
    db: &SqlitePool,
    client: &LlmClient,
    interest_id: &str,
    sources: &[SourceDocument],
    mut candidate: WikiCandidate,
) -> Result<GeneratedPage> {
    let existing_row = sqlx::query(
        "SELECT id, title, summary, content FROM wiki_pages WHERE research_interest_id = ? AND slug = ?",
    )
    .bind(interest_id)
    .bind(&candidate.slug)
    .fetch_optional(db)
    .await?;
    if let Some(row) = existing_row.as_ref() {
        let existing_page_id: String = row.get("id");
        let existing_source_keys =
            sqlx::query("SELECT source_kind, source_id FROM wiki_page_sources WHERE page_id = ?")
                .bind(existing_page_id)
                .fetch_all(db)
                .await?
                .into_iter()
                .map(|source| {
                    format!(
                        "{}:{}",
                        source.get::<String, _>("source_kind"),
                        source.get::<String, _>("source_id")
                    )
                });
        candidate.source_keys.extend(existing_source_keys);
        candidate.source_keys.sort();
        candidate.source_keys.dedup();
    }
    let existing = existing_row
        .map(|row| {
            format!(
                "标题：{}\n摘要：{}\n正文：\n{}",
                row.get::<String, _>("title"),
                row.get::<String, _>("summary"),
                row.get::<String, _>("content")
            )
        })
        .unwrap_or_else(|| "（新页面）".into());
    let source_text = sources
        .iter()
        .filter(|source| candidate.source_keys.contains(&source.key))
        .map(|source| {
            format!(
                "\n=== SOURCE {} | {} ===\n{}",
                source.key,
                source.title,
                truncate_chars(&source.content, MAX_SOURCE_CHARS)
            )
        })
        .collect::<Vec<_>>()
        .join("\n");
    let system = r#"你是研究型 LLM Wiki 页面编译器。请将多个来源合并为一篇可审阅、可追溯的 Markdown 页面。
要求：
1. 仅使用给定来源；关键事实句末添加精确引用 `[source:paper:原始ID]` 或 `[source:note:原始ID]`。
2. 使用 `[[target-slug|显示标题]]` 链接相关 Wiki 页面。
3. 若来源冲突，单列“争议与边界”，说明各自说法，不替用户裁决。
4. 更新旧页面时保留仍有来源支持的内容，删除失去支持的断言。
5. 正文使用二级标题组织，不要重复一级标题。
仅返回 JSON：{"title":"","summary":"","content":"Markdown 正文","links":["target-slug"],"confidence":0.0}"#;
    let user = format!(
        "候选页面：slug={}，title={}，type={}，候选摘要={}，建议链接={:?}\n\n旧页面：\n{}\n\n来源：{}",
        candidate.slug,
        candidate.title,
        candidate.page_type,
        candidate.summary,
        candidate.links,
        existing,
        source_text
    );
    let raw = client
        .chat(
            &[LlmMessage::system(system), LlmMessage::user(user)],
            None,
            0.2,
        )
        .await?;
    let json = extract_json_object(&raw).ok_or_else(|| anyhow!("Wiki 页面生成未返回 JSON"))?;
    let response: GeneratedPageResponse = serde_json::from_str(json)
        .with_context(|| format!("Wiki 页面 {} 的 JSON 无法解析", candidate.slug))?;
    if response.content.trim().is_empty() {
        return Err(anyhow!("Wiki 页面 {} 的正文为空", candidate.slug));
    }
    let mut links = candidate.links.clone();
    links.extend(response.links.into_iter().map(|link| normalize_slug(&link)));
    links.extend(extract_wiki_links(&response.content));
    links.retain(|link| !link.is_empty() && link != &candidate.slug);
    links.sort();
    links.dedup();
    Ok(GeneratedPage {
        title: if response.title.trim().is_empty() {
            candidate.title.clone()
        } else {
            response.title.trim().into()
        },
        summary: if response.summary.trim().is_empty() {
            candidate.summary.clone()
        } else {
            response.summary.trim().into()
        },
        content: response.content.trim().into(),
        confidence: response
            .confidence
            .max(candidate.confidence)
            .clamp(0.0, 1.0),
        links,
        candidate,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn candidates_merge_by_stable_slug() {
        let sources = vec![
            SourceDocument {
                key: "paper:1".into(),
                kind: "paper".into(),
                id: "1".into(),
                title: "A".into(),
                content: "A".into(),
                hash: "a".into(),
            },
            SourceDocument {
                key: "note:2".into(),
                kind: "note".into(),
                id: "2".into(),
                title: "B".into(),
                content: "B".into(),
                hash: "b".into(),
            },
        ];
        let candidates = vec![
            WikiCandidate {
                slug: "Graph RAG".into(),
                title: "Graph RAG".into(),
                page_type: "method".into(),
                summary: "A".into(),
                source_keys: vec!["paper:1".into()],
                links: vec![],
                confidence: 0.7,
            },
            WikiCandidate {
                slug: "graph-rag".into(),
                title: "图谱 RAG".into(),
                page_type: "method".into(),
                summary: "B".into(),
                source_keys: vec!["note:2".into()],
                links: vec![],
                confidence: 0.8,
            },
        ];
        let merged = normalize_candidates(candidates, &sources);
        assert_eq!(merged.len(), 1);
        assert_eq!(merged[0].source_keys, vec!["note:2", "paper:1"]);
        assert_eq!(merged[0].confidence, 0.8);
    }
}
