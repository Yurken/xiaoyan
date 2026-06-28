use crate::llm::LlmClient;
use crate::rag::serialize_embedding;
use crate::services::memory_retrieval_service;
use crate::state::AppState;
use anyhow::Result as AnyhowResult;
use serde_json::{json, Value};
use sqlx::{Row, SqlitePool};
use std::collections::HashMap;
use tauri::State;
use uuid::Uuid;

/// 过程记忆（events/observations）的总量上限。超出后按「重要度升序、时间升序」
/// 裁掉最旧最不重要的；高重要度观察因此能保留更久。
const MAX_OBSERVATIONS: i64 = 5000;
/// 单批回填的 embedding 数量上限，避免一次 LLM 调用过大。
const EMBED_BACKFILL_BATCH: i64 = 64;

/// Safely truncate a UTF-8 string to at most `max_bytes` bytes,
/// never splitting a multi-byte character.
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

fn compact_text(value: &str) -> String {
    value.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn preview_text(value: &str, max_bytes: usize) -> String {
    let compact = compact_text(value);
    if compact.len() > max_bytes {
        format!("{}…", safe_truncate(&compact, max_bytes))
    } else {
        compact
    }
}

fn sqlite_now() -> String {
    chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string()
}

fn format_context_label(context_type: &str) -> &'static str {
    match context_type {
        "interest" => "研究方向会话",
        "paper" => "论文会话",
        _ => "通用会话",
    }
}

pub fn is_long_term_memory_enabled(settings: &HashMap<String, String>) -> bool {
    settings
        .get("xiaoyan_long_term_memory_enabled")
        .map(|value| value != "false")
        .unwrap_or(true)
}

async fn insert_memory_event_and_observation(
    db: &SqlitePool,
    session_id: Option<&str>,
    run_id: Option<&str>,
    source: &str,
    event_type: &str,
    event_summary: &str,
    payload: Value,
    observation_title: &str,
    observation_summary: &str,
    observation_narrative: &str,
    importance: i64,
) -> AnyhowResult<()> {
    // 写入去重：最近 24h 内已有相同 source+event_type+summary 的观察则跳过，
    // 避免「反复打开同一论文 / 重复提问」刷屏并撑爆检索预算。
    let duplicate: Option<String> = sqlx::query_scalar(
        "SELECT id FROM memory_observations
         WHERE source = ? AND event_type = ? AND summary = ?
           AND created_at >= datetime('now', '-1 day')
         LIMIT 1",
    )
    .bind(source)
    .bind(event_type)
    .bind(observation_summary)
    .fetch_optional(db)
    .await
    .unwrap_or(None);
    if duplicate.is_some() {
        return Ok(());
    }

    let event_id = Uuid::new_v4().to_string();
    let observation_id = Uuid::new_v4().to_string();
    let now = sqlite_now();
    let payload_json = serde_json::to_string(&payload)?;

    sqlx::query(
        "INSERT INTO memory_events (
            id, session_id, run_id, event_type, source, summary, payload_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&event_id)
    .bind(session_id)
    .bind(run_id)
    .bind(event_type)
    .bind(source)
    .bind(event_summary)
    .bind(payload_json)
    .bind(&now)
    .execute(db)
    .await?;

    sqlx::query(
        "INSERT INTO memory_observations (
            id, event_id, session_id, run_id, source, event_type, title, summary, narrative, importance, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&observation_id)
    .bind(&event_id)
    .bind(session_id)
    .bind(run_id)
    .bind(source)
    .bind(event_type)
    .bind(observation_title)
    .bind(observation_summary)
    .bind(observation_narrative)
    .bind(importance)
    .bind(&now)
    .execute(db)
    .await?;

    prune_memory_pipeline(db).await;

    Ok(())
}

