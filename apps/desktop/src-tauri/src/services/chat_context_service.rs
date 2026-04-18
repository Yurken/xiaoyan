use crate::{
    commands::{knowledge::ResearchInterestProfilePayload, memory},
    graph_rag::collect_graph_rag_sources,
    llm::LlmClient,
    rag::combined_search,
};
use serde_json::{json, Value};
use sqlx::{Row, SqlitePool};
use std::collections::HashMap;

pub async fn build_chat_context_summary(
    db: &SqlitePool,
    context_type: &str,
    context_id: &Option<String>,
    include_long_term_memory: bool,
) -> String {
    let base_context = match context_type {
        "interest" => interest_context_summary(db, context_id).await,
        "paper" => paper_context_summary(db, context_id).await,
        _ => String::new(),
    };

    let memory_context = if include_long_term_memory {
        memory::build_memory_context(db).await
    } else {
        String::new()
    };

    if memory_context.is_empty() {
        base_context
    } else if base_context.is_empty() {
        format!("【用户记忆与近期操作】\n{memory_context}")
    } else {
        format!("{base_context}\n\n【用户记忆与近期操作】\n{memory_context}")
    }
}

pub async fn collect_chat_sources(
    db: &SqlitePool,
    settings: &HashMap<String, String>,
    message: &str,
) -> Vec<Value> {
    let embed_client = match LlmClient::embed_client_from_settings(settings) {
        Ok(client) => client,
        Err(_) => return Vec::new(),
    };

    let embeddings = match embed_client.embed(&[message.to_string()]).await {
        Ok(value) => value,
        Err(_) => return Vec::new(),
    };

    let embedding = match embeddings.into_iter().next() {
        Some(value) => value,
        None => return Vec::new(),
    };

    let top_k = settings
        .get("rag_top_k")
        .and_then(|value| value.parse().ok())
        .unwrap_or(5);
    let results = match combined_search(db, &embedding, top_k).await {
        Ok(value) => value,
        Err(_) => return Vec::new(),
    };

    let mut merged = results
        .into_iter()
        .map(|item| json!({ "content": item.content, "source": item.source, "url": item.url }))
        .collect::<Vec<_>>();

    if let Ok(graph_sources) = collect_graph_rag_sources(db, &embedding, top_k).await {
        merged.extend(graph_sources);
    }

    merged
}

async fn paper_context_summary(db: &SqlitePool, context_id: &Option<String>) -> String {
    let Some(paper_id) = context_id.as_deref() else {
        return String::new();
    };

    let row = match sqlx::query("SELECT title, abstract, status FROM papers WHERE id = ?")
        .bind(paper_id)
        .fetch_optional(db)
        .await
    {
        Ok(Some(row)) => row,
        _ => return String::new(),
    };

    let mut lines = vec![format!("当前论文：{}", row.get::<String, _>("title"))];

    if let Some(status) = row.get::<Option<String>, _>("status") {
        lines.push(format!("论文状态：{}", status));
    }
    if let Some(abstract_text) = row.get::<Option<String>, _>("abstract") {
        let preview = if abstract_text.chars().count() > 240 {
            abstract_text.chars().take(240).collect::<String>() + "…"
        } else {
            abstract_text
        };
        lines.push(format!("摘要：{}", preview));
    }

    lines.join("\n")
}

async fn interest_context_summary(db: &SqlitePool, context_id: &Option<String>) -> String {
    let Some(interest_id) = context_id.as_deref() else {
        return String::new();
    };

    let row = match sqlx::query(
        "SELECT topic, keywords, profile, learning_path FROM research_interests WHERE id = ?",
    )
    .bind(interest_id)
    .fetch_optional(db)
    .await
    {
        Ok(Some(row)) => row,
        _ => return String::new(),
    };

    let topic: String = row.get("topic");
    let keywords_str: String = row
        .get::<Option<String>, _>("keywords")
        .unwrap_or_else(|| "[]".into());
    let keywords: Vec<String> = serde_json::from_str(&keywords_str).unwrap_or_default();
    let profile = row
        .get::<Option<String>, _>("profile")
        .and_then(|value| serde_json::from_str::<ResearchInterestProfilePayload>(&value).ok())
        .unwrap_or_default();
    let learning_path = row
        .get::<Option<String>, _>("learning_path")
        .and_then(|value| serde_json::from_str::<Value>(&value).ok())
        .unwrap_or_default();

    let mut lines = vec![format!("当前研究方向：{}", topic)];
    if !keywords.is_empty() {
        lines.push(format!("关键词：{}", keywords.join("、")));
    }
    if let Some(goal) = profile.goal.as_deref().filter(|value| !value.trim().is_empty()) {
        lines.push(format!("研究目标：{}", goal));
    }
    if let Some(background) = profile
        .background
        .as_deref()
        .filter(|value| !value.trim().is_empty())
    {
        lines.push(format!("当前基础：{}", background));
    }
    if let Some(time_budget) = profile
        .time_budget
        .as_deref()
        .filter(|value| !value.trim().is_empty())
    {
        lines.push(format!("时间预算：{}", time_budget));
    }
    if let Some(preferred_output) = profile
        .preferred_output
        .as_deref()
        .filter(|value| !value.trim().is_empty())
    {
        lines.push(format!("期望输出：{}", preferred_output));
    }
    if let Some(known_context) = profile
        .known_context
        .as_deref()
        .filter(|value| !value.trim().is_empty())
    {
        lines.push(format!("已知论文/方法：{}", known_context));
    }
    if let Some(constraints) = profile.constraints.as_ref().filter(|value| !value.is_empty()) {
        lines.push(format!("约束条件：{}", constraints.join("、")));
    }

    let stage_titles = learning_path
        .get("learning_stages")
        .and_then(|value| value.as_array())
        .map(|items| {
            items
                .iter()
                .filter_map(|item| item.get("title").and_then(|value| value.as_str()))
                .take(4)
                .map(ToString::to_string)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    if !stage_titles.is_empty() {
        lines.push(format!("当前路线阶段：{}", stage_titles.join(" -> ")));
    }

    let paper_rows = sqlx::query(
        "SELECT title, status FROM papers WHERE research_interest_id = ? ORDER BY updated_at DESC LIMIT 5",
    )
    .bind(interest_id)
    .fetch_all(db)
    .await
    .unwrap_or_default();
    if !paper_rows.is_empty() {
        let related_papers = paper_rows
            .iter()
            .map(|item| {
                let title: String = item.get("title");
                let status: Option<String> = item.get("status");
                format!(
                    "{}{}",
                    title,
                    status
                        .map(|value| format!("（{}）", value))
                        .unwrap_or_default()
                )
            })
            .collect::<Vec<_>>();
        lines.push(format!("已关联论文：{}", related_papers.join("；")));
    }

    let note_rows = sqlx::query(
        "SELECT title FROM knowledge_notes WHERE research_interest_id = ? ORDER BY updated_at DESC LIMIT 5",
    )
    .bind(interest_id)
    .fetch_all(db)
    .await
    .unwrap_or_default();
    if !note_rows.is_empty() {
        let note_titles = note_rows
            .iter()
            .map(|item| item.get::<String, _>("title"))
            .collect::<Vec<_>>();
        lines.push(format!("已沉淀笔记：{}", note_titles.join("；")));
    }

    lines.join("\n")
}
