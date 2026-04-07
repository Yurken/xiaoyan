use crate::citation_graph::CitationGraph;
use crate::rag::{combined_search, SearchResult};
use anyhow::Result;
use serde::Serialize;
use sqlx::{QueryBuilder, Row, Sqlite, SqlitePool};
use std::collections::{HashMap, HashSet};

#[derive(Debug, Clone, Serialize)]
pub struct GraphRagSource {
    pub title: String,
    pub source_id: String,
    pub source_kind: String,
    pub relation_kind: String,
    pub detail: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct GraphRagClaim {
    pub id: String,
    pub title: String,
    pub statement: String,
    pub status: String,
    pub score: f32,
    pub sources: Vec<GraphRagSource>,
}

fn relation_label(kind: &str) -> &'static str {
    match kind {
        "supports" => "支持",
        "contradicts" => "冲突",
        "background" => "背景",
        _ => "关联",
    }
}

fn status_label(status: &str) -> &'static str {
    match status {
        "supported" => "已支持",
        "hypothesis" => "待验证",
        "contested" => "有争议",
        "open" => "开放问题",
        _ => "未知状态",
    }
}

fn source_kind_label(kind: &str) -> &'static str {
    match kind {
        "paper" => "论文",
        "experiment" => "实验",
        "note" => "笔记",
        _ => "来源",
    }
}

fn fallback_detail(result: &SearchResult) -> String {
    result
        .content
        .replace('\n', " ")
        .chars()
        .take(120)
        .collect::<String>()
}

async fn fetch_claim_rows(
    db: &SqlitePool,
    paper_ids: &[String],
    note_ids: &[String],
) -> Result<Vec<sqlx::sqlite::SqliteRow>> {
    let mut has_filter = false;
    let mut query_builder = QueryBuilder::<Sqlite>::new(
        "SELECT c.id, c.title, c.statement, c.status, \
                e.source_kind, e.source_id, e.relation_kind, e.evidence_summary \
         FROM knowledge_graph_claims c \
         JOIN knowledge_graph_evidence_links e ON e.claim_id = c.id \
         WHERE ",
    );

    if !paper_ids.is_empty() {
        has_filter = true;
        query_builder.push("(e.source_kind = 'paper' AND e.source_id IN (");
        {
            let mut separated = query_builder.separated(", ");
            for id in paper_ids {
                separated.push_bind(id);
            }
        }
        query_builder.push("))");
    }

    if !note_ids.is_empty() {
        if has_filter {
            query_builder.push(" OR ");
        }
        has_filter = true;
        query_builder.push("(e.source_kind = 'note' AND e.source_id IN (");
        {
            let mut separated = query_builder.separated(", ");
            for id in note_ids {
                separated.push_bind(id);
            }
        }
        query_builder.push("))");
    }

    if !has_filter {
        return Ok(Vec::new());
    }

    query_builder.push(" ORDER BY c.updated_at DESC");
    Ok(query_builder.build().fetch_all(db).await?)
}

async fn fetch_experiment_rows(
    db: &SqlitePool,
    claim_ids: &[String],
) -> Result<Vec<sqlx::sqlite::SqliteRow>> {
    if claim_ids.is_empty() {
        return Ok(Vec::new());
    }

    let mut query_builder = QueryBuilder::<Sqlite>::new(
        "SELECT e.claim_id, e.relation_kind, e.evidence_summary, x.id, x.title, x.result, x.notes \
         FROM knowledge_graph_evidence_links e \
         JOIN experiment_records x ON x.id = e.source_id \
         WHERE e.source_kind = 'experiment' AND e.claim_id IN (",
    );
    {
        let mut separated = query_builder.separated(", ");
        for id in claim_ids {
            separated.push_bind(id);
        }
    }
    query_builder.push(")");

    Ok(query_builder.build().fetch_all(db).await?)
}

