use crate::state::AppState;
use serde::Serialize;
use sqlx::{Row, SqlitePool};
use std::collections::HashSet;
use tauri::State;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeGraphInterest {
    pub id: String,
    pub topic: String,
    pub folder_name: Option<String>,
    pub keywords: Vec<String>,
    pub status: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeGraphPaper {
    pub id: String,
    pub title: String,
    pub authors: Option<String>,
    pub year: Option<i64>,
    pub venue: Option<String>,
    pub research_interest_id: Option<String>,
    pub tags: Vec<String>,
    pub status: String,
    pub notes: Option<String>,
    pub key_conclusions: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeGraphNote {
    pub id: String,
    pub title: String,
    pub content: String,
    pub source_type: String,
    pub source_id: Option<String>,
    pub tags: Vec<String>,
    pub research_interest_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeGraphExperiment {
    pub id: String,
    pub title: String,
    pub result: String,
    pub notes: String,
    pub linked_submission_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeGraphClaim {
    pub id: String,
    pub title: String,
    pub statement: String,
    pub research_interest_id: Option<String>,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeGraphEvidenceLink {
    pub id: String,
    pub claim_id: String,
    pub source_kind: String,
    pub source_id: String,
    pub relation_kind: String,
    pub evidence_summary: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeGraphCitation {
    pub id: String,
    pub citing_paper_id: String,
    pub cited_paper_id: String,
    pub context: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeGraphSummary {
    pub interest_count: usize,
    pub paper_count: usize,
    pub note_count: usize,
    pub experiment_count: usize,
    pub claim_count: usize,
    pub evidence_count: usize,
    pub citation_count: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeGraphSnapshot {
    pub interests: Vec<KnowledgeGraphInterest>,
    pub papers: Vec<KnowledgeGraphPaper>,
    pub notes: Vec<KnowledgeGraphNote>,
    pub experiments: Vec<KnowledgeGraphExperiment>,
    pub claims: Vec<KnowledgeGraphClaim>,
    pub evidence_links: Vec<KnowledgeGraphEvidenceLink>,
    pub citations: Vec<KnowledgeGraphCitation>,
    pub summary: KnowledgeGraphSummary,
}

fn now() -> String {
    chrono::Utc::now().to_rfc3339()
}

fn parse_string_array(raw: Option<String>) -> Vec<String> {
    raw.and_then(|value| serde_json::from_str::<Vec<String>>(&value).ok())
        .unwrap_or_default()
}

fn normalize_optional_id(value: Option<String>) -> Option<String> {
    value.and_then(|item| {
        let trimmed = item.trim().to_string();
        if trimmed.is_empty() { None } else { Some(trimmed) }
    })
}

fn validate_claim_status(status: &str) -> Result<&str, String> {
    match status {
        "supported" | "hypothesis" | "contested" | "open" => Ok(status),
        _ => Err("结论状态仅支持 hypothesis / supported / contested / open".to_string()),
    }
}

fn validate_relation_kind(kind: &str) -> Result<&str, String> {
    match kind {
        "supports" | "contradicts" | "background" => Ok(kind),
        _ => Err("证据关系仅支持 supports / contradicts / background".to_string()),
    }
}

async fn ensure_source_exists(
    db: &SqlitePool,
    source_kind: &str,
    source_id: &str,
) -> Result<(), String> {
    let sql = match source_kind {
        "paper" => "SELECT id FROM papers WHERE id = ?",
        "experiment" => "SELECT id FROM experiment_records WHERE id = ?",
        "note" => "SELECT id FROM knowledge_notes WHERE id = ?",
        _ => return Err("证据来源仅支持 paper / experiment / note".to_string()),
    };

    let exists = sqlx::query(sql)
        .bind(source_id)
        .fetch_optional(db)
        .await
        .map_err(|e| e.to_string())?;

    if exists.is_none() {
        return Err("未找到对应证据来源。".to_string());
    }

    Ok(())
}

fn is_unique_violation(message: &str) -> bool {
    message.contains("UNIQUE constraint failed")
}

#[tauri::command]
pub async fn knowledge_graph_snapshot(
    state: State<'_, AppState>,
) -> Result<KnowledgeGraphSnapshot, String> {
    let interest_rows = sqlx::query(
        "SELECT id, topic, folder_name, keywords, status, created_at
         FROM research_interests
         ORDER BY created_at DESC",
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    let interests = interest_rows
        .iter()
        .map(|row| KnowledgeGraphInterest {
            id: row.get("id"),
            topic: row.get("topic"),
            folder_name: row.get("folder_name"),
            keywords: parse_string_array(row.get("keywords")),
            status: row.get("status"),
            created_at: row.get("created_at"),
        })
        .collect::<Vec<_>>();

    let paper_rows = sqlx::query(
        "SELECT p.id, p.title, p.authors, p.year, p.venue, p.research_interest_id, p.tags, p.status,
                p.notes, p.created_at, p.updated_at, a.key_conclusions
         FROM papers p
         LEFT JOIN paper_analyses a ON a.paper_id = p.id
         ORDER BY COALESCE(p.year, 0) DESC, p.updated_at DESC",
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    let papers = paper_rows
        .iter()
        .map(|row| KnowledgeGraphPaper {
            id: row.get("id"),
            title: row.get("title"),
            authors: row.get("authors"),
            year: row.get("year"),
            venue: row.get("venue"),
            research_interest_id: row.get("research_interest_id"),
            tags: parse_string_array(row.get("tags")),
            status: row.get("status"),
            notes: row.get("notes"),
            key_conclusions: row.get("key_conclusions"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        })
        .collect::<Vec<_>>();

    let note_rows = sqlx::query(
        "SELECT id, title, content, source_type, source_id, tags, research_interest_id, created_at, updated_at
         FROM knowledge_notes
         ORDER BY updated_at DESC",
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    let notes = note_rows
        .iter()
        .map(|row| KnowledgeGraphNote {
            id: row.get("id"),
            title: row.get("title"),
            content: row.get("content"),
            source_type: row.get("source_type"),
            source_id: row.get("source_id"),
            tags: parse_string_array(row.get("tags")),
            research_interest_id: row.get("research_interest_id"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        })
        .collect::<Vec<_>>();

    let experiment_rows = sqlx::query(
        "SELECT id, title, result, notes, linked_submission_id, created_at, updated_at
         FROM experiment_records
         ORDER BY updated_at DESC",
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    let experiments = experiment_rows
        .iter()
        .map(|row| KnowledgeGraphExperiment {
            id: row.get("id"),
            title: row.get("title"),
            result: row.get("result"),
            notes: row.get("notes"),
            linked_submission_id: row.get("linked_submission_id"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        })
        .collect::<Vec<_>>();

    let claim_rows = sqlx::query(
        "SELECT id, title, statement, research_interest_id, status, created_at, updated_at
         FROM knowledge_graph_claims
         ORDER BY updated_at DESC",
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    let claims = claim_rows
        .iter()
        .map(|row| KnowledgeGraphClaim {
            id: row.get("id"),
            title: row.get("title"),
            statement: row.get("statement"),
            research_interest_id: row.get("research_interest_id"),
            status: row.get("status"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        })
        .collect::<Vec<_>>();

    let evidence_rows = sqlx::query(
        "SELECT id, claim_id, source_kind, source_id, relation_kind, evidence_summary, created_at
         FROM knowledge_graph_evidence_links
         ORDER BY created_at DESC",
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    let mut evidence_links = evidence_rows
        .iter()
        .map(|row| KnowledgeGraphEvidenceLink {
            id: row.get("id"),
            claim_id: row.get("claim_id"),
            source_kind: row.get("source_kind"),
            source_id: row.get("source_id"),
            relation_kind: row.get("relation_kind"),
            evidence_summary: row.get::<Option<String>, _>("evidence_summary").unwrap_or_default(),
            created_at: row.get("created_at"),
        })
        .collect::<Vec<_>>();

    let citation_rows = sqlx::query(
        "SELECT id, citing_paper_id, cited_paper_id, context, created_at
         FROM knowledge_paper_citations
         ORDER BY created_at DESC",
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    let mut citations = citation_rows
        .iter()
        .map(|row| KnowledgeGraphCitation {
            id: row.get("id"),
            citing_paper_id: row.get("citing_paper_id"),
            cited_paper_id: row.get("cited_paper_id"),
            context: row.get("context"),
            created_at: row.get("created_at"),
        })
        .collect::<Vec<_>>();

    let claim_ids = claims.iter().map(|item| item.id.clone()).collect::<HashSet<_>>();
    let paper_ids = papers.iter().map(|item| item.id.clone()).collect::<HashSet<_>>();
    let note_ids = notes.iter().map(|item| item.id.clone()).collect::<HashSet<_>>();
    let experiment_ids = experiments
        .iter()
        .map(|item| item.id.clone())
        .collect::<HashSet<_>>();

    evidence_links.retain(|item| {
        if !claim_ids.contains(&item.claim_id) {
            return false;
        }

        match item.source_kind.as_str() {
            "paper" => paper_ids.contains(&item.source_id),
            "note" => note_ids.contains(&item.source_id),
            "experiment" => experiment_ids.contains(&item.source_id),
            _ => false,
        }
    });

    citations.retain(|item| {
        paper_ids.contains(&item.citing_paper_id) && paper_ids.contains(&item.cited_paper_id)
    });

    Ok(KnowledgeGraphSnapshot {
        summary: KnowledgeGraphSummary {
            interest_count: interests.len(),
            paper_count: papers.len(),
            note_count: notes.len(),
            experiment_count: experiments.len(),
            claim_count: claims.len(),
            evidence_count: evidence_links.len(),
            citation_count: citations.len(),
        },
        interests,
        papers,
        notes,
        experiments,
        claims,
        evidence_links,
        citations,
    })
}

#[tauri::command]
pub async fn knowledge_graph_create_claim(
    state: State<'_, AppState>,
    title: String,
    statement: String,
    research_interest_id: Option<String>,
    status: Option<String>,
) -> Result<KnowledgeGraphClaim, String> {
    let trimmed_title = title.trim();
    let trimmed_statement = statement.trim();
    if trimmed_title.is_empty() {
        return Err("结论标题不能为空。".to_string());
    }
    if trimmed_statement.is_empty() {
        return Err("结论内容不能为空。".to_string());
    }

    let normalized_interest_id = normalize_optional_id(research_interest_id);
    if let Some(interest_id) = normalized_interest_id.as_deref() {
        let exists = sqlx::query("SELECT id FROM research_interests WHERE id = ?")
            .bind(interest_id)
            .fetch_optional(&state.db)
            .await
            .map_err(|e| e.to_string())?;
        if exists.is_none() {
            return Err("未找到对应研究方向。".to_string());
        }
    }

    let next_status = status.unwrap_or_else(|| "supported".to_string());
    validate_claim_status(&next_status)?;

    let id = Uuid::new_v4().to_string();
    let timestamp = now();
    sqlx::query(
        "INSERT INTO knowledge_graph_claims (id, title, statement, research_interest_id, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(trimmed_title)
    .bind(trimmed_statement)
    .bind(&normalized_interest_id)
    .bind(&next_status)
    .bind(&timestamp)
    .bind(&timestamp)
    .execute(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    Ok(KnowledgeGraphClaim {
        id,
        title: trimmed_title.to_string(),
        statement: trimmed_statement.to_string(),
        research_interest_id: normalized_interest_id,
        status: next_status,
        created_at: timestamp.clone(),
        updated_at: timestamp,
    })
}

#[tauri::command]
pub async fn knowledge_graph_delete_claim(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    sqlx::query("DELETE FROM knowledge_graph_claims WHERE id = ?")
        .bind(&id)
        .execute(&state.db)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn knowledge_graph_create_evidence(
    state: State<'_, AppState>,
    claim_id: String,
    source_kind: String,
    source_id: String,
    relation_kind: Option<String>,
    evidence_summary: Option<String>,
) -> Result<KnowledgeGraphEvidenceLink, String> {
    let normalized_source_kind = source_kind.trim().to_string();
    let normalized_source_id = source_id.trim().to_string();
    if normalized_source_id.is_empty() {
        return Err("证据来源不能为空。".to_string());
    }

    let claim_exists = sqlx::query("SELECT id FROM knowledge_graph_claims WHERE id = ?")
        .bind(&claim_id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| e.to_string())?;
    if claim_exists.is_none() {
        return Err("未找到对应结论。".to_string());
    }

    let next_relation_kind = relation_kind.unwrap_or_else(|| "supports".to_string());
    validate_relation_kind(&next_relation_kind)?;
    ensure_source_exists(&state.db, &normalized_source_kind, &normalized_source_id).await?;

    let id = Uuid::new_v4().to_string();
    let timestamp = now();
    let normalized_summary = evidence_summary.unwrap_or_default().trim().to_string();
    let insert_result = sqlx::query(
        "INSERT INTO knowledge_graph_evidence_links (id, claim_id, source_kind, source_id, relation_kind, evidence_summary, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&claim_id)
    .bind(&normalized_source_kind)
    .bind(&normalized_source_id)
    .bind(&next_relation_kind)
    .bind(&normalized_summary)
    .bind(&timestamp)
    .execute(&state.db)
    .await;

    if let Err(error) = insert_result {
        let message = error.to_string();
        if is_unique_violation(&message) {
            return Err("这条证据关系已经存在。".to_string());
        }
        return Err(message);
    }

    Ok(KnowledgeGraphEvidenceLink {
        id,
        claim_id,
        source_kind: normalized_source_kind,
        source_id: normalized_source_id,
        relation_kind: next_relation_kind,
        evidence_summary: normalized_summary,
        created_at: timestamp,
    })
}

#[tauri::command]
pub async fn knowledge_graph_delete_evidence(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    sqlx::query("DELETE FROM knowledge_graph_evidence_links WHERE id = ?")
        .bind(&id)
        .execute(&state.db)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn knowledge_graph_create_citation(
    state: State<'_, AppState>,
    citing_paper_id: String,
    cited_paper_id: String,
    context: Option<String>,
) -> Result<KnowledgeGraphCitation, String> {
    let citing = citing_paper_id.trim().to_string();
    let cited = cited_paper_id.trim().to_string();

    if citing.is_empty() || cited.is_empty() {
        return Err("引用关系必须同时选择引用方和被引用方论文。".to_string());
    }
    if citing == cited {
        return Err("同一篇论文不能引用自己。".to_string());
    }

    ensure_source_exists(&state.db, "paper", &citing).await?;
    ensure_source_exists(&state.db, "paper", &cited).await?;

    let id = Uuid::new_v4().to_string();
    let timestamp = now();
    let normalized_context = normalize_optional_id(context);
    let insert_result = sqlx::query(
        "INSERT INTO knowledge_paper_citations (id, citing_paper_id, cited_paper_id, context, created_at)
         VALUES (?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&citing)
    .bind(&cited)
    .bind(&normalized_context)
    .bind(&timestamp)
    .execute(&state.db)
    .await;

    if let Err(error) = insert_result {
        let message = error.to_string();
        if is_unique_violation(&message) {
            return Err("这条论文引用关系已经存在。".to_string());
        }
        return Err(message);
    }

    Ok(KnowledgeGraphCitation {
        id,
        citing_paper_id: citing,
        cited_paper_id: cited,
        context: normalized_context,
        created_at: timestamp,
    })
}

#[tauri::command]
pub async fn knowledge_graph_delete_citation(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    sqlx::query("DELETE FROM knowledge_paper_citations WHERE id = ?")
        .bind(&id)
        .execute(&state.db)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}
