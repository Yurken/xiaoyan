use crate::llm::{LlmClient, LlmMessage};
use crate::rag::{combined_search, serialize_embedding};
use crate::state::AppState;
use serde_json::json;
use sqlx::Row;
use tauri::{Emitter, State};
use uuid::Uuid;

// ── Research Interests ──────────────────────────────────────────

#[tauri::command]
pub async fn knowledge_list_interests(
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let rows = sqlx::query(
        "SELECT id, topic, keywords, learning_path, status, created_at FROM research_interests ORDER BY created_at DESC",
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    let list: Vec<serde_json::Value> = rows
        .iter()
        .map(|r| {
            let kw: String = r.get::<Option<String>, _>("keywords").unwrap_or_else(|| "[]".into());
            let lp_str: Option<String> = r.get::<Option<String>, _>("learning_path");
            let learning_path = lp_str
                .and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok());
            json!({
                "id": r.get::<String, _>("id"),
                "topic": r.get::<String, _>("topic"),
                "keywords": serde_json::from_str::<serde_json::Value>(&kw).unwrap_or(json!([])),
                "learning_path": learning_path,
                "status": r.get::<String, _>("status"),
                "created_at": r.get::<String, _>("created_at"),
            })
        })
        .collect();
    Ok(json!(list))
}

