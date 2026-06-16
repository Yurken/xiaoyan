use crate::state::AppState;
use serde_json::json;
use sqlx::Row;
use tauri::State;
use uuid::Uuid;

fn corpus_row_to_json(r: &sqlx::sqlite::SqliteRow) -> serde_json::Value {
    let tags_str: Option<String> = r.get::<Option<String>, _>("tags");
    let tags: serde_json::Value = tags_str
        .as_deref()
        .and_then(|s| serde_json::from_str(s).ok())
        .unwrap_or(serde_json::Value::Null);

    json!({
        "id": r.get::<String, _>("id"),
        "paper_id": r.get::<Option<String>, _>("paper_id"),
        "paper_title": r.get::<Option<String>, _>("paper_title"),
        "text": r.get::<String, _>("text"),
        "note": r.get::<String, _>("note"),
        "page": r.get::<Option<i64>, _>("page"),
        "tags": tags,
        "created_at": r.get::<String, _>("created_at"),
    })
}

const SELECT_SQL: &str = "SELECT c.id, c.paper_id, p.title AS paper_title, c.text, c.note, c.page, c.tags, c.created_at \
     FROM paper_corpus c LEFT JOIN papers p ON p.id = c.paper_id";

// ── List ──────────────────────────────────────────────────────

#[tauri::command]
pub async fn paper_corpus_list(
    state: State<'_, AppState>,
    paper_id: Option<String>,
) -> Result<serde_json::Value, String> {
    let rows = if let Some(pid) = paper_id {
        sqlx::query(&format!(
            "{SELECT_SQL} WHERE c.paper_id = ? ORDER BY c.created_at DESC"
        ))
        .bind(&pid)
        .fetch_all(&state.db)
        .await
    } else {
        sqlx::query(&format!("{SELECT_SQL} ORDER BY c.created_at DESC"))
            .fetch_all(&state.db)
            .await
    }
    .map_err(|e| e.to_string())?;

    Ok(json!(rows.iter().map(corpus_row_to_json).collect::<Vec<_>>()))
}

// ── Create ────────────────────────────────────────────────────

#[tauri::command]
pub async fn paper_corpus_create(
    state: State<'_, AppState>,
    paper_id: Option<String>,
    text: String,
    note: Option<String>,
    page: Option<i64>,
    tags: Option<serde_json::Value>,
) -> Result<serde_json::Value, String> {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return Err("语料内容不能为空。".into());
    }
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let note_value = note.unwrap_or_default();
    let tags_json = tags
        .as_ref()
        .map(|v| serde_json::to_string(v).unwrap_or_default());

    sqlx::query(
        "INSERT INTO paper_corpus (id, paper_id, text, note, page, tags, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&paper_id)
    .bind(trimmed)
    .bind(&note_value)
    .bind(page)
    .bind(&tags_json)
    .bind(&now)
    .execute(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    let row = sqlx::query(&format!("{SELECT_SQL} WHERE c.id = ?"))
        .bind(&id)
        .fetch_one(&state.db)
        .await
        .map_err(|e| e.to_string())?;

    Ok(corpus_row_to_json(&row))
}

// ── Update note ───────────────────────────────────────────────

#[tauri::command]
pub async fn paper_corpus_update(
    state: State<'_, AppState>,
    id: String,
    note: Option<String>,
) -> Result<serde_json::Value, String> {
    if let Some(next_note) = &note {
        sqlx::query("UPDATE paper_corpus SET note = ? WHERE id = ?")
            .bind(next_note)
            .bind(&id)
            .execute(&state.db)
            .await
            .map_err(|e| e.to_string())?;
    }

    let row = sqlx::query(&format!("{SELECT_SQL} WHERE c.id = ?"))
        .bind(&id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("未找到对应语料。")?;

    Ok(corpus_row_to_json(&row))
}

// ── Delete ────────────────────────────────────────────────────

#[tauri::command]
pub async fn paper_corpus_delete(state: State<'_, AppState>, id: String) -> Result<(), String> {
    sqlx::query("DELETE FROM paper_corpus WHERE id = ?")
        .bind(&id)
        .execute(&state.db)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}