/// 控制过程记忆膨胀：先删「低重要度且超 90 天」的，再在总量超上限时
/// 按「重要度升序、时间升序」裁掉最旧最不重要的。
///
/// 统一以删除 `memory_events` 为入口——`memory_observations.event_id` 与
/// `memory_links.observation_id` 均为 `ON DELETE CASCADE`，删事件会级联清掉
/// 对应观察与关联，避免悬挂。
async fn prune_memory_pipeline(db: &SqlitePool) {
    let _ = sqlx::query(
        "DELETE FROM memory_events WHERE id IN (
             SELECT event_id FROM memory_observations
             WHERE importance <= 1 AND created_at < datetime('now', '-90 days')
         )",
    )
    .execute(db)
    .await;

    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM memory_observations")
        .fetch_one(db)
        .await
        .unwrap_or(0);
    if count > MAX_OBSERVATIONS {
        let excess = count - MAX_OBSERVATIONS;
        let _ = sqlx::query(
            "DELETE FROM memory_events WHERE id IN (
                 SELECT event_id FROM memory_observations
                 ORDER BY importance ASC, created_at ASC
                 LIMIT ?
             )",
        )
        .bind(excess)
        .execute(db)
        .await;
    }
}

/// 后台回填观察的 embedding：取一批 `embedding IS NULL` 的观察，
/// 调用 embedding 模型生成向量并写回。返回本批写入的条数。
/// 未配置 embedding 客户端 / 调用失败时静默返回 0，不影响记忆其它功能。
pub async fn backfill_observation_embeddings(
    db: &SqlitePool,
    settings: &HashMap<String, String>,
) -> usize {
    let Ok(client) = LlmClient::embed_client_from_settings(settings) else {
        return 0;
    };

    let rows = sqlx::query(
        "SELECT id, title, summary, narrative FROM memory_observations
         WHERE embedding IS NULL
         ORDER BY created_at DESC
         LIMIT ?",
    )
    .bind(EMBED_BACKFILL_BATCH)
    .fetch_all(db)
    .await
    .unwrap_or_default();
    if rows.is_empty() {
        return 0;
    }

    let ids: Vec<String> = rows.iter().map(|row| row.get::<String, _>("id")).collect();
    let texts: Vec<String> = rows
        .iter()
        .map(|row| {
            format!(
                "{}\n{}\n{}",
                row.get::<String, _>("title"),
                row.get::<String, _>("summary"),
                row.get::<String, _>("narrative"),
            )
        })
        .collect();

    let Ok(vectors) = client.embed(&texts).await else {
        return 0;
    };
    if vectors.len() != ids.len() {
        return 0;
    }

    let mut written = 0usize;
    for (id, vector) in ids.iter().zip(vectors.iter()) {
        let serialized = serialize_embedding(vector);
        if sqlx::query("UPDATE memory_observations SET embedding = ? WHERE id = ?")
            .bind(&serialized)
            .bind(id)
            .execute(db)
            .await
            .is_ok()
        {
            written += 1;
        }
    }
    written
}

pub async fn record_chat_prompt_event(
    db: &SqlitePool,
    session_id: &str,
    context_type: &str,
    context_id: Option<&str>,
    message: &str,
) -> AnyhowResult<()> {
    let question_preview = preview_text(message, 140);
    let context_label = format_context_label(context_type);
    let event_summary = format!("用户在{context_label}中提出问题：{question_preview}");
    let observation_narrative =
        format!("用户在{context_label}中提出了一个新问题：{question_preview}");

    insert_memory_event_and_observation(
        db,
        Some(session_id),
        None,
        "chat",
        "chat.prompt.submitted",
        &event_summary,
        json!({
            "context_type": context_type,
            "context_id": context_id,
            "message": preview_text(message, 1000),
        }),
        "提出了新问题",
        &question_preview,
        &observation_narrative,
        1,
    )
    .await
}

pub async fn record_chat_completion_event(
    db: &SqlitePool,
    session_id: &str,
    context_type: &str,
    context_id: Option<&str>,
    user_message: &str,
    assistant_message: &str,
    source_count: usize,
) -> AnyhowResult<()> {
    let context_label = format_context_label(context_type);
    let question_preview = preview_text(user_message, 80);
    let answer_preview = preview_text(assistant_message, 180);
    let event_summary = format!("小妍完成了“{question_preview}”的答复");
    let observation_summary = format!("围绕“{question_preview}”给出答复：{answer_preview}");
    let observation_narrative = if source_count > 0 {
        format!(
            "小妍在{context_label}中完成了一次研究答复。问题：{question_preview}。回答摘要：{answer_preview}。引用来源数：{source_count}。"
        )
    } else {
        format!(
            "小妍在{context_label}中完成了一次研究答复。问题：{question_preview}。回答摘要：{answer_preview}。"
        )
    };

    insert_memory_event_and_observation(
        db,
        Some(session_id),
        None,
        "chat",
        "chat.answer.completed",
        &event_summary,
        json!({
            "context_type": context_type,
            "context_id": context_id,
            "user_message": preview_text(user_message, 1000),
            "assistant_message": preview_text(assistant_message, 2000),
            "source_count": source_count,
        }),
        "完成了一次研究答复",
        &observation_summary,
        &observation_narrative,
        if source_count > 0 { 3 } else { 2 },
    )
    .await
}

