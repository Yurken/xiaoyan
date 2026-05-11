use crate::llm::{resolve_model, resolve_temperature_chain, LlmClient, LlmMessage};
use crate::services::submission_service::{
    self, CreateSubmissionVenueParams, UpdateSubmissionVenueParams,
};
use crate::state::AppState;
use serde_json::json;
use sqlx::Row;
use tauri::{AppHandle, Emitter, State};
use uuid::Uuid;
use chrono::Datelike;

// ── Helpers ────────────────────────────────────────────────────────────────

fn now() -> String {
    chrono::Utc::now().format("%Y-%m-%dT%H:%M:%S").to_string()
}

// ══════════════════════════════════════════════════════════════════════════
//  Venues
// ══════════════════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn submission_list_venues(
    state: State<'_, AppState>,
    search: Option<String>,
    starred_only: Option<bool>,
) -> Result<serde_json::Value, String> {
    submission_service::list_submission_venues(&state, search, starred_only).await
}

#[tauri::command]
pub async fn submission_create_venue(
    state: State<'_, AppState>,
    name: String,
    full_name: Option<String>,
    venue_type: Option<String>,
    website: Option<String>,
    ccf: Option<String>,
    area: Option<String>,
    ei: Option<bool>,
    sci: Option<bool>,
    sci_quartile: Option<String>,
    deadline: Option<String>,
    notification_date: Option<String>,
    special_issue_deadline: Option<String>,
    special_issue_title: Option<String>,
) -> Result<serde_json::Value, String> {
    submission_service::create_submission_venue(
        &state,
        CreateSubmissionVenueParams {
            name,
            full_name,
            venue_type,
            website,
            ccf,
            area,
            ei,
            sci,
            sci_quartile,
            deadline,
            notification_date,
            special_issue_deadline,
            special_issue_title,
        },
    )
    .await
}

#[tauri::command]
pub async fn submission_update_venue(
    state: State<'_, AppState>,
    id: String,
    name: Option<String>,
    full_name: Option<String>,
    venue_type: Option<String>,
    website: Option<String>,
    ccf: Option<String>,
    area: Option<String>,
    ei: Option<bool>,
    sci: Option<bool>,
    sci_quartile: Option<String>,
    deadline: Option<String>,
    notification_date: Option<String>,
    special_issue_deadline: Option<String>,
    special_issue_title: Option<String>,
) -> Result<(), String> {
    submission_service::update_submission_venue(
        &state,
        &id,
        UpdateSubmissionVenueParams {
            name,
            full_name,
            venue_type,
            website,
            ccf,
            area,
            ei,
            sci,
            sci_quartile,
            deadline,
            notification_date,
            special_issue_deadline,
            special_issue_title,
        },
    )
    .await
}

#[tauri::command]
pub async fn submission_delete_venue(state: State<'_, AppState>, id: String) -> Result<(), String> {
    submission_service::delete_submission_venue(&state, &id).await
}

#[tauri::command]
pub async fn submission_toggle_venue_star(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    submission_service::toggle_submission_venue_star(&state, &id).await
}

// ══════════════════════════════════════════════════════════════════════════
//  Submissions
// ══════════════════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn submission_list(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    let rows = sqlx::query(
        "SELECT id, title, venue_name, venue_type, status, deadline, submitted_at, created_at, updated_at
         FROM submissions ORDER BY updated_at DESC",
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    let items: Vec<serde_json::Value> = rows
        .iter()
        .map(|row| {
            json!({
                "id": row.get::<String, _>("id"),
                "title": row.get::<String, _>("title"),
                "venueName": row.get::<String, _>("venue_name"),
                "venueType": row.get::<String, _>("venue_type"),
                "status": row.get::<String, _>("status"),
                "deadline": row.get::<Option<String>, _>("deadline"),
                "submittedAt": row.get::<Option<String>, _>("submitted_at"),
                "createdAt": row.get::<String, _>("created_at"),
                "updatedAt": row.get::<String, _>("updated_at"),
            })
        })
        .collect();

    Ok(json!({ "submissions": items }))
}