pub async fn search_claim_provenance(
    db: &SqlitePool,
    query_embedding: &[f32],
    top_k: usize,
) -> Result<Vec<GraphRagClaim>> {
    let retrievals = combined_search(db, query_embedding, top_k).await?;
    if retrievals.is_empty() {
        return Ok(Vec::new());
    }

    let mut paper_ids = Vec::new();
    let mut note_ids = Vec::new();
    let mut source_scores: HashMap<(String, String), f32> = HashMap::new();
    let mut source_lookup: HashMap<(String, String), SearchResult> = HashMap::new();

    for item in retrievals {
        let source_key = (item.entity_type.clone(), item.entity_id.clone());
        source_scores
            .entry(source_key.clone())
            .and_modify(|score| *score = score.max(item.score))
            .or_insert(item.score);
        source_lookup.entry(source_key.clone()).or_insert(item);

        match source_key.0.as_str() {
            "paper" => paper_ids.push(source_key.1),
            "note" => note_ids.push(source_key.1),
            _ => {}
        }
    }

    paper_ids.sort();
    paper_ids.dedup();
    note_ids.sort();
    note_ids.dedup();

    let claim_rows = fetch_claim_rows(db, &paper_ids, &note_ids).await?;
    if claim_rows.is_empty() {
        return Ok(Vec::new());
    }

    let mut claim_scores: HashMap<String, f32> = HashMap::new();
    let mut claim_meta: HashMap<String, (String, String, String)> = HashMap::new();
    let mut claim_sources: HashMap<String, Vec<GraphRagSource>> = HashMap::new();

    for row in claim_rows {
        let claim_id: String = row.get("id");
        let source_kind: String = row.get("source_kind");
        let source_id: String = row.get("source_id");
        let relation_kind: String = row.get("relation_kind");
        let evidence_summary = row.get::<Option<String>, _>("evidence_summary").unwrap_or_default();
        let source_key = (source_kind.clone(), source_id.clone());
        let base_score = source_scores.get(&source_key).copied().unwrap_or(0.0);
        let relation_weight = if relation_kind == "supports" {
            1.0
        } else if relation_kind == "background" {
            0.65
        } else {
            0.45
        };

        claim_meta.entry(claim_id.clone()).or_insert((
            row.get("title"),
            row.get("statement"),
            row.get("status"),
        ));
        *claim_scores.entry(claim_id.clone()).or_insert(0.0) += base_score * relation_weight;

        let fallback = source_lookup
            .get(&source_key)
            .map(fallback_detail)
            .unwrap_or_default();
        let source_title = source_lookup
            .get(&source_key)
            .map(|item| item.source.clone())
            .unwrap_or_else(|| format!("{} {}", source_kind_label(&source_kind), source_id));

        claim_sources.entry(claim_id).or_default().push(GraphRagSource {
            title: source_title,
            source_id,
            source_kind,
            relation_kind,
            detail: if evidence_summary.trim().is_empty() { fallback } else { evidence_summary },
        });
    }

    let claim_ids = claim_meta.keys().cloned().collect::<Vec<_>>();
    let experiment_rows = fetch_experiment_rows(db, &claim_ids).await?;
    for row in experiment_rows {
        let claim_id: String = row.get("claim_id");
        let relation_kind: String = row.get("relation_kind");
        let evidence_summary = row.get::<Option<String>, _>("evidence_summary").unwrap_or_default();
        let title: String = row.get("title");
        let result: String = row.get("result");
        let notes: String = row.get("notes");
        claim_sources.entry(claim_id.clone()).or_default().push(GraphRagSource {
            title,
            source_id: row.get("id"),
            source_kind: "experiment".to_string(),
            relation_kind: relation_kind.clone(),
            detail: if evidence_summary.trim().is_empty() {
                let raw = if result.trim().is_empty() { notes } else { result };
                raw.replace('\n', " ").chars().take(120).collect()
            } else {
                evidence_summary
            },
        });
        *claim_scores.entry(claim_id).or_insert(0.0) += if relation_kind == "supports" { 0.24 } else { 0.14 };
    }

    let mut claims = claim_meta
        .into_iter()
        .map(|(id, (title, statement, status))| GraphRagClaim {
            score: claim_scores.get(&id).copied().unwrap_or_default(),
            sources: claim_sources.remove(&id).unwrap_or_default(),
            id,
            title,
            statement,
            status,
        })
        .collect::<Vec<_>>();

    claims.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
    claims.truncate(4);
    Ok(claims)
}

pub async fn build_graph_rag_context(
    db: &SqlitePool,
    query_embedding: &[f32],
    top_k: usize,
) -> Result<String> {
    let claims = search_claim_provenance(db, query_embedding, top_k).await?;
    if claims.is_empty() {
        return Ok(String::new());
    }

    let seed_paper_ids = claims
        .iter()
        .flat_map(|claim| {
            claim
                .sources
                .iter()
                .filter(|source| source.source_kind == "paper")
                .map(|source| source.source_id.clone())
        })
        .collect::<HashSet<_>>();
    let citation_graph = CitationGraph::load(db).await.ok();
    let citation_rows = citation_graph
        .map(|graph| graph.local_neighborhood(&seed_paper_ids, 8))
        .unwrap_or_default();

    let mut sections = vec!["[GraphRAG 图谱溯源]".to_string()];
    for (index, claim) in claims.iter().enumerate() {
        let mut block = vec![format!(
            "{}. {}（{}）",
            index + 1,
            claim.title,
            status_label(&claim.status)
        )];
        block.push(claim.statement.clone());
        for source in claim.sources.iter().take(4) {
            block.push(format!(
                "- {}{}：{}",
                relation_label(&source.relation_kind),
                source_kind_label(&source.source_kind),
                if source.detail.trim().is_empty() {
                    source.title.clone()
                } else {
                    format!("{}；{}", source.title, source.detail)
                }
            ));
        }
        sections.push(block.join("\n"));
    }

    if !citation_rows.is_empty() {
        let citation_lines = citation_rows
            .iter()
            .map(|row| {
                let context = row.context.clone().unwrap_or_default();
                if context.trim().is_empty() {
                    format!("- {} -> {}", row.citing_title, row.cited_title)
                } else {
                    format!("- {} -> {}：{}", row.citing_title, row.cited_title, context)
                }
            })
            .collect::<Vec<_>>();
        sections.push(format!("[论文引用邻域]\n{}", citation_lines.join("\n")));
    }

    Ok(sections.join("\n\n"))
}

pub async fn collect_graph_rag_sources(
    db: &SqlitePool,
    query_embedding: &[f32],
    top_k: usize,
) -> Result<Vec<serde_json::Value>> {
    let claims = search_claim_provenance(db, query_embedding, top_k).await?;
    Ok(claims
        .into_iter()
        .map(|claim| {
            let summary = claim
                .sources
                .iter()
                .take(3)
                .map(|source| format!("{}{}：{}", relation_label(&source.relation_kind), source_kind_label(&source.source_kind), source.title))
                .collect::<Vec<_>>()
                .join("；");
            serde_json::json!({
                "content": claim.statement,
                "source": format!("知识图谱结论 · {}", claim.title),
                "url": serde_json::Value::Null,
                "summary": summary,
            })
        })
        .collect())
}