pub async fn record_chat_failure_event(
    db: &SqlitePool,
    session_id: &str,
    context_type: &str,
    context_id: Option<&str>,
    user_message: &str,
    error_message: &str,
) -> AnyhowResult<()> {
    let context_label = format_context_label(context_type);
    let question_preview = preview_text(user_message, 80);
    let error_preview = preview_text(error_message, 180);
    let event_summary = format!("小妍在回答“{question_preview}”时失败");
    let observation_summary = format!("围绕“{question_preview}”的答复失败：{error_preview}");
    let observation_narrative = format!(
        "小妍在{context_label}中尝试回答问题“{question_preview}”时失败。错误摘要：{error_preview}。"
    );

    insert_memory_event_and_observation(
        db,
        Some(session_id),
        None,
        "chat",
        "chat.answer.failed",
        &event_summary,
        json!({
            "context_type": context_type,
            "context_id": context_id,
            "user_message": preview_text(user_message, 1000),
            "error": preview_text(error_message, 1000),
        }),
        "一次答复失败",
        &observation_summary,
        &observation_narrative,
        2,
    )
    .await
}

pub async fn record_agent_run_completion_event(
    db: &SqlitePool,
    session_id: &str,
    run_id: &str,
    agent_name: &str,
    step_name: &str,
    summary: &str,
) -> AnyhowResult<()> {
    let summary_preview = preview_text(summary, 180);
    let event_summary = format!("{step_name} 完成：{summary_preview}");
    let observation_narrative = format!(
        "能力域模型 {agent_name} 已完成当前步骤。步骤名称：{step_name}。输出摘要：{summary_preview}。"
    );

    insert_memory_event_and_observation(
        db,
        Some(session_id),
        Some(run_id),
        "agent",
        "agent.run.completed",
        &event_summary,
        json!({
            "agent_name": agent_name,
            "step_name": step_name,
            "summary": preview_text(summary, 2000),
        }),
        &format!("{step_name} 已完成"),
        &summary_preview,
        &observation_narrative,
        2,
    )
    .await
}

pub async fn record_agent_run_failure_event(
    db: &SqlitePool,
    session_id: &str,
    run_id: &str,
    agent_name: &str,
    step_name: &str,
    error_message: &str,
) -> AnyhowResult<()> {
    let error_preview = preview_text(error_message, 180);
    let event_summary = format!("{step_name} 失败：{error_preview}");
    let observation_narrative =
        format!("能力域模型 {agent_name} 在步骤“{step_name}”中失败。错误摘要：{error_preview}。");

    insert_memory_event_and_observation(
        db,
        Some(session_id),
        Some(run_id),
        "agent",
        "agent.run.failed",
        &event_summary,
        json!({
            "agent_name": agent_name,
            "step_name": step_name,
            "error": preview_text(error_message, 1000),
        }),
        &format!("{step_name} 失败"),
        &error_preview,
        &observation_narrative,
        2,
    )
    .await
}

pub async fn record_knowledge_note_created_event(
    db: &SqlitePool,
    note_id: &str,
    title: &str,
    content: &str,
    research_interest_id: Option<&str>,
    source_type: &str,
) -> AnyhowResult<()> {
    let title_preview = preview_text(title, 80);
    let content_preview = preview_text(content, 160);
    let event_summary = format!("新增笔记：{title_preview}");
    let observation_narrative = format!(
        "新增了一条知识笔记。标题：{title_preview}。内容摘要：{content_preview}。来源：{source_type}。"
    );

    insert_memory_event_and_observation(
        db,
        None,
        None,
        "knowledge_note",
        "knowledge.note.created",
        &event_summary,
        json!({
            "note_id": note_id,
            "title": title,
            "content": preview_text(content, 2000),
            "research_interest_id": research_interest_id,
            "source_type": source_type,
        }),
        "新增了一条知识笔记",
        &format!("{title_preview}：{content_preview}"),
        &observation_narrative,
        2,
    )
    .await
}

