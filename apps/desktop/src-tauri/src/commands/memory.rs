use crate::state::AppState;
use anyhow::Result as AnyhowResult;
use serde_json::{json, Value};
use sqlx::{Row, SqlitePool};
use std::collections::HashMap;
use tauri::State;
use uuid::Uuid;

const CONTEXT_BUDGET: usize = 4000;

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

fn format_short_timestamp(timestamp: &str) -> String {
    if timestamp.len() >= 16 {
        timestamp[5..16].to_string()
    } else {
        timestamp.to_string()
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

    Ok(())
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
    let observation_narrative = format!("用户在{context_label}中提出了一个新问题：{question_preview}");

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
    let manual_rows = sqlx::query(
        "SELECT summary FROM user_memories WHERE type = 'manual'
         ORDER BY created_at DESC LIMIT 10",
    )
    .fetch_all(db)
    .await
    .unwrap_or_default();

    let manual_lines: Vec<String> = manual_rows
        .iter()
        .map(|row| format!("• {}", row.get::<String, _>("summary")))
        .collect();

    let observation_rows = sqlx::query(
        "SELECT summary, created_at FROM memory_observations
         WHERE source = 'chat'
           AND event_type IN ('chat.answer.completed', 'chat.answer.failed')
           AND created_at >= datetime('now', '-3 days')
         ORDER BY importance DESC, created_at DESC LIMIT 6",
    )
    .fetch_all(db)
    .await
    .unwrap_or_default();

    let observation_lines: Vec<String> = observation_rows
        .iter()
        .map(|row| {
            let summary: String = row.get("summary");
            let created_at: String = row.get("created_at");
            format!("  {} {}", format_short_timestamp(&created_at), summary)
        })
        .collect();

    let recent_rows = sqlx::query(
        "SELECT summary, created_at FROM user_memories
         WHERE type = 'auto'
           AND created_at >= datetime('now', '-3 hours')
         ORDER BY created_at DESC LIMIT 20",
    )
    .fetch_all(db)
    .await
    .unwrap_or_default();

    let recent_lines: Vec<String> = recent_rows
        .iter()
        .map(|row| {
            let summary: String = row.get("summary");
            let created_at: String = row.get("created_at");
            let time = if created_at.len() >= 16 {
                created_at[11..16].to_string()
            } else {
                created_at
            };
            format!("  {time} {summary}")
        })
        .collect();

    let hist_rows = sqlx::query(
        "SELECT date(created_at) AS day, group_concat(summary, '；') AS summaries
         FROM user_memories
         WHERE type = 'auto'
           AND created_at < datetime('now', '-3 hours')
           AND created_at >= datetime('now', '-7 days')
         GROUP BY date(created_at)
         ORDER BY day DESC LIMIT 7",
    )
    .fetch_all(db)
    .await
    .unwrap_or_default();

    let hist_lines: Vec<String> = hist_rows
        .iter()
        .map(|row| {
            let day: String = row.get("day");
            let summaries: String = row.get("summaries");
            let truncated = if summaries.len() > 200 {
                format!("{}…", safe_truncate(&summaries, 200))
            } else {
                summaries
            };
            format!("  {day}: {truncated}")
        })
        .collect();

    if manual_lines.is_empty()
        && observation_lines.is_empty()
        && recent_lines.is_empty()
        && hist_lines.is_empty()
    {
        return String::new();
    }

    let mut parts: Vec<String> = Vec::new();

    if !manual_lines.is_empty() {
        parts.push(format!("[用户备忘]\n{}", manual_lines.join("\n")));
    }
    if !observation_lines.is_empty() {
        parts.push(format!("[近期过程记忆]\n{}", observation_lines.join("\n")));
    }
    if !recent_lines.is_empty() {
        parts.push(format!("[近期操作（最近3小时）]\n{}", recent_lines.join("\n")));
    }
    if !hist_lines.is_empty() {
        parts.push(format!("[历史摘要（近7天）]\n{}", hist_lines.join("\n")));
    }

    let result = parts.join("\n\n");
    if result.len() > CONTEXT_BUDGET {
        format!("{}…", safe_truncate(&result, CONTEXT_BUDGET))
    } else {
        result
    }
}

#[tauri::command]
pub async fn memory_build_context(state: State<'_, AppState>) -> Result<String, String> {
    Ok(build_memory_context(&state.db).await)
}
