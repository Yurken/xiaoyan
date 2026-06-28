use crate::state::AppState;
use serde_json::json;
use sqlx::Row;
use tauri::State;
use uuid::Uuid;

fn note_row_to_json(r: &sqlx::sqlite::SqliteRow) -> serde_json::Value {
    let positions_str: Option<String> = r.get::<Option<String>, _>("highlight_positions");
    let positions: serde_json::Value = positions_str
        .as_deref()
        .and_then(|s| serde_json::from_str(s).ok())
        .unwrap_or(serde_json::Value::Null);

    json!({
        "id": r.get::<String, _>("id"),
        "paper_id": r.get::<String, _>("paper_id"),
        "page": r.get::<i64, _>("page"),
        "content": r.get::<String, _>("content"),
        "highlight_text": r.get::<Option<String>, _>("highlight_text"),
        "highlight_color": r.get::<String, _>("highlight_color"),
        "highlight_positions": positions,
        "style": r.get::<String, _>("style"),
        "fill_color": r.get::<Option<String>, _>("fill_color"),
        "created_at": r.get::<String, _>("created_at"),
        "updated_at": r.get::<String, _>("updated_at"),
    })
}

const SELECT_COLS: &str =
    "id, paper_id, page, content, highlight_text, highlight_color, highlight_positions, style, fill_color, created_at, updated_at";

// ── List ──────────────────────────────────────────────────────

#[tauri::command]
pub async fn paper_notes_list(
    state: State<'_, AppState>,
    paper_id: String,
) -> Result<serde_json::Value, String> {
    let rows = sqlx::query(&format!(
        "SELECT {SELECT_COLS} FROM paper_notes WHERE paper_id = ? ORDER BY page ASC, created_at ASC"
    ))
    .bind(&paper_id)
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    Ok(json!(rows.iter().map(note_row_to_json).collect::<Vec<_>>()))
}

// ── Create ────────────────────────────────────────────────────

#[tauri::command]
pub async fn paper_notes_create(
    state: State<'_, AppState>,
    paper_id: String,
    page: i64,
    content: String,
    highlight_text: Option<String>,
    highlight_color: Option<String>,
    highlight_positions: Option<serde_json::Value>,
    style: Option<String>,
    fill_color: Option<String>,
) -> Result<serde_json::Value, String> {
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let color = highlight_color.unwrap_or_else(|| "yellow".into());
    let annotation_style = style.unwrap_or_else(|| "highlight".into());
    let fill = fill_color.unwrap_or_else(|| "none".into());
    let positions_json = highlight_positions
        .as_ref()
        .map(|v| serde_json::to_string(v).unwrap_or_default());

    sqlx::query(
        "INSERT INTO paper_notes (id, paper_id, page, content, highlight_text, highlight_color, highlight_positions, style, fill_color, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&paper_id)
    .bind(page)
    .bind(&content)
    .bind(&highlight_text)
    .bind(&color)
    .bind(&positions_json)
    .bind(&annotation_style)
    .bind(&fill)
    .bind(&now)
    .bind(&now)
    .execute(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    Ok(json!({
        "id": id,
        "paper_id": paper_id,
        "page": page,
        "content": content,
        "highlight_text": highlight_text,
        "highlight_color": color,
        "highlight_positions": highlight_positions,
        "style": annotation_style,
        "fill_color": fill,
        "created_at": now,
        "updated_at": now,
    }))
}

// ── Update ────────────────────────────────────────────────────

#[tauri::command]
pub async fn paper_notes_update(
    state: State<'_, AppState>,
    id: String,
    content: Option<String>,
    highlight_color: Option<String>,
    highlight_positions: Option<serde_json::Value>,
    fill_color: Option<String>,
) -> Result<serde_json::Value, String> {
    // Verify existence
    sqlx::query("SELECT id FROM paper_notes WHERE id = ?")
        .bind(&id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("未找到对应笔记。")?;

    let now = chrono::Utc::now().to_rfc3339();

    if let Some(next_content) = &content {
        sqlx::query("UPDATE paper_notes SET content = ?, updated_at = ? WHERE id = ?")
            .bind(next_content)
            .bind(&now)
            .bind(&id)
            .execute(&state.db)
            .await
            .map_err(|e| e.to_string())?;
    }
    if let Some(next_color) = &highlight_color {
        sqlx::query("UPDATE paper_notes SET highlight_color = ?, updated_at = ? WHERE id = ?")
            .bind(next_color)
            .bind(&now)
            .bind(&id)
            .execute(&state.db)
            .await
            .map_err(|e| e.to_string())?;
    }
    if let Some(next_positions) = &highlight_positions {
        let positions_json = serde_json::to_string(next_positions).unwrap_or_default();
        sqlx::query("UPDATE paper_notes SET highlight_positions = ?, updated_at = ? WHERE id = ?")
            .bind(&positions_json)
            .bind(&now)
            .bind(&id)
            .execute(&state.db)
            .await
            .map_err(|e| e.to_string())?;
    }
    if let Some(next_fill) = &fill_color {
        sqlx::query("UPDATE paper_notes SET fill_color = ?, updated_at = ? WHERE id = ?")
            .bind(next_fill)
            .bind(&now)
            .bind(&id)
            .execute(&state.db)
            .await
            .map_err(|e| e.to_string())?;
    }

    let row = sqlx::query(&format!(
        "SELECT {SELECT_COLS} FROM paper_notes WHERE id = ?"
    ))
    .bind(&id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| e.to_string())?
    .ok_or("未找到对应笔记。")?;

    Ok(note_row_to_json(&row))
}

// ── Delete ────────────────────────────────────────────────────

#[tauri::command]
pub async fn paper_notes_delete(state: State<'_, AppState>, id: String) -> Result<(), String> {
    sqlx::query("SELECT id FROM paper_notes WHERE id = ?")
        .bind(&id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("未找到对应笔记。")?;

    sqlx::query("DELETE FROM paper_notes WHERE id = ?")
        .bind(&id)
        .execute(&state.db)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}