pub async fn record_knowledge_note_updated_event(
    db: &SqlitePool,
    note_id: &str,
    title: &str,
    content: &str,
    research_interest_id: Option<&str>,
) -> AnyhowResult<()> {
    let title_preview = preview_text(title, 80);
    let content_preview = preview_text(content, 160);
    let event_summary = format!("更新笔记：{title_preview}");
    let observation_narrative =
        format!("更新了一条知识笔记。标题：{title_preview}。最新内容摘要：{content_preview}。");

    insert_memory_event_and_observation(
        db,
        None,
        None,
        "knowledge_note",
        "knowledge.note.updated",
        &event_summary,
        json!({
            "note_id": note_id,
            "title": title,
            "content": preview_text(content, 2000),
            "research_interest_id": research_interest_id,
        }),
        "更新了一条知识笔记",
        &format!("{title_preview}：{content_preview}"),
        &observation_narrative,
        2,
    )
    .await
}

pub async fn record_knowledge_note_moved_event(
    db: &SqlitePool,
    note_id: &str,
    title: &str,
    from_interest_id: Option<&str>,
    to_interest_id: Option<&str>,
) -> AnyhowResult<()> {
    let title_preview = preview_text(title, 80);
    let from_label = from_interest_id.unwrap_or("未归类");
    let to_label = to_interest_id.unwrap_or("未归类");
    let event_summary = format!("移动笔记：{title_preview}");
    let observation_narrative =
        format!("将知识笔记“{title_preview}”从 {from_label} 移动到 {to_label}。");

    insert_memory_event_and_observation(
        db,
        None,
        None,
        "knowledge_note",
        "knowledge.note.moved",
        &event_summary,
        json!({
            "note_id": note_id,
            "title": title,
            "from_interest_id": from_interest_id,
            "to_interest_id": to_interest_id,
        }),
        "移动了一条知识笔记",
        &format!("{title_preview}：{from_label} -> {to_label}"),
        &observation_narrative,
        2,
    )
    .await
}

pub async fn record_knowledge_note_deleted_event(
    db: &SqlitePool,
    note_id: &str,
    title: &str,
) -> AnyhowResult<()> {
    let title_preview = preview_text(title, 80);
    let event_summary = format!("删除笔记：{title_preview}");
    let observation_narrative = format!("删除了一条知识笔记：{title_preview}。");

    insert_memory_event_and_observation(
        db,
        None,
        None,
        "knowledge_note",
        "knowledge.note.deleted",
        &event_summary,
        json!({
            "note_id": note_id,
            "title": title,
        }),
        "删除了一条知识笔记",
        &title_preview,
        &observation_narrative,
        1,
    )
    .await
}

// ── Add ──────────────────────────────────────────────────────────

