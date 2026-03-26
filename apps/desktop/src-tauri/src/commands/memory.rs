use crate::state::AppState;
use serde_json::json;
use sqlx::Row;
use tauri::State;
use uuid::Uuid;

/// Safely truncate a UTF-8 string to at most `max_bytes` bytes,
/// never splitting a multi-byte character.
fn safe_truncate(s: &str, max_bytes: usize) -> &str {
    if s.len() <= max_bytes {
        return s;
    }
    // Walk back from max_bytes until we hit a valid char boundary
    let mut end = max_bytes;
    while end > 0 && !s.is_char_boundary(end) {
        end -= 1;
    }
    &s[..end]
}

// ── Add ──────────────────────────────────────────────────────────

#[tauri::command]
pub async fn memory_add(
    state: State<'_, AppState>,
    r#type: String,          // "auto" | "manual"
    action: Option<String>,  // e.g. "paper.analyze"
    summary: String,
    detail: Option<String>,  // JSON metadata
) -> Result<serde_json::Value, String> {
    let id = Uuid::new_v4().to_string();
    // Use SQLite-compatible UTC format so datetime() comparisons in queries work correctly
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let mem_type = if r#type == "manual" { "manual" } else { "auto" };

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

    // Auto-prune: keep at most 1000 auto entries
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
    mem_type: Option<String>, // None = all, "auto" | "manual"
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
        .map(|r| {
            json!({
                "id": r.get::<String, _>("id"),
                "type": r.get::<String, _>("type"),
                "action": r.get::<Option<String>, _>("action"),
                "summary": r.get::<String, _>("summary"),
                "detail": r.get::<Option<String>, _>("detail"),
                "created_at": r.get::<String, _>("created_at"),
            })
        })
        .collect();

    Ok(json!(items))
}

// ── Delete ────────────────────────────────────────────────────────

#[tauri::command]
pub async fn memory_delete(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    sqlx::query("DELETE FROM user_memories WHERE id = ?")
        .bind(&id)
        .execute(&state.db)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn memory_clear_auto(
    state: State<'_, AppState>,
) -> Result<(), String> {
    sqlx::query("DELETE FROM user_memories WHERE type = 'auto'")
        .execute(&state.db)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ── Build context (三层压缩) ─────────────────────────────────────

/// Build a compressed memory context string to inject into the AI system prompt.
///
/// Layer 1 (top):  manual notes – up to 10, always included
/// Layer 2 (mid):  auto entries from the last 3 hours, verbatim, up to 20
/// Layer 3 (base): auto entries from 3h-7d ago, grouped by day, up to 7 days
///
/// Total budget: ≤ ~1000 tokens (estimated at 4 chars/token → ~4000 chars).
pub async fn build_memory_context(db: &sqlx::SqlitePool) -> String {
    const BUDGET: usize = 4000;

    // ── Layer 1: Manual notes (newest first, max 10) ──────────────
    let manual_rows = sqlx::query(
        "SELECT summary FROM user_memories WHERE type = 'manual'
         ORDER BY created_at DESC LIMIT 10",
    )
    .fetch_all(db)
    .await
    .unwrap_or_default();

    let manual_lines: Vec<String> = manual_rows
        .iter()
        .map(|r| format!("• {}", r.get::<String, _>("summary")))
        .collect();

    // ── Layer 2: Recent auto (last 3h, verbatim, max 20) ──────────
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
        .map(|r| {
            let ts: String = r.get("created_at");
            let time = &ts[11..16]; // HH:MM
            let summary: String = r.get("summary");
            format!("  {time} {summary}")
        })
        .collect();

    // ── Layer 3: Historical daily summaries (3h-7d, max 7 days) ───
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
        .map(|r| {
            let day: String = r.get("day");
            let summaries: String = r.get("summaries");
            // Truncate each day summary to 200 chars to stay in budget
            let truncated = if summaries.len() > 200 {
                format!("{}…", safe_truncate(&summaries, 200))
            } else {
                summaries
            };
            format!("  {day}: {truncated}")
        })
        .collect();

    // ── Assemble ──────────────────────────────────────────────────
    if manual_lines.is_empty() && recent_lines.is_empty() && hist_lines.is_empty() {
        return String::new();
    }

    let mut parts: Vec<String> = Vec::new();

    if !manual_lines.is_empty() {
        parts.push(format!("[用户备忘]\n{}", manual_lines.join("\n")));
    }
    if !recent_lines.is_empty() {
        parts.push(format!("[近期操作（最近3小时）]\n{}", recent_lines.join("\n")));
    }
    if !hist_lines.is_empty() {
        parts.push(format!("[历史摘要（近7天）]\n{}", hist_lines.join("\n")));
    }

    let result = parts.join("\n\n");
    // Hard cap to stay within budget (safe UTF-8 boundary)
    if result.len() > BUDGET {
        format!("{}…", safe_truncate(&result, BUDGET))
    } else {
        result
    }
}

/// Tauri command wrapper for build_memory_context (useful for debugging/preview).
#[tauri::command]
pub async fn memory_build_context(
    state: State<'_, AppState>,
) -> Result<String, String> {
    Ok(build_memory_context(&state.db).await)
}
