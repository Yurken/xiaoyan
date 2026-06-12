use crate::commands::memory::{
    is_long_term_memory_enabled, record_knowledge_note_created_event,
    record_knowledge_note_deleted_event, record_knowledge_note_moved_event,
    record_knowledge_note_updated_event,
};
use crate::llm::LlmClient;
use crate::rag::{combined_search, serialize_embedding};
use crate::state::AppState;
use serde_json::json;
use sqlx::Row;
use tauri::State;
use uuid::Uuid;

fn note_embedding_text(title: &str, content: &str) -> String {
    format!("{title} {content}")
}

fn spawn_note_embedding_refresh(
    db: sqlx::SqlitePool,
    settings: std::collections::HashMap<String, String>,
    note_id: String,
    title: String,
    content: String,
) {
    let text = note_embedding_text(&title, &content);
    tokio::spawn(async move {
        if let Ok(client) = LlmClient::embed_client_from_settings(&settings) {
            if let Ok(embeddings) = client.embed(&[text]).await {
                if let Some(embedding) = embeddings.into_iter().next() {
                    let emb_str = serialize_embedding(&embedding);
                    let _ = sqlx::query("UPDATE knowledge_notes SET embedding = ? WHERE id = ?")
                        .bind(&emb_str)
                        .bind(&note_id)
                        .execute(&db)
                        .await;
                }
            }
        }
    });
}

pub fn note_row_to_json(r: &sqlx::sqlite::SqliteRow) -> serde_json::Value {
    let tags_str: String = r
        .get::<Option<String>, _>("tags")
        .unwrap_or_else(|| "[]".into());
    json!({
        "id": r.get::<String, _>("id"),
        "title": r.get::<String, _>("title"),
        "content": r.get::<String, _>("content"),
        "source_type": r.get::<String, _>("source_type"),
        "source_id": r.get::<Option<String>, _>("source_id"),
        "tags": serde_json::from_str::<serde_json::Value>(&tags_str).unwrap_or(json!([])),
        "research_interest_id": r.get::<Option<String>, _>("research_interest_id"),
        "created_at": r.get::<String, _>("created_at"),
        "updated_at": r.get::<String, _>("updated_at"),
    })
}