#[tauri::command]
pub async fn submission_create(
    state: State<'_, AppState>,
    title: String,
    venue_name: Option<String>,
    venue_type: Option<String>,
    status: Option<String>,
    deadline: Option<String>,
) -> Result<serde_json::Value, String> {
    let id = Uuid::new_v4().to_string();
    let ts = now();
    sqlx::query(
        "INSERT INTO submissions (id, title, venue_name, venue_type, status, deadline, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&title)
    .bind(venue_name.as_deref().unwrap_or(""))
    .bind(venue_type.as_deref().unwrap_or("conference"))
    .bind(status.as_deref().unwrap_or("writing"))
    .bind(deadline.as_deref())
    .bind(&ts)
    .bind(&ts)
    .execute(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    // init checklist
    init_default_checklist(&state.db, &id).await?;

    Ok(json!({ "id": id }))
}

#[tauri::command]
pub async fn submission_update(
    state: State<'_, AppState>,
    id: String,
    title: Option<String>,
    venue_name: Option<String>,
    venue_type: Option<String>,
    status: Option<String>,
    deadline: Option<String>,
    submitted_at: Option<String>,
) -> Result<(), String> {
    let ts = now();
    if let Some(v) = &title {
        sqlx::query("UPDATE submissions SET title = ?, updated_at = ? WHERE id = ?")
            .bind(v)
            .bind(&ts)
            .bind(&id)
            .execute(&state.db)
            .await
            .map_err(|e| e.to_string())?;
    }
    if let Some(v) = &venue_name {
        sqlx::query("UPDATE submissions SET venue_name = ?, updated_at = ? WHERE id = ?")
            .bind(v)
            .bind(&ts)
            .bind(&id)
            .execute(&state.db)
            .await
            .map_err(|e| e.to_string())?;
    }
    if let Some(v) = &venue_type {
        sqlx::query("UPDATE submissions SET venue_type = ?, updated_at = ? WHERE id = ?")
            .bind(v)
            .bind(&ts)
            .bind(&id)
            .execute(&state.db)
            .await
            .map_err(|e| e.to_string())?;
    }
    if let Some(v) = &status {
        sqlx::query("UPDATE submissions SET status = ?, updated_at = ? WHERE id = ?")
            .bind(v)
            .bind(&ts)
            .bind(&id)
            .execute(&state.db)
            .await
            .map_err(|e| e.to_string())?;
    }
    if let Some(v) = &deadline {
        let val: Option<&str> = if v.is_empty() { None } else { Some(v) };
        sqlx::query("UPDATE submissions SET deadline = ?, updated_at = ? WHERE id = ?")
            .bind(val)
            .bind(&ts)
            .bind(&id)
            .execute(&state.db)
            .await
            .map_err(|e| e.to_string())?;
    }
    if let Some(v) = &submitted_at {
        let val: Option<&str> = if v.is_empty() { None } else { Some(v) };
        sqlx::query("UPDATE submissions SET submitted_at = ?, updated_at = ? WHERE id = ?")
            .bind(val)
            .bind(&ts)
            .bind(&id)
            .execute(&state.db)
            .await
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn submission_delete(state: State<'_, AppState>, id: String) -> Result<(), String> {
    sqlx::query("DELETE FROM submissions WHERE id = ?")
        .bind(&id)
        .execute(&state.db)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ══════════════════════════════════════════════════════════════════════════
//  Paper Versions
// ══════════════════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn submission_list_versions(
    state: State<'_, AppState>,
    submission_id: String,
) -> Result<serde_json::Value, String> {
    let rows = sqlx::query(
        "SELECT id, submission_id, tag, label, stage, content, notes, file_path, file_name, created_at
         FROM paper_versions WHERE submission_id = ? ORDER BY created_at DESC",
    )
    .bind(&submission_id)
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    let items: Vec<serde_json::Value> = rows
        .iter()
        .map(|row| {
            json!({
                "id": row.get::<String, _>("id"),
                "submissionId": row.get::<String, _>("submission_id"),
                "tag": row.get::<String, _>("tag"),
                "label": row.get::<String, _>("label"),
                "stage": row.get::<String, _>("stage"),
                "content": row.get::<String, _>("content"),
                "notes": row.get::<String, _>("notes"),
                "filePath": row.get::<Option<String>, _>("file_path"),
                "fileName": row.get::<Option<String>, _>("file_name"),
                "createdAt": row.get::<String, _>("created_at"),
            })
        })
        .collect();

    Ok(json!({ "versions": items }))
}

#[tauri::command]
pub async fn submission_create_version(
    state: State<'_, AppState>,
    submission_id: String,
    tag: Option<String>,
    label: Option<String>,
    stage: Option<String>,
    content: Option<String>,
    notes: Option<String>,
    file_path: Option<String>,
    file_name: Option<String>,
) -> Result<serde_json::Value, String> {
    let id = Uuid::new_v4().to_string();
    let ts = now();
    sqlx::query(
        "INSERT INTO paper_versions (id, submission_id, tag, label, stage, content, notes, file_path, file_name, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&submission_id)
    .bind(tag.as_deref().unwrap_or(""))
    .bind(label.as_deref().unwrap_or(""))
    .bind(stage.as_deref().unwrap_or("draft"))
    .bind(content.as_deref().unwrap_or(""))
    .bind(notes.as_deref().unwrap_or(""))
    .bind(file_path.as_deref())
    .bind(file_name.as_deref())
    .bind(&ts)
    .execute(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    // update submission updated_at
    sqlx::query("UPDATE submissions SET updated_at = ? WHERE id = ?")
        .bind(&ts)
        .bind(&submission_id)
        .execute(&state.db)
        .await
        .ok();

    Ok(json!({ "id": id }))
}

#[tauri::command]
pub async fn submission_update_version(
    state: State<'_, AppState>,
    id: String,
    tag: Option<String>,
    label: Option<String>,
    stage: Option<String>,
    content: Option<String>,
    notes: Option<String>,
    file_path: Option<String>,
    file_name: Option<String>,
) -> Result<(), String> {
    let submission_row = sqlx::query("SELECT submission_id FROM paper_versions WHERE id = ?")
        .bind(&id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| e.to_string())?;
    let Some(submission_row) = submission_row else {
        return Err("Version not found".into());
    };
    let submission_id: String = submission_row.get("submission_id");

    if let Some(value) = &tag {
        sqlx::query("UPDATE paper_versions SET tag = ? WHERE id = ?")
            .bind(value)
            .bind(&id)
            .execute(&state.db)
            .await
            .map_err(|e| e.to_string())?;
    }
    if let Some(value) = &label {
        sqlx::query("UPDATE paper_versions SET label = ? WHERE id = ?")
            .bind(value)
            .bind(&id)
            .execute(&state.db)
            .await
            .map_err(|e| e.to_string())?;
    }
    if let Some(value) = &stage {
        sqlx::query("UPDATE paper_versions SET stage = ? WHERE id = ?")
            .bind(value)
            .bind(&id)
            .execute(&state.db)
            .await
            .map_err(|e| e.to_string())?;
    }
    if let Some(value) = &content {
        sqlx::query("UPDATE paper_versions SET content = ? WHERE id = ?")
            .bind(value)
            .bind(&id)
            .execute(&state.db)
            .await
            .map_err(|e| e.to_string())?;
    }
    if let Some(value) = &notes {
        sqlx::query("UPDATE paper_versions SET notes = ? WHERE id = ?")
            .bind(value)
            .bind(&id)
            .execute(&state.db)
            .await
            .map_err(|e| e.to_string())?;
    }
    if let Some(value) = &file_path {
        let file_path_value: Option<&str> = if value.is_empty() { None } else { Some(value) };
        sqlx::query("UPDATE paper_versions SET file_path = ? WHERE id = ?")
            .bind(file_path_value)
            .bind(&id)
            .execute(&state.db)
            .await
            .map_err(|e| e.to_string())?;
    }
    if let Some(value) = &file_name {
        let file_name_value: Option<&str> = if value.is_empty() { None } else { Some(value) };
        sqlx::query("UPDATE paper_versions SET file_name = ? WHERE id = ?")
            .bind(file_name_value)
            .bind(&id)
            .execute(&state.db)
            .await
            .map_err(|e| e.to_string())?;
    }

    sqlx::query("UPDATE submissions SET updated_at = ? WHERE id = ?")
        .bind(now())
        .bind(&submission_id)
        .execute(&state.db)
        .await
        .ok();

    Ok(())
}

#[tauri::command]
pub async fn submission_delete_version(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    sqlx::query("DELETE FROM paper_versions WHERE id = ?")
        .bind(&id)
        .execute(&state.db)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ══════════════════════════════════════════════════════════════════════════
//  Review Rounds
// ══════════════════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn submission_list_rounds(
    state: State<'_, AppState>,
    submission_id: String,
) -> Result<serde_json::Value, String> {
    let rows = sqlx::query(
        "SELECT id, submission_id, round, verdict, received_at FROM review_rounds WHERE submission_id = ? ORDER BY round ASC",
    )
    .bind(&submission_id)
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    let items: Vec<serde_json::Value> = rows
        .iter()
        .map(|row| {
            json!({
                "id": row.get::<String, _>("id"),
                "submissionId": row.get::<String, _>("submission_id"),
                "round": row.get::<i64, _>("round"),
                "verdict": row.get::<String, _>("verdict"),
                "receivedAt": row.get::<Option<String>, _>("received_at"),
            })
        })
        .collect();

    Ok(json!({ "rounds": items }))
}

#[tauri::command]
pub async fn submission_upsert_round(
    state: State<'_, AppState>,
    submission_id: String,
    round: i64,
    verdict: Option<String>,
    received_at: Option<String>,
) -> Result<serde_json::Value, String> {
    let id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO review_rounds (id, submission_id, round, verdict, received_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(submission_id, round) DO UPDATE SET
           verdict = excluded.verdict,
           received_at = excluded.received_at",
    )
    .bind(&id)
    .bind(&submission_id)
    .bind(round)
    .bind(verdict.as_deref().unwrap_or("pending"))
    .bind(received_at.as_deref())
    .execute(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    let row = sqlx::query("SELECT id FROM review_rounds WHERE submission_id = ? AND round = ?")
        .bind(&submission_id)
        .bind(round)
        .fetch_one(&state.db)
        .await
        .map_err(|e| e.to_string())?;

    Ok(json!({ "id": row.get::<String, _>("id") }))
}

// ══════════════════════════════════════════════════════════════════════════
//  Review Comments
// ══════════════════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn submission_list_comments(
    state: State<'_, AppState>,
    submission_id: String,
    round: Option<i64>,
) -> Result<serde_json::Value, String> {
    let rows = if let Some(r) = round {
        sqlx::query(
            "SELECT id, submission_id, round, reviewer, content, response, resolved, tags, created_at
             FROM review_comments WHERE submission_id = ? AND round = ? ORDER BY reviewer, created_at",
        )
        .bind(&submission_id).bind(r)
        .fetch_all(&state.db).await
    } else {
        sqlx::query(
            "SELECT id, submission_id, round, reviewer, content, response, resolved, tags, created_at
             FROM review_comments WHERE submission_id = ? ORDER BY round, reviewer, created_at",
        )
        .bind(&submission_id)
        .fetch_all(&state.db).await
    }
    .map_err(|e| e.to_string())?;

    let items: Vec<serde_json::Value> = rows
        .iter()
        .map(|row| {
            let tags_raw: String = row.get("tags");
            let tags: serde_json::Value =
                serde_json::from_str(&tags_raw).unwrap_or_else(|_| json!([]));
            json!({
                "id": row.get::<String, _>("id"),
                "submissionId": row.get::<String, _>("submission_id"),
                "round": row.get::<i64, _>("round"),
                "reviewer": row.get::<String, _>("reviewer"),
                "content": row.get::<String, _>("content"),
                "response": row.get::<String, _>("response"),
                "resolved": row.get::<i64, _>("resolved") == 1,
                "tags": tags,
                "createdAt": row.get::<String, _>("created_at"),
            })
        })
        .collect();

    Ok(json!({ "comments": items }))
}

#[tauri::command]
pub async fn submission_create_comment(
    state: State<'_, AppState>,
    submission_id: String,
    round: i64,
    reviewer: Option<String>,
    content: String,
    response: Option<String>,
    tags: Option<Vec<String>>,
) -> Result<serde_json::Value, String> {
    let id = Uuid::new_v4().to_string();
    let ts = now();
    let tags_json =
        serde_json::to_string(&tags.unwrap_or_default()).unwrap_or_else(|_| "[]".into());
    sqlx::query(
        "INSERT INTO review_comments (id, submission_id, round, reviewer, content, response, tags, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&submission_id)
    .bind(round)
    .bind(reviewer.as_deref().unwrap_or("Reviewer"))
    .bind(&content)
    .bind(response.as_deref().unwrap_or(""))
    .bind(&tags_json)
    .bind(&ts)
    .execute(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    Ok(json!({ "id": id }))
}

#[tauri::command]
pub async fn submission_update_comment(
    state: State<'_, AppState>,
    id: String,
    content: Option<String>,
    response: Option<String>,
    resolved: Option<bool>,
    tags: Option<Vec<String>>,
) -> Result<(), String> {
    if let Some(v) = &content {
        sqlx::query("UPDATE review_comments SET content = ? WHERE id = ?")
            .bind(v)
            .bind(&id)
            .execute(&state.db)
            .await
            .map_err(|e| e.to_string())?;
    }
    if let Some(v) = &response {
        sqlx::query("UPDATE review_comments SET response = ? WHERE id = ?")
            .bind(v)
            .bind(&id)
            .execute(&state.db)
            .await
            .map_err(|e| e.to_string())?;
    }
    if let Some(v) = resolved {
        sqlx::query("UPDATE review_comments SET resolved = ? WHERE id = ?")
            .bind(v as i64)
            .bind(&id)
            .execute(&state.db)
            .await
            .map_err(|e| e.to_string())?;
    }
    if let Some(v) = &tags {
        let tags_json = serde_json::to_string(v).unwrap_or_else(|_| "[]".into());
        sqlx::query("UPDATE review_comments SET tags = ? WHERE id = ?")
            .bind(&tags_json)
            .bind(&id)
            .execute(&state.db)
            .await
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn submission_delete_comment(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    sqlx::query("DELETE FROM review_comments WHERE id = ?")
        .bind(&id)
        .execute(&state.db)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ══════════════════════════════════════════════════════════════════════════
//  Checklist
// ══════════════════════════════════════════════════════════════════════════

async fn init_default_checklist(
    pool: &sqlx::SqlitePool,
    submission_id: &str,
) -> Result<(), String> {
    let defaults = vec![
        ("摘要完整", "写作"),
        ("图表标注清晰", "写作"),
        ("参考文献格式统一", "写作"),
        ("符合页数/字数限制", "格式"),
        ("已按模板排版", "格式"),
        ("已通过查重检测", "合规"),
        ("作者信息正确", "合规"),
        ("摘要已投稿系统", "提交"),
        ("全文已上传", "提交"),
        ("已收到投稿确认邮件", "提交"),
    ];
    for (i, (label, category)) in defaults.iter().enumerate() {
        let id = Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT OR IGNORE INTO submission_checklist (id, submission_id, label, category, sort_order) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(&id)
        .bind(submission_id)
        .bind(label)
        .bind(category)
        .bind(i as i64)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn submission_get_checklist(
    state: State<'_, AppState>,
    submission_id: String,
) -> Result<serde_json::Value, String> {
    let rows = sqlx::query(
        "SELECT id, submission_id, label, checked, category, sort_order
         FROM submission_checklist WHERE submission_id = ? ORDER BY sort_order",
    )
    .bind(&submission_id)
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    let items: Vec<serde_json::Value> = rows
        .iter()
        .map(|row| {
            json!({
                "id": row.get::<String, _>("id"),
                "submissionId": row.get::<String, _>("submission_id"),
                "label": row.get::<String, _>("label"),
                "checked": row.get::<i64, _>("checked") == 1,
                "category": row.get::<String, _>("category"),
                "sortOrder": row.get::<i64, _>("sort_order"),
            })
        })
        .collect();

    Ok(json!({ "checklist": items }))
}

#[tauri::command]
pub async fn submission_toggle_checklist(
    state: State<'_, AppState>,
    item_id: String,
) -> Result<(), String> {
    sqlx::query("UPDATE submission_checklist SET checked = CASE WHEN checked = 1 THEN 0 ELSE 1 END WHERE id = ?")
        .bind(&item_id)
        .execute(&state.db)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ══════════════════════════════════════════════════════════════════════════
//  Stats (for Home dashboard)
// ══════════════════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn submission_stats(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    let active_row = sqlx::query(
        "SELECT COUNT(*) as cnt FROM submissions WHERE status IN ('writing','submitted','reviewing')",
    )
    .fetch_one(&state.db)
    .await
    .map_err(|e| e.to_string())?;
    let active: i64 = active_row.get("cnt");

    let pending_row = sqlx::query("SELECT COUNT(*) as cnt FROM review_comments WHERE resolved = 0")
        .fetch_one(&state.db)
        .await
        .map_err(|e| e.to_string())?;
    let pending_reviews: i64 = pending_row.get("cnt");

    let ddl_rows = sqlx::query(
        "SELECT name, deadline FROM venues WHERE deadline IS NOT NULL AND deadline BETWEEN date('now') AND date('now','+7 days') ORDER BY deadline ASC LIMIT 5",
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    let upcoming_ddls: Vec<serde_json::Value> = ddl_rows
        .iter()
        .map(|row| {
            json!({
                "name": row.get::<String, _>("name"),
                "deadline": row.get::<String, _>("deadline"),
            })
        })
        .collect();

    Ok(json!({
        "active": active,
        "pendingReviews": pending_reviews,
        "upcomingDdls": upcoming_ddls,
    }))
}

// ══════════════════════════════════════════════════════════════════════════
//  AI Review (real LLM)
// ══════════════════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn submission_ai_review(
    app: AppHandle,
    state: State<'_, AppState>,
    submission_id: String,
    content: String,
    reviewer_count: u8,
    strictness: String,
) -> Result<(), String> {
    let settings = state.settings.read().await.clone();
    let client = LlmClient::from_settings(&settings).map_err(|e| e.to_string())?;
    let model = resolve_model(&settings, &["paper_analysis_model"]);
    let temperature = resolve_temperature_chain(&settings, &["paper_analysis_temperature"], 0.7);

    // truncate content to avoid token overflow
    let text: String = content.chars().take(6000).collect();
    let count = reviewer_count.min(4).max(1);
    let strictness_desc = match strictness.as_str() {
        "lenient" => "偏宽松，鼓励创新，接受轻微瑕疵",
        "strict" => "极其严格，要求完美，对任何缺陷都提出批评",
        _ => "均衡，公正评估优缺点",
    };

    tauri::async_runtime::spawn(async move {
        for i in 0..count {
            let reviewer = format!("Reviewer {}", i + 1);
            let prompt = crate::assistant_prompts::ai_review_prompt(
                &text,
                &reviewer,
                strictness_desc,
                i + 1,
                count,
            );
            let messages = vec![
                LlmMessage::system("你是一位资深学术论文审稿人。请严格按照JSON格式输出审稿意见。"),
                LlmMessage::user(prompt),
            ];

            match client.chat(&messages, model.as_deref(), temperature).await {
                Ok(result) => {
                    let _ = app.emit(
                        "submission:ai_review:reviewer",
                        json!({
                            "submissionId": submission_id,
                            "index": i,
                            "reviewer": reviewer,
                            "raw": result,
                        }),
                    );
                }
                Err(e) => {
                    let _ = app.emit(
                        "submission:ai_review:error",
                        json!({ "submissionId": submission_id, "error": e.to_string() }),
                    );
                    return;
                }
            }
        }
        let _ = app.emit(
            "submission:ai_review:done",
            json!({ "submissionId": submission_id }),
        );
    });

    Ok(())
}

// ══════════════════════════════════════════════════════════════════════════
//  AI Polish (stream)
// ══════════════════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn submission_polish_abstract(
    app: AppHandle,
    state: State<'_, AppState>,
    submission_id: String,
    text: String,
) -> Result<(), String> {
    let settings = state.settings.read().await.clone();
    let client = LlmClient::from_settings(&settings).map_err(|e| e.to_string())?;
    let model = resolve_model(&settings, &["paper_analysis_model"]);
    let temperature = resolve_temperature_chain(&settings, &["paper_analysis_temperature"], 0.5);

    let prompt = crate::assistant_prompts::polish_abstract_prompt(&text);
    let messages = vec![
        LlmMessage::system("你是一位专业的学术写作润色助手，擅长提升论文摘要的学术表达质量。"),
        LlmMessage::user(prompt),
    ];

    let sid = submission_id.clone();
    let app_clone = app.clone();

    tauri::async_runtime::spawn(async move {
        let result = client
            .stream_chat(&messages, model.as_deref(), temperature, |delta| {
                let _ = app_clone.emit(
                    "submission:polish:delta",
                    json!({ "submissionId": sid, "delta": delta }),
                );
            })
            .await;

        match result {
            Ok(full) => {
                let _ = app.emit(
                    "submission:polish:done",
                    json!({ "submissionId": submission_id, "fullText": full }),
                );
            }
            Err(e) => {
                let _ = app.emit(
                    "submission:polish:error",
                    json!({ "submissionId": submission_id, "error": e.to_string() }),
                );
            }
        }
    });

    Ok(())
}

// ══════════════════════════════════════════════════════════════════════════
//  Cover Letter Generation (stream)
// ══════════════════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn submission_generate_cover_letter(
    app: AppHandle,
    state: State<'_, AppState>,
    submission_id: String,
) -> Result<(), String> {
    let settings = state.settings.read().await.clone();
    let client = LlmClient::from_settings(&settings).map_err(|e| e.to_string())?;
    let model = resolve_model(&settings, &["paper_analysis_model"]);
    let temperature = resolve_temperature_chain(&settings, &["paper_analysis_temperature"], 0.5);

    // gather context
    let sub_row = sqlx::query("SELECT title, venue_name, venue_type FROM submissions WHERE id = ?")
        .bind(&submission_id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| e.to_string())?;

    let (title, venue_name, venue_type) = if let Some(row) = sub_row {
        (
            row.get::<String, _>("title"),
            row.get::<String, _>("venue_name"),
            row.get::<String, _>("venue_type"),
        )
    } else {
        return Err("Submission not found".into());
    };

    let rounds = sqlx::query(
        "SELECT round, verdict FROM review_rounds WHERE submission_id = ? ORDER BY round",
    )
    .bind(&submission_id)
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    let comments = sqlx::query(
        "SELECT reviewer, content, response, round FROM review_comments WHERE submission_id = ? ORDER BY round, reviewer",
    )
    .bind(&submission_id)
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    let rounds_info: Vec<String> = rounds
        .iter()
        .map(|r| {
            format!(
                "第{}轮: {}",
                r.get::<i64, _>("round"),
                r.get::<String, _>("verdict")
            )
        })
        .collect();

    let comments_info: Vec<String> = comments
        .iter()
        .map(|c| {
            format!(
                "[第{}轮 {}] 意见: {} | 回复: {}",
                c.get::<i64, _>("round"),
                c.get::<String, _>("reviewer"),
                c.get::<String, _>("content"),
                c.get::<String, _>("response"),
            )
        })
        .collect();

    let prompt = crate::assistant_prompts::cover_letter_prompt(
        &title,
        &venue_name,
        &venue_type,
        &rounds_info.join("\n"),
        &comments_info.join("\n"),
    );

    let messages = vec![
        LlmMessage::system(
            "你是一位经验丰富的学术写作助手，擅长撰写论文投稿/修改说明信 (Cover Letter)。",
        ),
        LlmMessage::user(prompt),
    ];

    let sid = submission_id.clone();
    let app_clone = app.clone();

    tauri::async_runtime::spawn(async move {
        let result = client
            .stream_chat(&messages, model.as_deref(), temperature, |delta| {
                let _ = app_clone.emit(
                    "submission:cover_letter:delta",
                    json!({ "submissionId": sid, "delta": delta }),
                );
            })
            .await;

        match result {
            Ok(full) => {
                let _ = app.emit(
                    "submission:cover_letter:done",
                    json!({ "submissionId": submission_id, "fullText": full }),
                );
            }
            Err(e) => {
                let _ = app.emit(
                    "submission:cover_letter:error",
                    json!({ "submissionId": submission_id, "error": e.to_string() }),
                );
            }
        }
    });

    Ok(())
}

// ══════════════════════════════════════════════════════════════════════════
//  CCF DDL Sync (from ccfddl/ccf-deadlines GitHub repo)
// ══════════════════════════════════════════════════════════════════════════

const CCFDDL_CATEGORIES: &[&str] = &["AI", "SE", "DB", "CT", "CG", "HI", "MX", "NW", "SC", "DS"];
const CCFDDL_API_BASE: &str = "https://api.github.com/repos/ccfddl/ccf-deadlines/contents/conference";

#[derive(serde::Deserialize)]
struct GithubContent {
    name: String,
    download_url: Option<String>,
}

#[derive(serde::Deserialize)]
struct CcfConfEntry {
    year: Option<i32>,
    link: Option<String>,
    timeline: Option<Vec<CcfTimeline>>,
    timezone: Option<String>,
    date: Option<String>,
    place: Option<String>,
}

#[derive(serde::Deserialize)]
struct CcfTimeline {
    deadline: Option<String>,
}

#[derive(serde::Deserialize)]
struct CcfRank {
    ccf: Option<String>,
}

#[derive(serde::Deserialize)]
struct CcfVenueYaml {
    title: String,
    sub: Option<String>,
    rank: Option<CcfRank>,
    confs: Option<Vec<CcfConfEntry>>,
}

#[tauri::command]
pub async fn submission_sync_ccfddl(
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let current_year = chrono::Utc::now().year();
    let mut fetched = 0u32;
    let mut updated = 0u32;

    for category in CCFDDL_CATEGORIES {
        let list_url = format!("{CCFDDL_API_BASE}/{category}");
        let resp = client
            .get(&list_url)
            .header("User-Agent", "xiaoyan-desktop")
            .send()
            .await
            .map_err(|e| e.to_string())?;
        let entries: Vec<GithubContent> = resp.json().await.map_err(|e| e.to_string())?;

        for entry in entries {
            let Some(download_url) = entry.download_url else { continue };
            if !entry.name.ends_with(".yml") { continue; }

            let yaml_text = match client
                .get(&download_url)
                .header("User-Agent", "xiaoyan-desktop")
                .send()
                .await
            {
                Ok(r) => r.text().await.unwrap_or_default(),
                Err(_) => continue,
            };

            let venues: Vec<CcfVenueYaml> =
                serde_yaml::from_str(&yaml_text).unwrap_or_default();
            let Some(best) = venues.into_iter().next() else { continue };

            // Pick the latest future-year conference entry
            let latest_conf = best.confs.iter().flat_map(|c| c.iter()).fold(
                None,
                |best: Option<&CcfConfEntry>, entry| {
                    let entry_year = entry.year.unwrap_or(0);
                    if entry_year < current_year { return best; }
                    match best {
                        Some(b) if b.year.unwrap_or(0) >= entry_year => Some(b),
                        _ => Some(entry),
                    }
                },
            );

            fetched += 1;

            let Some(conf) = latest_conf else { continue };
            let deadline = conf
                .timeline
                .as_ref()
                .and_then(|t| t.first())
                .and_then(|t| t.deadline.as_deref())
                .map(|d| d.trim().to_string());
            let timezone = conf.timezone.as_deref().map(|s| s.trim().to_string()).unwrap_or_default();
            let conference_date = conf.date.as_deref().map(|s| s.trim().to_string()).unwrap_or_default();
            let conference_location = conf.place.as_deref().map(|s| s.trim().to_string()).unwrap_or_default();
            let website = conf.link.as_deref().map(|s| s.trim().to_string()).unwrap_or_default();

            // Match by case-insensitive short name
            let matched = sqlx::query(
                "UPDATE venues SET deadline = ?, deadline_timezone = ?, conference_date = ?, conference_location = ?, website = CASE WHEN ? != '' THEN ? ELSE website END WHERE LOWER(name) = LOWER(?)",
            )
            .bind(&deadline)
            .bind(&timezone)
            .bind(&conference_date)
            .bind(&conference_location)
            .bind(&website)
            .bind(&website)
            .bind(&best.title)
            .execute(&state.db)
            .await
            .map_err(|e| e.to_string())?;

            if matched.rows_affected() > 0 {
                updated += 1;
            }
        }
    }

    Ok(serde_json::json!({ "fetched": fetched, "updated": updated }))
}
