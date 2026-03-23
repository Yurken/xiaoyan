use crate::assistant_prompts::{main_chat_system, specialist_system, supervisor_system, synthesis_system};
use crate::commands::knowledge::ResearchInterestProfilePayload;
use crate::llm::{resolve_model, resolve_temperature, resolve_temperature_chain, LlmClient, LlmMessage};
use crate::rag::combined_search;
use crate::state::AppState;
use serde::Deserialize;
use serde_json::json;
use sqlx::Row;
use std::collections::HashMap;
use tauri::{Emitter, State};
use uuid::Uuid;

// ── Session management ──────────────────────────────────────────

#[tauri::command]
pub async fn chat_list_sessions(
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let rows = sqlx::query(
        "SELECT id, title, context_type, context_id, created_at, updated_at FROM chat_sessions ORDER BY updated_at DESC",
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    let list: Vec<serde_json::Value> = rows
        .iter()
        .map(|r| json!({
            "id": r.get::<String, _>("id"),
            "title": r.get::<String, _>("title"),
            "context_type": r.get::<String, _>("context_type"),
            "context_id": r.get::<Option<String>, _>("context_id"),
            "created_at": r.get::<String, _>("created_at"),
            "updated_at": r.get::<Option<String>, _>("updated_at"),
        }))
        .collect();
    Ok(json!(list))
}

#[tauri::command]
pub async fn chat_get_session(
    state: State<'_, AppState>,
    id: String,
) -> Result<serde_json::Value, String> {
    let r = sqlx::query(
        "SELECT id, title, context_type, context_id, created_at, updated_at FROM chat_sessions WHERE id = ?",
    )
    .bind(&id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| e.to_string())?
    .ok_or("未找到对应会话。")?;

    let msgs = sqlx::query(
        "SELECT id, role, content, sources, created_at FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC",
    )
    .bind(&id)
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    let messages: Vec<serde_json::Value> = msgs
        .iter()
        .map(|m| {
            let src: Option<String> = m.get("sources");
            json!({
                "id": m.get::<String, _>("id"),
                "role": m.get::<String, _>("role"),
                "content": m.get::<String, _>("content"),
                "sources": src.as_deref().and_then(|s| serde_json::from_str::<serde_json::Value>(s).ok()),
                "created_at": m.get::<String, _>("created_at"),
            })
        })
        .collect();

    Ok(json!({
        "id": r.get::<String, _>("id"),
        "title": r.get::<String, _>("title"),
        "context_type": r.get::<String, _>("context_type"),
        "context_id": r.get::<Option<String>, _>("context_id"),
        "created_at": r.get::<String, _>("created_at"),
        "updated_at": r.get::<Option<String>, _>("updated_at"),
        "messages": messages,
    }))
}

#[tauri::command]
pub async fn chat_delete_session(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    sqlx::query("DELETE FROM chat_sessions WHERE id = ?")
        .bind(&id).execute(&state.db).await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn chat_update_session_context(
    state: State<'_, AppState>,
    id: String,
    context_type: String,
    context_id: Option<String>,
) -> Result<serde_json::Value, String> {
    let now = chrono::Utc::now().to_rfc3339();
    let normalized_context_id = context_id.and_then(|value| {
        let trimmed = value.trim().to_string();
        if trimmed.is_empty() { None } else { Some(trimmed) }
    });
    let normalized_context_type = if context_type == "interest" && normalized_context_id.is_some() {
        "interest".to_string()
    } else {
        "general".to_string()
    };

    sqlx::query(
        "UPDATE chat_sessions SET context_type = ?, context_id = ?, updated_at = ? WHERE id = ?",
    )
    .bind(&normalized_context_type)
    .bind(&normalized_context_id)
    .bind(&now)
    .bind(&id)
    .execute(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    let row = sqlx::query(
        "SELECT id, title, context_type, context_id, created_at, updated_at FROM chat_sessions WHERE id = ?",
    )
    .bind(&id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| e.to_string())?
    .ok_or("未找到对应会话。")?;

    Ok(json!({
        "id": row.get::<String, _>("id"),
        "title": row.get::<String, _>("title"),
        "context_type": row.get::<String, _>("context_type"),
        "context_id": row.get::<Option<String>, _>("context_id"),
        "created_at": row.get::<String, _>("created_at"),
        "updated_at": row.get::<Option<String>, _>("updated_at"),
    }))
}

#[tauri::command]
pub async fn chat_list_agent_runs(
    state: State<'_, AppState>,
    session_id: String,
    request_id: Option<String>,
) -> Result<serde_json::Value, String> {
    let run_rows = if let Some(ref rid) = request_id {
        sqlx::query(
            "SELECT id, session_id, request_id, parent_run_id, agent_name, step_name, status, order_index, summary, error, created_at, updated_at
             FROM agent_runs WHERE session_id = ? AND request_id = ? ORDER BY order_index ASC",
        )
        .bind(&session_id).bind(rid)
        .fetch_all(&state.db).await.map_err(|e| e.to_string())?
    } else {
        sqlx::query(
            "SELECT id, session_id, request_id, parent_run_id, agent_name, step_name, status, order_index, summary, error, created_at, updated_at
             FROM agent_runs WHERE session_id = ? ORDER BY created_at DESC LIMIT 50",
        )
        .bind(&session_id)
        .fetch_all(&state.db).await.map_err(|e| e.to_string())?
    };

    let mut result = Vec::new();
    for run in &run_rows {
        let run_id: String = run.get("id");
        let artifacts = sqlx::query(
            "SELECT id, run_id, artifact_type, title, content, created_at FROM agent_artifacts WHERE run_id = ? ORDER BY created_at ASC",
        )
        .bind(&run_id)
        .fetch_all(&state.db).await.unwrap_or_default();

        result.push(json!({
            "id": run_id,
            "session_id": run.get::<String, _>("session_id"),
            "request_id": run.get::<String, _>("request_id"),
            "parent_run_id": run.get::<Option<String>, _>("parent_run_id"),
            "agent_name": run.get::<String, _>("agent_name"),
            "step_name": run.get::<String, _>("step_name"),
            "status": run.get::<String, _>("status"),
            "order_index": run.get::<i64, _>("order_index"),
            "summary": run.get::<Option<String>, _>("summary"),
            "error": run.get::<Option<String>, _>("error"),
            "created_at": run.get::<String, _>("created_at"),
            "updated_at": run.get::<String, _>("updated_at"),
            "artifacts": artifacts.iter().map(|a| json!({
                "id": a.get::<String, _>("id"),
                "run_id": a.get::<String, _>("run_id"),
                "artifact_type": a.get::<String, _>("artifact_type"),
                "title": a.get::<String, _>("title"),
                "content": a.get::<String, _>("content"),
                "created_at": a.get::<String, _>("created_at"),
            })).collect::<Vec<_>>(),
        }));
    }
    Ok(json!(result))
}

// ── Chat stream ─────────────────────────────────────────────────

#[tauri::command]
pub async fn chat_stream(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    message: String,
    session_id: Option<String>,
    context_type: Option<String>,
    context_id: Option<String>,
) -> Result<serde_json::Value, String> {
    let request_id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let normalized_context_id = context_id.and_then(|value| {
        let trimmed = value.trim().to_string();
        if trimmed.is_empty() { None } else { Some(trimmed) }
    });
    let ctx_type = if context_type.as_deref() == Some("interest") && normalized_context_id.is_some() {
        "interest".to_string()
    } else {
        "general".to_string()
    };

    let sid = if let Some(id) = session_id {
        let _ = sqlx::query(
            "UPDATE chat_sessions SET context_type = ?, context_id = ?, updated_at = ? WHERE id = ?",
        )
            .bind(&ctx_type)
            .bind(&normalized_context_id)
            .bind(&now)
            .bind(&id)
            .execute(&state.db)
            .await;
        id
    } else {
        let id = Uuid::new_v4().to_string();
        let title: String = message.chars().take(40).collect::<String>()
            + if message.chars().count() > 40 { "…" } else { "" };
        sqlx::query(
            "INSERT INTO chat_sessions (id, title, context_type, context_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(&id).bind(&title).bind(&ctx_type).bind(&normalized_context_id).bind(&now).bind(&now)
        .execute(&state.db).await.map_err(|e| e.to_string())?;
        id
    };

    // Save user message
    let msg_id = Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO chat_messages (id, session_id, role, content, created_at) VALUES (?, ?, 'user', ?, ?)")
        .bind(&msg_id).bind(&sid).bind(&message).bind(&now)
        .execute(&state.db).await.map_err(|e| e.to_string())?;

    let history = fetch_history(&state.db, &sid, 10).await.map_err(|e| e.to_string())?;
    let settings = state.settings.read().await.clone();
    let db = state.db.clone();
    let rid = request_id.clone();
    let sid_clone = sid.clone();

    tokio::spawn(async move {
        match run_chat(&app, &db, &settings, &rid, &sid_clone, &message, &ctx_type, &normalized_context_id, history).await {
            Ok(()) => {}
            Err(e) => { let _ = app.emit("chat:error", json!({ "request_id": rid, "error": e.to_string() })); }
        }
    });

    Ok(json!({ "request_id": request_id, "session_id": sid }))
}

// ── Core orchestration ──────────────────────────────────────────

async fn run_chat(
    app: &tauri::AppHandle,
    db: &sqlx::SqlitePool,
    settings: &HashMap<String, String>,
    request_id: &str,
    session_id: &str,
    message: &str,
    context_type: &str,
    context_id: &Option<String>,
    history: Vec<LlmMessage>,
) -> anyhow::Result<()> {
    let client = LlmClient::from_settings(settings)?;
    let multi_agent = settings.get("multi_agent_enabled").map(|v| v == "true").unwrap_or(true);
    let context_summary = load_context_summary(db, context_type, context_id).await;

    let full = if multi_agent {
        run_agentic(
            app,
            db,
            settings,
            &client,
            request_id,
            session_id,
            message,
            context_type,
            context_id,
            &context_summary,
            &history,
        )
        .await?
    } else {
        run_simple(app, &client, settings, request_id, message, &context_summary, &history).await?
    };

    let sources = collect_sources(db, settings, message).await;
    let sources_json = if sources.is_empty() {
        None
    } else {
        Some(serde_json::to_string(&sources)?)
    };

    let msg_id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    sqlx::query("INSERT INTO chat_messages (id, session_id, role, content, sources, created_at) VALUES (?, ?, 'assistant', ?, ?, ?)")
        .bind(&msg_id).bind(session_id).bind(&full).bind(&sources_json).bind(&now)
        .execute(db).await?;

    if !sources.is_empty() {
        let _ = app.emit("chat:sources", json!({ "request_id": request_id, "value": sources }));
    }
    let _ = app.emit("chat:done", json!({ "request_id": request_id }));
    Ok(())
}

async fn collect_sources(
    db: &sqlx::SqlitePool,
    settings: &HashMap<String, String>,
    message: &str,
) -> Vec<serde_json::Value> {
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

    let top_k = settings.get("rag_top_k").and_then(|v| v.parse().ok()).unwrap_or(5);
    let results = match combined_search(db, &embedding, top_k).await {
        Ok(value) => value,
        Err(_) => return Vec::new(),
    };

    results
        .into_iter()
        .map(|item| json!({ "content": item.content, "source": item.source, "url": item.url }))
        .collect()
}

async fn run_simple(
    app: &tauri::AppHandle,
    client: &LlmClient,
    settings: &HashMap<String, String>,
    request_id: &str,
    message: &str,
    context_summary: &str,
    history: &[LlmMessage],
) -> anyhow::Result<String> {
    let system_prompt = main_chat_system(context_summary);
    let mut msgs = vec![LlmMessage::system(&system_prompt)];
    msgs.extend_from_slice(history);
    msgs.push(LlmMessage::user(message));
    let temperature = resolve_temperature(settings, "copilot_simple_temperature", 0.4);
    let model = resolve_model(settings, &["copilot_simple_model"]);
    let rid = request_id.to_string();
    let app = app.clone();
    client.stream_chat(&msgs, model.as_deref(), temperature, move |delta| {
        let _ = app.emit("chat:delta", json!({ "request_id": rid, "delta": delta }));
    }).await
}

async fn run_agentic(
    app: &tauri::AppHandle,
    db: &sqlx::SqlitePool,
    settings: &HashMap<String, String>,
    client: &LlmClient,
    request_id: &str,
    session_id: &str,
    message: &str,
    context_type: &str,
    context_id: &Option<String>,
    context_summary: &str,
    history: &[LlmMessage],
) -> anyhow::Result<String> {
    let enabled: Vec<String> = settings
        .get("multi_agent_enabled_agents")
        .map(|v| v.as_str())
        .unwrap_or("retrieval,synthesis")
        .split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();

    let max_steps: usize = settings
        .get("multi_agent_max_steps")
        .and_then(|v| v.parse().ok())
        .filter(|value| *value > 0)
        .unwrap_or(6);
    let routing_mode = settings
        .get("multi_agent_routing_mode")
        .map(|value| value.as_str())
        .unwrap_or("hybrid");
    let selected = select_agents(
        client,
        settings,
        message,
        context_type,
        &enabled,
        max_steps,
        routing_mode,
    )
    .await;

    let plan: Vec<serde_json::Value> = selected.iter()
        .map(|a| json!({ "agent_name": a, "title": agent_title(a), "goal": agent_goal(a) }))
        .collect();
    let _ = app.emit("chat:plan", json!({ "request_id": request_id, "plan": plan }));

    let mut context_parts: Vec<String> = if context_summary.trim().is_empty() {
        Vec::new()
    } else {
        vec![format!("[当前研究工作台]\n{}", context_summary)]
    };
    let worker_temp = resolve_temperature(settings, "multi_agent_worker_temperature", 0.3);
    let worker_model = resolve_model(settings, &["multi_agent_worker_model"]);

    for (idx, agent_name) in selected.iter().enumerate() {
        if agent_name == "synthesis" { continue; }

        let run_id = Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();
        let order = idx as i64;

        sqlx::query(
            "INSERT INTO agent_runs (id, session_id, request_id, agent_name, step_name, status, order_index, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, 'running', ?, ?, ?)",
        )
        .bind(&run_id).bind(session_id).bind(request_id).bind(agent_name)
        .bind(agent_title(agent_name)).bind(order).bind(&now).bind(&now)
        .execute(db).await?;

        let run_payload = json!({
            "id": run_id, "session_id": session_id, "request_id": request_id,
            "agent_name": agent_name, "step_name": agent_title(agent_name),
            "status": "running", "order_index": order, "created_at": now, "updated_at": now, "artifacts": [],
        });
        let _ = app.emit("chat:agent_start", json!({ "request_id": request_id, "value": run_payload }));

        let agent_output = execute_agent(
            client, db, settings, agent_name, message,
            context_type, context_id, &context_parts, history,
            worker_model.as_deref(), worker_temp,
        ).await;

        let done_now = chrono::Utc::now().to_rfc3339();
        match agent_output {
            Ok(output) => {
                if !output.is_empty() {
                    context_parts.push(format!("[{}]\n{}", agent_title(agent_name), output));
                }
                sqlx::query("UPDATE agent_runs SET status = 'done', summary = ?, updated_at = ? WHERE id = ?")
                    .bind(&output).bind(&done_now).bind(&run_id).execute(db).await?;
                let done_payload = json!({
                    "id": run_id, "session_id": session_id, "request_id": request_id,
                    "agent_name": agent_name, "step_name": agent_title(agent_name),
                    "status": "done", "summary": output, "order_index": order,
                    "created_at": now, "updated_at": done_now, "artifacts": [],
                });
                let _ = app.emit("chat:agent_complete", json!({ "request_id": request_id, "value": done_payload }));
            }
            Err(e) => {
                let err_str = e.to_string();
                sqlx::query("UPDATE agent_runs SET status = 'failed', error = ?, updated_at = ? WHERE id = ?")
                    .bind(&err_str).bind(&done_now).bind(&run_id).execute(db).await?;
                let _ = app.emit("chat:agent_complete", json!({ "request_id": request_id, "value": {
                    "id": run_id, "agent_name": agent_name, "status": "failed", "error": err_str
                }}));
            }
        }
    }

    // Synthesis — stream
    let synthesis_temp = resolve_temperature(settings, "multi_agent_synthesis_temperature", 0.4);
    let synthesis_model = resolve_model(settings, &["multi_agent_synthesis_model"]);
    let ctx = context_parts.join("\n\n---\n\n");
    let synthesis_prompt = if ctx.is_empty() {
        message.to_string()
    } else {
        format!("以下是各个 Agent 的分析结果：\n\n{}\n\n---\n\n请综合上述内容，给出针对问题「{}」的完整、结构化回答。", ctx, message)
    };

    let mut synthesis_msgs = vec![LlmMessage::system(synthesis_system())];
    synthesis_msgs.extend_from_slice(history);
    synthesis_msgs.push(LlmMessage::user(&synthesis_prompt));

    let rid = request_id.to_string();
    let app_c = app.clone();
    client.stream_chat(&synthesis_msgs, synthesis_model.as_deref(), synthesis_temp, move |delta| {
        let _ = app_c.emit("chat:delta", json!({ "request_id": rid, "delta": delta }));
    }).await
}

// ── Agent executor ──────────────────────────────────────────────

async fn execute_agent(
    client: &LlmClient,
    db: &sqlx::SqlitePool,
    settings: &HashMap<String, String>,
    agent_name: &str,
    message: &str,
    context_type: &str,
    context_id: &Option<String>,
    prior_context: &[String],
    _history: &[LlmMessage],
    model: Option<&str>,
    temperature: f32,
) -> anyhow::Result<String> {
    let (agent_model, agent_temperature) =
        resolve_agent_model_config(settings, agent_name, model, temperature);

    match agent_name {
        "retrieval" => {
            if let Ok(embed_client) = LlmClient::embed_client_from_settings(settings) {
                if let Ok(embeddings) = embed_client.embed(&[message.to_string()]).await {
                    if let Some(emb) = embeddings.into_iter().next() {
                        let top_k: usize = settings
                            .get("multi_agent_search_limit")
                            .or_else(|| settings.get("rag_top_k"))
                            .and_then(|v| v.parse().ok())
                            .unwrap_or(5);
                        let results = combined_search(db, &emb, top_k).await.unwrap_or_default();
                        if results.is_empty() { return Ok(String::new()); }
                        return Ok(results.iter().map(|r| format!("来源：{}\n{}", r.source, r.content)).collect::<Vec<_>>().join("\n\n"));
                    }
                }
            }
            Ok(String::new())
        }
        "paper_analyst" => {
            let text = paper_text(db, context_id).await;
            let preview = if text.len() > 6000 { &text[..6000] } else { &text };
            let prompt = format!("请基于以下论文内容回答用户问题，结论应客观、准确、可追溯。\n\n用户问题：{}\n\n论文内容：\n{}", message, preview);
            let msgs = vec![
                LlmMessage::system(specialist_system(
                    "论文分析子 Agent",
                    "基于论文内容输出准确、结构化的分析结果。",
                    Some("不得编造论文中未出现的信息。"),
                )),
                LlmMessage::user(&prompt),
            ];
            client.chat(&msgs, agent_model.as_deref(), agent_temperature).await
        }
        "planner" => {
            let prompt = if context_type == "interest" && !prior_context.is_empty() {
                format!(
                    "你正在一个已规划的研究工作台中继续推进研究路线。\n\n当前上下文：\n{}\n\n请围绕用户问题给出下一步学习安排、实验推进建议或路线修订意见。\n用户问题：{}",
                    prior_context.join("\n\n"),
                    message,
                )
            } else {
                format!("请为研究方向「{}」设计学习路径。补充背景：{}", message, prior_context.join("; "))
            };
            let msgs = vec![
                LlmMessage::system(specialist_system(
                    "研究规划子 Agent",
                    "围绕用户问题输出分阶段、可执行的学习与研究推进建议。",
                    None,
                )),
                LlmMessage::user(&prompt),
            ];
            client.chat(&msgs, agent_model.as_deref(), agent_temperature).await
        }
        "literature_scout" => {
            let prompt = if context_type == "interest" && !prior_context.is_empty() {
                format!(
                    "这里是当前研究工作台的上下文：\n{}\n\n请围绕用户问题推荐最值得优先阅读的核心论文，输出标题、作者、年份、核心贡献，并说明为什么适合当前路线。\n用户问题：{}",
                    prior_context.join("\n\n"),
                    message,
                )
            } else {
                format!("请列出与「{}」最相关的核心论文，并说明标题、作者、年份和核心贡献。", message)
            };
            let msgs = vec![
                LlmMessage::system(specialist_system(
                    "文献调研子 Agent",
                    "推荐与当前问题最相关、最值得优先阅读的论文。",
                    Some("输出应尽量给出标题、作者、年份、核心贡献与推荐理由。"),
                )),
                LlmMessage::user(&prompt),
            ];
            client.chat(&msgs, agent_model.as_deref(), agent_temperature).await
        }
        "survey" => {
            let prompt = if context_type == "interest" && !prior_context.is_empty() {
                format!(
                    "请基于当前研究工作台上下文，为用户问题整理结构化综述或相关工作总结，重点服务于当前路线推进。\n\n上下文：\n{}\n\n用户问题：{}",
                    prior_context.join("\n\n"),
                    message,
                )
            } else {
                format!(
                    "请为「{}」领域撰写结构化文献综述，涵盖发展历程、主要方法、对比分析与未来趋势。\n\n参考：{}",
                    message, prior_context.join("\n\n")
                )
            };
            let msgs = vec![
                LlmMessage::system(specialist_system(
                    "综述写作子 Agent",
                    "输出结构化、客观、可用于研究推进的相关工作总结。",
                    Some("不得把未经证实的判断写成事实。"),
                )),
                LlmMessage::user(&prompt),
            ];
            client.chat(&msgs, agent_model.as_deref(), agent_temperature).await
        }
        "reproduction" => {
            let text = paper_text(db, context_id).await;
            let preview = if text.len() > 6000 { &text[..6000] } else { &text };
            let prompt = format!("请给出论文复现指南，并重点回答以下问题：{}\n\n论文内容：{}", message, preview);
            let msgs = vec![
                LlmMessage::system(specialist_system(
                    "论文复现子 Agent",
                    "输出可执行、风险明确的复现建议。",
                    Some("不得编造论文中未提供的实验细节。"),
                )),
                LlmMessage::user(&prompt),
            ];
            client.chat(&msgs, agent_model.as_deref(), agent_temperature).await
        }
        _ => Ok(String::new()),
    }
}

async fn paper_text(db: &sqlx::SqlitePool, context_id: &Option<String>) -> String {
    if let Some(pid) = context_id.as_deref() {
        sqlx::query("SELECT full_text FROM papers WHERE id = ?")
            .bind(pid)
            .fetch_optional(db)
            .await
            .ok()
            .flatten()
            .and_then(|r| r.get::<Option<String>, _>("full_text"))
            .unwrap_or_default()
    } else {
        String::new()
    }
}

async fn load_context_summary(
    db: &sqlx::SqlitePool,
    context_type: &str,
    context_id: &Option<String>,
) -> String {
    match context_type {
        "interest" => interest_context_summary(db, context_id).await,
        "paper" => paper_context_summary(db, context_id).await,
        _ => String::new(),
    }
}

async fn paper_context_summary(
    db: &sqlx::SqlitePool,
    context_id: &Option<String>,
) -> String {
    let Some(paper_id) = context_id.as_deref() else {
        return String::new();
    };

    let row = match sqlx::query(
        "SELECT title, abstract, status FROM papers WHERE id = ?",
    )
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

async fn interest_context_summary(
    db: &sqlx::SqlitePool,
    context_id: &Option<String>,
) -> String {
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
        .and_then(|value| serde_json::from_str::<serde_json::Value>(&value).ok())
        .unwrap_or_default();

    let mut lines = vec![format!("当前研究方向：{}", topic)];
    if !keywords.is_empty() {
        lines.push(format!("关键词：{}", keywords.join("、")));
    }
    if let Some(goal) = profile.goal.as_deref().filter(|value| !value.trim().is_empty()) {
        lines.push(format!("研究目标：{}", goal));
    }
    if let Some(background) = profile.background.as_deref().filter(|value| !value.trim().is_empty()) {
        lines.push(format!("当前基础：{}", background));
    }
    if let Some(time_budget) = profile.time_budget.as_deref().filter(|value| !value.trim().is_empty()) {
        lines.push(format!("时间预算：{}", time_budget));
    }
    if let Some(preferred_output) = profile.preferred_output.as_deref().filter(|value| !value.trim().is_empty()) {
        lines.push(format!("期望输出：{}", preferred_output));
    }
    if let Some(known_context) = profile.known_context.as_deref().filter(|value| !value.trim().is_empty()) {
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
                format!("{}{}", title, status.map(|value| format!("（{}）", value)).unwrap_or_default())
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

// ── Agent selection ─────────────────────────────────────────────

#[derive(Deserialize)]
struct RoutingDecision {
    agents: Vec<String>,
}

async fn select_agents(
    client: &LlmClient,
    settings: &HashMap<String, String>,
    message: &str,
    context_type: &str,
    enabled: &[String],
    max_steps: usize,
    routing_mode: &str,
) -> Vec<String> {
    let rule_selected = select_agents_by_rule(message, context_type, enabled, max_steps);

    let selected = match routing_mode {
        "rule" => rule_selected.clone(),
        "llm" => select_agents_by_llm(
            client,
            settings,
            message,
            context_type,
            enabled,
            max_steps,
            &[],
        )
        .await
        .unwrap_or_else(|_| rule_selected.clone()),
        _ => {
            let llm_selected = select_agents_by_llm(
                client,
                settings,
                message,
                context_type,
                enabled,
                max_steps,
                &rule_selected,
            )
            .await
            .unwrap_or_default();

            if llm_selected.is_empty() {
                rule_selected.clone()
            } else {
                merge_selected_agents(rule_selected.clone(), llm_selected, enabled, max_steps)
            }
        }
    };

    append_synthesis(selected, enabled)
}

fn select_agents_by_rule(
    message: &str,
    context_type: &str,
    enabled: &[String],
    max_steps: usize,
) -> Vec<String> {
    fn add(list: &mut Vec<String>, enabled: &[String], name: &str) {
        if enabled.iter().any(|item| item == name) && !list.iter().any(|item| item == name) {
            list.push(name.to_string());
        }
    }

    fn contains_any(message: &str, keywords: &[&str]) -> bool {
        keywords.iter().any(|keyword| message.contains(keyword))
    }

    let is_interest_context = context_type == "interest";
    let is_paper_context = context_type == "paper";
    let asks_for_planning = contains_any(
        message,
        &[
            "研究方向",
            "规划",
            "学习路径",
            "roadmap",
            "入门",
            "方向",
            "下一步",
            "阶段",
            "安排",
            "计划",
            "里程碑",
            "开题",
            "选题",
            "路线",
        ],
    );
    let asks_for_literature = contains_any(
        message,
        &[
            "综述",
            "survey",
            "文献",
            "论文推荐",
            "最新研究",
            "领域现状",
            "调研",
            "相关工作",
            "benchmark",
            "baseline",
            "代表论文",
            "阅读",
        ],
    );
    let asks_for_survey = contains_any(
        message,
        &["综述", "survey", "领域现状", "调研", "相关工作", "趋势", "脉络", "对比"],
    );
    let asks_for_related_work = contains_any(
        message,
        &["相关工作", "benchmark", "baseline", "领域定位", "脉络", "对比工作"],
    );
    let asks_for_paper_analysis = is_paper_context
        && contains_any(
            message,
            &["论文", "创新点", "方法", "实验", "局限", "精读", "ablation", "消融", "细节"],
        );
    let asks_for_reproduction = is_paper_context
        && contains_any(
            message,
            &["复现", "reproduce", "训练", "实验配置", "实现", "代码", "工程", "跑通", "环境", "超参数"],
        );
    let is_research_workbench_task = is_interest_context
        || (asks_for_planning && asks_for_literature)
        || contains_any(message, &["研究工作台", "路线推进", "路线修订", "开题准备"]);

    let mut agents: Vec<String> = Vec::new();
    add(&mut agents, enabled, "retrieval");
    if is_interest_context || asks_for_planning {
        add(&mut agents, enabled, "planner");
    }
    if is_interest_context || asks_for_literature || asks_for_survey || asks_for_related_work {
        add(&mut agents, enabled, "literature_scout");
    }
    if is_research_workbench_task || asks_for_survey || (is_paper_context && asks_for_related_work) {
        add(&mut agents, enabled, "survey");
    }
    if asks_for_paper_analysis || is_paper_context {
        add(&mut agents, enabled, "paper_analyst");
    }
    if asks_for_reproduction {
        add(&mut agents, enabled, "reproduction");
    }
    normalize_selected_agents(agents, enabled, max_steps)
}

async fn select_agents_by_llm(
    client: &LlmClient,
    settings: &HashMap<String, String>,
    message: &str,
    context_type: &str,
    enabled: &[String],
    max_steps: usize,
    rule_suggestion: &[String],
) -> anyhow::Result<Vec<String>> {
    let candidates: Vec<String> = enabled
        .iter()
        .filter(|item| item.as_str() != "synthesis")
        .cloned()
        .collect();

    if candidates.is_empty() {
        return Ok(Vec::new());
    }

    let model = resolve_model(settings, &["multi_agent_supervisor_model"]);
    let temperature = resolve_temperature(settings, "multi_agent_supervisor_temperature", 0.1);
    let rule_hint = if rule_suggestion.is_empty() {
        "无".to_string()
    } else {
        rule_suggestion.join("、")
    };

    let prompt = format!(
        "请为一次科研 Copilot 对话选择最合适的专项 Agent。\n\
用户问题：{message}\n\
上下文类型：{context_type}\n\
可选 Agent：{candidates}\n\
最多选择：{max_steps}\n\
规则模式建议：{rule_hint}\n\n\
选择原则：\n\
1. 不要机械地追求最少 Agent，而是要覆盖完成任务所需的关键分工。\n\
2. 对单点问题可以精简；对研究规划、路线推进、选题调研这类复合任务，通常应覆盖 4 个左右 worker。\n\
3. 如果问题需要证据、论文来源或已有上下文支持，通常应包含 retrieval。\n\
4. context_type 为 interest 时，planner 通常应该参与；若涉及论文线索、路线推进或领域现状，通常还应包含 literature_scout 与 survey。\n\
5. 只有在 context_type 为 paper 或用户明确要求精读单篇论文时，才选择 paper_analyst。\n\
6. 只有在 context_type 为 paper 且涉及实现、训练、实验配置或复现时，才选择 reproduction。\n\
7. 如果规则模式建议已经覆盖关键分工，除非明显多余，不要删掉这些关键 Agent。\n\n\
请只返回 JSON，对象格式必须为 {{\"agents\": [\"agent_name\"]}}。",
        candidates = candidates.join(", "),
    );

    let messages = vec![
        LlmMessage::system(supervisor_system()),
        LlmMessage::user(prompt),
    ];
    let response = client.chat(&messages, model.as_deref(), temperature).await?;
    let selected = parse_routing_decision(&response).unwrap_or_default();
    Ok(normalize_selected_agents(selected, enabled, max_steps))
}

fn parse_routing_decision(raw: &str) -> Option<Vec<String>> {
    serde_json::from_str::<RoutingDecision>(raw)
        .ok()
        .or_else(|| {
            let start = raw.find('{')?;
            let end = raw.rfind('}')?;
            serde_json::from_str::<RoutingDecision>(&raw[start..=end]).ok()
        })
        .map(|decision| decision.agents)
}

fn normalize_selected_agents(
    selected: Vec<String>,
    enabled: &[String],
    max_steps: usize,
) -> Vec<String> {
    let step_limit = max_steps.max(1);
    let mut result = Vec::new();

    for agent in selected {
        if agent == "synthesis" {
            continue;
        }
        if !enabled.iter().any(|item| item == &agent) {
            continue;
        }
        if result.iter().any(|item| item == &agent) {
            continue;
        }
        result.push(agent);
        if result.len() >= step_limit {
            break;
        }
    }

    if result.is_empty() {
        if enabled.iter().any(|item| item == "retrieval") {
            result.push("retrieval".to_string());
        } else if let Some(first) = enabled.iter().find(|item| item.as_str() != "synthesis") {
            result.push(first.clone());
        }
    }

    result
}

fn merge_selected_agents(
    baseline: Vec<String>,
    llm_selected: Vec<String>,
    enabled: &[String],
    max_steps: usize,
) -> Vec<String> {
    let mut merged = baseline;
    merged.extend(llm_selected);
    normalize_selected_agents(merged, enabled, max_steps)
}

fn append_synthesis(mut selected: Vec<String>, enabled: &[String]) -> Vec<String> {
    if enabled.iter().any(|item| item == "synthesis") {
        selected.push("synthesis".to_string());
    }
    selected
}

fn resolve_agent_model_config(
    settings: &HashMap<String, String>,
    agent_name: &str,
    default_model: Option<&str>,
    default_temperature: f32,
) -> (Option<String>, f32) {
    let model = match agent_name {
        "planner" => resolve_model(
            settings,
            &[
                "multi_agent_planner_model",
                "planner_generation_model",
                "planner_analysis_model",
            ],
        ),
        "literature_scout" => resolve_model(
            settings,
            &["multi_agent_literature_scout_model", "survey_planner_model"],
        ),
        "survey" => resolve_model(
            settings,
            &["multi_agent_survey_model", "survey_writer_model", "survey_planner_model"],
        ),
        "paper_analyst" => resolve_model(
            settings,
            &["multi_agent_paper_analyst_model", "paper_analysis_model"],
        ),
        "reproduction" => resolve_model(
            settings,
            &["multi_agent_reproduction_model", "paper_reproduction_model"],
        ),
        _ => None,
    }
    .or_else(|| default_model.map(|value| value.to_string()));

    let temperature = match agent_name {
        "planner" => resolve_temperature_chain(
            settings,
            &[
                "multi_agent_planner_temperature",
                "planner_generation_temperature",
                "planner_analysis_temperature",
            ],
            default_temperature,
        ),
        "literature_scout" => resolve_temperature_chain(
            settings,
            &[
                "multi_agent_literature_scout_temperature",
                "survey_planner_temperature",
            ],
            default_temperature,
        ),
        "survey" => resolve_temperature_chain(
            settings,
            &[
                "multi_agent_survey_temperature",
                "survey_writer_temperature",
                "survey_planner_temperature",
            ],
            default_temperature,
        ),
        "paper_analyst" => resolve_temperature_chain(
            settings,
            &[
                "multi_agent_paper_analyst_temperature",
                "paper_analysis_temperature",
            ],
            default_temperature,
        ),
        "reproduction" => resolve_temperature_chain(
            settings,
            &[
                "multi_agent_reproduction_temperature",
                "paper_reproduction_temperature",
            ],
            default_temperature,
        ),
        _ => default_temperature,
    };

    (model, temperature)
}

fn agent_title(name: &str) -> &str {
    match name {
        "retrieval" => "检索相关上下文", "planner" => "生成研究路径",
        "literature_scout" => "筛选候选论文", "survey" => "组织文献综述",
        "paper_analyst" => "解析当前论文", "reproduction" => "输出复现建议",
        "synthesis" => "整合最终回答", _ => name,
    }
}

fn agent_goal(name: &str) -> &str {
    match name {
        "retrieval" => "从知识库和论文内容中收集与当前问题直接相关的证据",
        "planner" => "围绕用户主题给出系统化学习和研究推进路径",
        "literature_scout" => "快速检索和整理该问题对应的核心论文与线索",
        "survey" => "把检索到的论文整理成结构化领域概览",
        "paper_analyst" => "提炼研究问题、方法、实验与局限",
        "reproduction" => "围绕当前论文给出复现链路和风险提示",
        "synthesis" => "汇总各 Agent 结果并组织为用户可直接使用的答复",
        _ => "处理任务",
    }
}

// ── History helper ──────────────────────────────────────────────

async fn fetch_history(db: &sqlx::SqlitePool, session_id: &str, limit: i64) -> anyhow::Result<Vec<LlmMessage>> {
    let rows = sqlx::query(
        "SELECT role, content FROM (SELECT role, content, created_at FROM chat_messages WHERE session_id = ? ORDER BY created_at DESC LIMIT ?) ORDER BY created_at ASC",
    )
    .bind(session_id).bind(limit)
    .fetch_all(db).await?;
    Ok(rows.iter().map(|r| LlmMessage { role: r.get("role"), content: r.get("content") }).collect())
}

#[cfg(test)]
mod tests {
    use super::{merge_selected_agents, normalize_selected_agents, select_agents_by_rule};

    fn enabled_agents() -> Vec<String> {
        [
            "retrieval",
            "planner",
            "literature_scout",
            "survey",
            "paper_analyst",
            "reproduction",
            "synthesis",
        ]
        .into_iter()
        .map(str::to_string)
        .collect()
    }

    #[test]
    fn interest_workspace_uses_four_research_workers() {
        let selected = select_agents_by_rule(
            "请结合当前路线规划下一步，并推荐核心论文和领域现状",
            "interest",
            &enabled_agents(),
            6,
        );

        assert_eq!(
            selected,
            vec![
                "retrieval".to_string(),
                "planner".to_string(),
                "literature_scout".to_string(),
                "survey".to_string(),
            ]
        );
    }

    #[test]
    fn paper_context_only_enables_paper_specific_agents_when_relevant() {
        let selected = select_agents_by_rule(
            "请分析这篇论文的方法、实验设计，并给我复现实现建议",
            "paper",
            &enabled_agents(),
            6,
        );

        assert_eq!(
            selected,
            vec![
                "retrieval".to_string(),
                "paper_analyst".to_string(),
                "reproduction".to_string(),
            ]
        );
    }

    #[test]
    fn hybrid_merge_keeps_rule_baseline() {
        let merged = merge_selected_agents(
            vec![
                "retrieval".to_string(),
                "planner".to_string(),
                "literature_scout".to_string(),
                "survey".to_string(),
            ],
            vec!["retrieval".to_string(), "planner".to_string()],
            &enabled_agents(),
            6,
        );

        assert_eq!(
            merged,
            vec![
                "retrieval".to_string(),
                "planner".to_string(),
                "literature_scout".to_string(),
                "survey".to_string(),
            ]
        );
    }

    #[test]
    fn zero_step_budget_still_keeps_one_worker() {
        let selected = normalize_selected_agents(vec!["retrieval".to_string()], &enabled_agents(), 0);
        assert_eq!(selected, vec!["retrieval".to_string()]);
    }
}