#[tauri::command]
pub async fn knowledge_list_notes(
    state: State<'_, AppState>,
    search: Option<String>,
) -> Result<serde_json::Value, String> {
    if let Some(q) = search.filter(|value| !value.is_empty()) {
        let settings = state.settings.read().await.clone();
        if let Ok(client) = LlmClient::embed_client_from_settings(&settings) {
            if let Ok(embeddings) = client.embed(&[q.clone()]).await {
                if let Some(embedding) = embeddings.into_iter().next() {
                    let top_k: usize = settings
                        .get("rag_top_k")
                        .and_then(|value| value.parse().ok())
                        .unwrap_or(10);
                    let results = crate::rag::search_knowledge_notes(&state.db, &embedding, top_k)
                        .await
                        .map_err(|e| e.to_string())?;
                    let mut notes = Vec::new();
                    for result in results {
                        if let Ok(Some(row)) = sqlx::query(
                            "SELECT id, title, content, source_type, source_id, tags, research_interest_id, created_at, updated_at FROM knowledge_notes WHERE id = ?",
                        )
                        .bind(&result.id)
                        .fetch_optional(&state.db)
                        .await
                        {
                            notes.push(note_row_to_json(&row));
                        }
                    }
                    return Ok(json!(notes));
                }
            }
        }

        let like = format!("%{q}%");
        let rows = sqlx::query(
            "SELECT id, title, content, source_type, source_id, tags, research_interest_id, created_at, updated_at
             FROM knowledge_notes WHERE title LIKE ? OR content LIKE ? ORDER BY created_at DESC LIMIT 20",
        )
        .bind(&like)
        .bind(&like)
        .fetch_all(&state.db)
        .await
        .map_err(|e| e.to_string())?;
        return Ok(json!(rows.iter().map(note_row_to_json).collect::<Vec<_>>()));
    }

    let rows = sqlx::query(
        "SELECT id, title, content, source_type, source_id, tags, research_interest_id, created_at, updated_at
         FROM knowledge_notes ORDER BY created_at DESC",
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;
    Ok(json!(rows.iter().map(note_row_to_json).collect::<Vec<_>>()))
}

#[tauri::command]
pub async fn create_note_core(
    db: &sqlx::SqlitePool,
    settings: &std::collections::HashMap<String, String>,
    title: String,
    content: String,
    tags: Option<Vec<String>>,
    research_interest_id: Option<String>,
    source_type: &str,
) -> Result<serde_json::Value, String> {
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let next_tags = tags.unwrap_or_default();
    let tags_json = serde_json::to_string(&next_tags).unwrap_or_else(|_| "[]".into());

    sqlx::query(
        "INSERT INTO knowledge_notes (id, title, content, tags, research_interest_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&title)
    .bind(&content)
    .bind(&tags_json)
    .bind(&research_interest_id)
    .bind(&now)
    .bind(&now)
    .execute(db)
    .await
    .map_err(|e| e.to_string())?;

    spawn_note_embedding_refresh(
        db.clone(),
        settings.clone(),
        id.clone(),
        title.clone(),
        content.clone(),
    );

    if is_long_term_memory_enabled(settings) {
        let _ = record_knowledge_note_created_event(
            db,
            &id,
            &title,
            &content,
            research_interest_id.as_deref(),
            source_type,
        )
        .await;
    }

    Ok(json!({
        "id": id,
        "title": title,
        "content": content,
        "source_type": source_type,
        "source_id": serde_json::Value::Null,
        "tags": next_tags,
        "research_interest_id": research_interest_id,
        "created_at": now,
        "updated_at": now
    }))
}

#[tauri::command]
pub async fn knowledge_create_note(
    state: State<'_, AppState>,
    title: String,
    content: String,
    tags: Option<Vec<String>>,
    research_interest_id: Option<String>,
) -> Result<serde_json::Value, String> {
    let settings = state.settings.read().await.clone();
    create_note_core(
        &state.db,
        &settings,
        title,
        content,
        tags,
        research_interest_id,
        "manual",
    )
    .await
}

#[tauri::command]
pub async fn knowledge_update_note(
    state: State<'_, AppState>,
    id: String,
    title: Option<String>,
    content: Option<String>,
    tags: Option<Vec<String>>,
) -> Result<serde_json::Value, String> {
    let existing = sqlx::query(
        "SELECT id, title, content, source_type, source_id, tags, research_interest_id, created_at, updated_at FROM knowledge_notes WHERE id = ?",
    )
    .bind(&id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| e.to_string())?
    .ok_or("未找到对应笔记。")?;

    let now = chrono::Utc::now().to_rfc3339();
    if let Some(next_title) = &title {
        sqlx::query("UPDATE knowledge_notes SET title = ?, updated_at = ? WHERE id = ?")
            .bind(next_title)
            .bind(&now)
            .bind(&id)
            .execute(&state.db)
            .await
            .map_err(|e| e.to_string())?;
    }
    if let Some(next_content) = &content {
        sqlx::query("UPDATE knowledge_notes SET content = ?, updated_at = ? WHERE id = ?")
            .bind(next_content)
            .bind(&now)
            .bind(&id)
            .execute(&state.db)
            .await
            .map_err(|e| e.to_string())?;
    }
    if let Some(next_tags) = &tags {
        let tags_json = serde_json::to_string(next_tags).unwrap_or_else(|_| "[]".into());
        sqlx::query("UPDATE knowledge_notes SET tags = ?, updated_at = ? WHERE id = ?")
            .bind(&tags_json)
            .bind(&now)
            .bind(&id)
            .execute(&state.db)
            .await
            .map_err(|e| e.to_string())?;
    }

    let row = sqlx::query(
        "SELECT id, title, content, source_type, source_id, tags, research_interest_id, created_at, updated_at FROM knowledge_notes WHERE id = ?",
    )
    .bind(&id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| e.to_string())?
    .ok_or("未找到对应笔记。")?;

    let final_title = row.get::<String, _>("title");
    let final_content = row.get::<String, _>("content");
    let final_interest_id = row.get::<Option<String>, _>("research_interest_id");
    let settings = state.settings.read().await.clone();

    let title_changed = title.is_some() && final_title != existing.get::<String, _>("title");
    let content_changed =
        content.is_some() && final_content != existing.get::<String, _>("content");
    if title_changed || content_changed {
        spawn_note_embedding_refresh(
            state.db.clone(),
            settings.clone(),
            id.clone(),
            final_title.clone(),
            final_content.clone(),
        );
    }

    if is_long_term_memory_enabled(&settings) {
        let _ = record_knowledge_note_updated_event(
            &state.db,
            &id,
            &final_title,
            &final_content,
            final_interest_id.as_deref(),
        )
        .await;
    }

    Ok(note_row_to_json(&row))
}

#[tauri::command]
pub async fn knowledge_move_note(
    state: State<'_, AppState>,
    id: String,
    research_interest_id: Option<String>,
) -> Result<serde_json::Value, String> {
    let existing = sqlx::query(
        "SELECT id, title, content, source_type, source_id, tags, research_interest_id, created_at, updated_at FROM knowledge_notes WHERE id = ?",
    )
    .bind(&id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| e.to_string())?
    .ok_or("未找到对应笔记。")?;

    let now = chrono::Utc::now().to_rfc3339();
    let normalized_interest_id = research_interest_id.and_then(|value| {
        let trimmed = value.trim().to_string();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    });

    sqlx::query("UPDATE knowledge_notes SET research_interest_id = ?, updated_at = ? WHERE id = ?")
        .bind(&normalized_interest_id)
        .bind(&now)
        .bind(&id)
        .execute(&state.db)
        .await
        .map_err(|e| e.to_string())?;

    let row = sqlx::query(
        "SELECT id, title, content, source_type, source_id, tags, research_interest_id, created_at, updated_at FROM knowledge_notes WHERE id = ?",
    )
    .bind(&id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| e.to_string())?
    .ok_or("未找到对应笔记。")?;

    let settings = state.settings.read().await.clone();
    if is_long_term_memory_enabled(&settings) {
        let _ = record_knowledge_note_moved_event(
            &state.db,
            &id,
            &row.get::<String, _>("title"),
            existing
                .get::<Option<String>, _>("research_interest_id")
                .as_deref(),
            normalized_interest_id.as_deref(),
        )
        .await;
    }

    Ok(note_row_to_json(&row))
}

#[tauri::command]
pub async fn knowledge_delete_note(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let existing = sqlx::query("SELECT title FROM knowledge_notes WHERE id = ?")
        .bind(&id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("未找到对应笔记。")?;

    let title = existing.get::<String, _>("title");
    sqlx::query("DELETE FROM knowledge_notes WHERE id = ?")
        .bind(&id)
        .execute(&state.db)
        .await
        .map_err(|e| e.to_string())?;

    let settings = state.settings.read().await.clone();
    if is_long_term_memory_enabled(&settings) {
        let _ = record_knowledge_note_deleted_event(&state.db, &id, &title).await;
    }

    Ok(())
}

#[tauri::command]
pub async fn knowledge_search(
    state: State<'_, AppState>,
    q: String,
    top_k: Option<i64>,
) -> Result<serde_json::Value, String> {
    let top_k = top_k.unwrap_or(5) as usize;
    let settings = state.settings.read().await.clone();
    let client = match LlmClient::embed_client_from_settings(&settings) {
        Ok(client) => client,
        Err(_) => return Ok(json!([])),
    };
    let embeddings = match client.embed(&[q]).await {
        Ok(value) => value,
        Err(_) => return Ok(json!([])),
    };
    let embedding = match embeddings.into_iter().next() {
        Some(value) => value,
        None => return Ok(json!([])),
    };
    let results = combined_search(&state.db, &embedding, top_k)
        .await
        .map_err(|e| e.to_string())?;
    Ok(json!(results
        .into_iter()
        .map(|result| json!({
            "id": result.id,
            "content": result.content,
            "source": result.source,
            "score": result.score
        }))
        .collect::<Vec<_>>()))
}