#[tauri::command]
pub async fn knowledge_create_interest(
    state: State<'_, AppState>,
    topic: String,
    keywords: Vec<String>,
) -> Result<serde_json::Value, String> {
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let kw_json = serde_json::to_string(&keywords).unwrap_or_else(|_| "[]".into());
    sqlx::query(
        "INSERT INTO research_interests (id, topic, keywords, created_at) VALUES (?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&topic)
    .bind(&kw_json)
    .bind(&now)
    .execute(&state.db)
    .await
    .map_err(|e| e.to_string())?;
    Ok(json!({ "id": id, "topic": topic, "keywords": keywords, "status": "active", "created_at": now }))
}

const PLANNER_SYSTEM: &str = "你是一位顶尖的学术导师，擅长为学生设计系统化的研究学习路线。";
const PLANNER_PROMPT: &str = r#"请为研究方向「{topic}」（关键词：{keywords}）设计系统化学习路线，以 JSON 格式返回：
{{"overview":"...","prerequisites":[{{"name":"...","description":"...","resources":["..."]}}],"learning_stages":[{{"stage":1,"title":"...","duration":"...","goals":["..."],"topics":["..."],"resources":["..."]}}],"classic_papers":[{{"title":"...","authors":"...","year":2020,"reason":"..."}}],"research_directions":[{{"direction":"...","description":"...","open_problems":["..."]}}],"tools_and_frameworks":["..."],"communities":["..."]}}"#;
const PLANNER_ANALYST_SYSTEM: &str = "你是研究方向分析 Agent，负责把研究主题拆解为学习重点和能力目标。";
const PLANNER_ANALYST_PROMPT: &str = r#"请分析研究方向「{topic}」（关键词：{keywords}），仅返回 JSON：
{"scope":"一句话定义范围","focus_topics":["核心主题"],"skill_targets":["需要掌握的能力"],"risk_points":["新手常见误区"]}"#;

#[tauri::command]
pub async fn knowledge_generate_plan(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    let row = sqlx::query("SELECT topic, keywords FROM research_interests WHERE id = ?")
        .bind(&id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("Interest not found")?;

    let topic: String = row.get("topic");
    let kw_str: String = row.get::<Option<String>, _>("keywords").unwrap_or_else(|| "[]".into());
    let keywords: Vec<String> = serde_json::from_str(&kw_str).unwrap_or_default();
    let settings = state.settings.read().await.clone();
    let db = state.db.clone();
    let rid = id.clone();

    tokio::spawn(async move {
        let client = match LlmClient::from_settings(&settings) {
            Ok(c) => c,
            Err(e) => { let _ = app.emit("interest:error", json!({ "id": rid, "error": e.to_string() })); return; }
        };

        let analyst_id = Uuid::new_v4().to_string();
        let _ = app.emit("interest:agent_start", json!({
            "id": rid,
            "agent": {
                "id": analyst_id,
                "name": "Topic Analyst",
                "role": "拆解研究主题与能力目标",
                "status": "running"
            }
        }));

        let analyst_prompt = PLANNER_ANALYST_PROMPT
            .replace("{topic}", &topic)
            .replace("{keywords}", &keywords.join("、"));
        let analyst_msgs = vec![LlmMessage::system(PLANNER_ANALYST_SYSTEM), LlmMessage::user(&analyst_prompt)];
        let analysis_json = match client.chat(&analyst_msgs, None, 0.2).await {
            Ok(resp) => {
                let clean = crate::commands::papers::extract_json_pub(&resp);
                let parsed = serde_json::from_str::<serde_json::Value>(&clean).unwrap_or(json!({}));
                let _ = app.emit("interest:agent_complete", json!({
                    "id": rid,
                    "agent": {
                        "id": analyst_id,
                        "name": "Topic Analyst",
                        "role": "拆解研究主题与能力目标",
                        "status": "done",
                        "summary": parsed.get("scope").and_then(|v| v.as_str()).unwrap_or("已完成主题拆解")
                    }
                }));
                parsed
            }
            Err(e) => {
                let _ = app.emit("interest:agent_error", json!({
                    "id": rid,
                    "agent": {
                        "id": analyst_id,
                        "name": "Topic Analyst",
                        "role": "拆解研究主题与能力目标",
                        "status": "failed",
                        "error": e.to_string()
                    }
                }));
                json!({})
            }
        };

        let scout_id = Uuid::new_v4().to_string();
        let _ = app.emit("interest:agent_start", json!({
            "id": rid,
            "agent": {
                "id": scout_id,
                "name": "Paper Scout",
                "role": "从本地论文库筛选参考论文",
                "status": "running"
            }
        }));

        let mut paper_hints: Vec<String> = Vec::new();
        let mut terms = vec![topic.clone()];
        terms.extend(keywords.clone());
        for term in terms.into_iter().take(6) {
            let like = format!("%{}%", term);
            let rows = sqlx::query("SELECT title, year FROM papers WHERE title LIKE ? OR abstract LIKE ? LIMIT 3")
                .bind(&like)
                .bind(&like)
                .fetch_all(&db)
                .await
                .unwrap_or_default();
            for row in rows {
                let title: String = row.get("title");
                let year: Option<i64> = row.get("year");
                paper_hints.push(format!("{}{}", title, year.map(|y| format!(" ({})", y)).unwrap_or_default()));
            }
            if paper_hints.len() >= 8 {
                break;
            }
        }
        paper_hints.sort();
        paper_hints.dedup();
        let _ = app.emit("interest:agent_complete", json!({
            "id": rid,
            "agent": {
                "id": scout_id,
                "name": "Paper Scout",
                "role": "从本地论文库筛选参考论文",
                "status": "done",
                "summary": format!("已找到 {} 篇候选参考论文", paper_hints.len())
            }
        }));

        let designer_id = Uuid::new_v4().to_string();
        let _ = app.emit("interest:agent_start", json!({
            "id": rid,
            "agent": {
                "id": designer_id,
                "name": "Learning Path Designer",
                "role": "生成结构化学习路线",
                "status": "running"
            }
        }));

        let analysis_scope = analysis_json
            .get("scope")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        let analysis_focus = analysis_json
            .get("focus_topics")
            .and_then(|v| v.as_array())
            .map(|arr| arr.iter().filter_map(|x| x.as_str()).collect::<Vec<&str>>().join("、"))
            .unwrap_or_default();
        let prompt = format!(
            "{}\n\n补充约束：\n- 方向范围：{}\n- 优先覆盖主题：{}\n- 本地候选论文：{}",
            PLANNER_PROMPT
                .replace("{topic}", &topic)
                .replace("{keywords}", &keywords.join(", ")),
            analysis_scope,
            analysis_focus,
            if paper_hints.is_empty() { "无".to_string() } else { paper_hints.join("；") }
        );
        let msgs = vec![LlmMessage::system(PLANNER_SYSTEM), LlmMessage::user(&prompt)];
        match client.chat(&msgs, None, 0.3).await {
            Ok(resp) => {
                let clean = crate::commands::papers::extract_json_pub(&resp);
                let v: serde_json::Value = serde_json::from_str(&clean).unwrap_or_default();
                let path_str = serde_json::to_string(&v).unwrap_or_default();
                let _ = sqlx::query("UPDATE research_interests SET learning_path = ?, status = 'planned' WHERE id = ?")
                    .bind(&path_str).bind(&rid).execute(&db).await;
                let stage_count = v
                    .get("learning_stages")
                    .and_then(|x| x.as_array())
                    .map(|arr| arr.len())
                    .unwrap_or(0);
                let _ = app.emit("interest:agent_complete", json!({
                    "id": rid,
                    "agent": {
                        "id": designer_id,
                        "name": "Learning Path Designer",
                        "role": "生成结构化学习路线",
                        "status": "done",
                        "summary": format!("学习路线生成完成，共 {} 个阶段", stage_count)
                    }
                }));
                let _ = app.emit("interest:plan", json!({ "id": rid, "learning_path": v }));
            }
            Err(e) => {
                let _ = app.emit("interest:agent_error", json!({
                    "id": rid,
                    "agent": {
                        "id": designer_id,
                        "name": "Learning Path Designer",
                        "role": "生成结构化学习路线",
                        "status": "failed",
                        "error": e.to_string()
                    }
                }));
                let _ = app.emit("interest:error", json!({ "id": rid, "error": e.to_string() }));
            }
        }
    });
    Ok(())
}

// ── Knowledge Notes ─────────────────────────────────────────────

#[tauri::command]
pub async fn knowledge_list_notes(
    state: State<'_, AppState>,
    search: Option<String>,
) -> Result<serde_json::Value, String> {
    if let Some(q) = search.filter(|s| !s.is_empty()) {
        let settings = state.settings.read().await.clone();
        if let Ok(client) = LlmClient::embed_client_from_settings(&settings) {
            if let Ok(embeddings) = client.embed(&[q.clone()]).await {
                if let Some(emb) = embeddings.into_iter().next() {
                    let top_k: usize = settings.get("rag_top_k").and_then(|v| v.parse().ok()).unwrap_or(10);
                    let results = crate::rag::search_knowledge_notes(&state.db, &emb, top_k)
                        .await.map_err(|e| e.to_string())?;
                    let mut notes = Vec::new();
                    for r in results {
                        if let Ok(Some(row)) = sqlx::query(
                            "SELECT id, title, content, source_type, source_id, tags, research_interest_id, created_at, updated_at FROM knowledge_notes WHERE id = ?",
                        )
                        .bind(&r.id)
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
        // Fallback: full-text search
        let like = format!("%{}%", q);
        let rows = sqlx::query(
            "SELECT id, title, content, source_type, source_id, tags, research_interest_id, created_at, updated_at
             FROM knowledge_notes WHERE title LIKE ? OR content LIKE ? ORDER BY created_at DESC LIMIT 20",
        )
        .bind(&like).bind(&like)
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
pub async fn knowledge_create_note(
    state: State<'_, AppState>,
    title: String,
    content: String,
    tags: Option<Vec<String>>,
    research_interest_id: Option<String>,
) -> Result<serde_json::Value, String> {
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let next_tags = tags.unwrap_or_default();
    let tags_json = serde_json::to_string(&next_tags).unwrap_or_else(|_| "[]".into());
    sqlx::query(
        "INSERT INTO knowledge_notes (id, title, content, tags, research_interest_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id).bind(&title).bind(&content).bind(&tags_json).bind(&research_interest_id).bind(&now).bind(&now)
    .execute(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    let db = state.db.clone();
    let settings = state.settings.read().await.clone();
    let note_id = id.clone();
    let text = format!("{} {}", title, content);
    tokio::spawn(async move {
        if let Ok(client) = LlmClient::embed_client_from_settings(&settings) {
            if let Ok(embeddings) = client.embed(&[text]).await {
                if let Some(emb) = embeddings.into_iter().next() {
                    let emb_str = serialize_embedding(&emb);
                    let _ = sqlx::query("UPDATE knowledge_notes SET embedding = ? WHERE id = ?")
                        .bind(&emb_str).bind(&note_id).execute(&db).await;
                }
            }
        }
    });

    Ok(json!({
        "id": id,
        "title": title,
        "content": content,
        "source_type": "manual",
        "source_id": serde_json::Value::Null,
        "tags": next_tags,
        "research_interest_id": research_interest_id,
        "created_at": now,
        "updated_at": now
    }))
}

#[tauri::command]
pub async fn knowledge_update_note(
    state: State<'_, AppState>,
    id: String,
    title: Option<String>,
    content: Option<String>,
    tags: Option<Vec<String>>,
) -> Result<serde_json::Value, String> {
    let now = chrono::Utc::now().to_rfc3339();
    if let Some(t) = &title {
        sqlx::query("UPDATE knowledge_notes SET title = ?, updated_at = ? WHERE id = ?")
            .bind(t).bind(&now).bind(&id).execute(&state.db).await.map_err(|e| e.to_string())?;
    }
    if let Some(c) = &content {
        sqlx::query("UPDATE knowledge_notes SET content = ?, updated_at = ? WHERE id = ?")
            .bind(c).bind(&now).bind(&id).execute(&state.db).await.map_err(|e| e.to_string())?;
    }
    if let Some(t) = &tags {
        let tj = serde_json::to_string(t).unwrap_or_else(|_| "[]".into());
        sqlx::query("UPDATE knowledge_notes SET tags = ?, updated_at = ? WHERE id = ?")
            .bind(&tj).bind(&now).bind(&id).execute(&state.db).await.map_err(|e| e.to_string())?;
    }
    let row = sqlx::query(
        "SELECT id, title, content, source_type, source_id, tags, research_interest_id, created_at, updated_at FROM knowledge_notes WHERE id = ?",
    )
    .bind(&id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| e.to_string())?
    .ok_or("Note not found")?;
    Ok(note_row_to_json(&row))
}

#[tauri::command]
pub async fn knowledge_delete_note(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    sqlx::query("DELETE FROM knowledge_notes WHERE id = ?")
        .bind(&id).execute(&state.db).await.map_err(|e| e.to_string())?;
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
        Ok(c) => c,
        Err(_) => return Ok(json!([])),
    };
    let embeddings = match client.embed(&[q]).await {
        Ok(e) => e,
        Err(_) => return Ok(json!([])),
    };
    let emb = match embeddings.into_iter().next() {
        Some(e) => e,
        None => return Ok(json!([])),
    };
    let results = combined_search(&state.db, &emb, top_k).await.map_err(|e| e.to_string())?;
    Ok(json!(results.into_iter().map(|r| json!({ "id": r.id, "content": r.content, "source": r.source, "score": r.score })).collect::<Vec<_>>()))
}

// ── Helper ───────────────────────────────────────────────────────

fn note_row_to_json(r: &sqlx::sqlite::SqliteRow) -> serde_json::Value {
    let tags_str: String = r.get::<Option<String>, _>("tags").unwrap_or_else(|| "[]".into());
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