#[tauri::command]
pub async fn memory_add(
    state: State<'_, AppState>,
    r#type: String,
    action: Option<String>,
    summary: String,
    detail: Option<String>,
) -> Result<serde_json::Value, String> {
    let id = Uuid::new_v4().to_string();
    let now = sqlite_now();
    let mem_type = if r#type == "manual" { "manual" } else { "auto" };
    let settings = state.settings.read().await.clone();

    if mem_type == "auto" && !is_long_term_memory_enabled(&settings) {
        return Ok(json!({ "id": id, "skipped": true }));
    }

    sqlx::query(
        "INSERT INTO user_memories (id, type, action, summary, detail, created_at)
         VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(mem_type)
    .bind(&action)
    .bind(&summary)
    .bind(&detail)
    .bind(&now)
    .execute(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    let _ = sqlx::query(
        "DELETE FROM user_memories WHERE type = 'auto' AND id NOT IN (
             SELECT id FROM user_memories WHERE type = 'auto'
             ORDER BY created_at DESC LIMIT 1000
         )",
    )
    .execute(&state.db)
    .await;

    Ok(json!({ "id": id }))
}

// ── List ─────────────────────────────────────────────────────────

#[tauri::command]
pub async fn memory_list(
    state: State<'_, AppState>,
    mem_type: Option<String>,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<serde_json::Value, String> {
    let lim = limit.unwrap_or(50).min(200);
    let off = offset.unwrap_or(0);

    let rows = if let Some(t) = mem_type.as_deref() {
        sqlx::query(
            "SELECT id, type, action, summary, detail, created_at
             FROM user_memories WHERE type = ?
             ORDER BY created_at DESC LIMIT ? OFFSET ?",
        )
        .bind(t)
        .bind(lim)
        .bind(off)
        .fetch_all(&state.db)
        .await
        .map_err(|e| e.to_string())?
    } else {
        sqlx::query(
            "SELECT id, type, action, summary, detail, created_at
             FROM user_memories ORDER BY created_at DESC LIMIT ? OFFSET ?",
        )
        .bind(lim)
        .bind(off)
        .fetch_all(&state.db)
        .await
        .map_err(|e| e.to_string())?
    };

    let items: Vec<serde_json::Value> = rows
        .iter()
        .map(|row| {
            json!({
                "id": row.get::<String, _>("id"),
                "type": row.get::<String, _>("type"),
                "action": row.get::<Option<String>, _>("action"),
                "summary": row.get::<String, _>("summary"),
                "detail": row.get::<Option<String>, _>("detail"),
                "created_at": row.get::<String, _>("created_at"),
            })
        })
        .collect();

    Ok(json!(items))
}

#[tauri::command]
pub async fn memory_list_observations(
    state: State<'_, AppState>,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<serde_json::Value, String> {
    let lim = limit.unwrap_or(30).min(100);
    let off = offset.unwrap_or(0);

    let rows = sqlx::query(
        "SELECT id, event_id, session_id, run_id, source, event_type, title, summary, narrative, importance, created_at
         FROM memory_observations
         ORDER BY created_at DESC LIMIT ? OFFSET ?",
    )
    .bind(lim)
    .bind(off)
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    let items: Vec<serde_json::Value> = rows
        .iter()
        .map(|row| {
            json!({
                "id": row.get::<String, _>("id"),
                "event_id": row.get::<String, _>("event_id"),
                "session_id": row.get::<Option<String>, _>("session_id"),
                "run_id": row.get::<Option<String>, _>("run_id"),
                "source": row.get::<String, _>("source"),
                "event_type": row.get::<String, _>("event_type"),
                "title": row.get::<String, _>("title"),
                "summary": row.get::<String, _>("summary"),
                "narrative": row.get::<String, _>("narrative"),
                "importance": row.get::<i64, _>("importance"),
                "created_at": row.get::<String, _>("created_at"),
            })
        })
        .collect();

    Ok(json!(items))
}

#[tauri::command]
pub async fn memory_search_observations(
    state: State<'_, AppState>,
    query: String,
    limit: Option<i64>,
) -> Result<serde_json::Value, String> {
    let lim = limit.unwrap_or(6).clamp(1, 20) as usize;
    let settings = state.settings.read().await.clone();
    let query_embedding =
        crate::services::chat_context_service::embed_query(&settings, &query).await;
    let items = memory_retrieval_service::search_relevant_observations(
        &state.db,
        &query,
        query_embedding.as_deref(),
        lim,
    )
    .await;
    Ok(json!(items))
}

// ── Delete ────────────────────────────────────────────────────────

#[tauri::command]
pub async fn memory_delete(state: State<'_, AppState>, id: String) -> Result<(), String> {
    sqlx::query("DELETE FROM user_memories WHERE id = ?")
        .bind(&id)
        .execute(&state.db)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn memory_clear_auto(state: State<'_, AppState>) -> Result<(), String> {
    sqlx::query("DELETE FROM user_memories WHERE type = 'auto'")
        .execute(&state.db)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ── Build context ────────────────────────────────────────────────

pub async fn build_memory_context(db: &SqlitePool) -> String {
    memory_retrieval_service::build_memory_context(db).await
}

pub async fn build_memory_context_for_query(
    db: &SqlitePool,
    query: &str,
    query_embedding: Option<&[f32]>,
) -> String {
    memory_retrieval_service::build_memory_context_for_query(db, query, query_embedding).await
}

#[tauri::command]
pub async fn memory_build_context(state: State<'_, AppState>) -> Result<String, String> {
    Ok(build_memory_context(&state.db).await)
}
