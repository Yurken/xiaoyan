use crate::llm::{LlmClient, LlmMessage};
use crate::rag::combined_search;
use crate::state::AppState;
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
    .ok_or("Session not found")?;

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
    let ctx_type = context_type.unwrap_or_else(|| "general".into());

    let sid = if let Some(id) = session_id {
        let _ = sqlx::query("UPDATE chat_sessions SET updated_at = ? WHERE id = ?")
            .bind(&now).bind(&id).execute(&state.db).await;
        id
    } else {
        let id = Uuid::new_v4().to_string();
        let title: String = message.chars().take(40).collect::<String>()
            + if message.chars().count() > 40 { "…" } else { "" };
        sqlx::query(
            "INSERT INTO chat_sessions (id, title, context_type, context_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(&id).bind(&title).bind(&ctx_type).bind(&context_id).bind(&now).bind(&now)
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
        match run_chat(&app, &db, &settings, &rid, &sid_clone, &message, &ctx_type, &context_id, history).await {
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

    let full = if multi_agent {
        run_agentic(app, db, settings, &client, request_id, session_id, message, context_type, context_id, &history).await?
    } else {
        run_simple(app, &client, settings, request_id, message, &history).await?
    };

    let msg_id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    sqlx::query("INSERT INTO chat_messages (id, session_id, role, content, created_at) VALUES (?, ?, 'assistant', ?, ?)")
        .bind(&msg_id).bind(session_id).bind(&full).bind(&now)
        .execute(db).await?;

    let _ = app.emit("chat:done", json!({ "request_id": request_id }));
    Ok(())
}

async fn run_simple(
    app: &tauri::AppHandle,
    client: &LlmClient,
    settings: &HashMap<String, String>,
    request_id: &str,
    message: &str,
    history: &[LlmMessage],
) -> anyhow::Result<String> {
    let mut msgs = vec![LlmMessage::system("你是智研 Copilot，一个专注于学术研究的 AI 助手。请用中文回答。")];
    msgs.extend_from_slice(history);
    msgs.push(LlmMessage::user(message));
    let temperature: f32 = settings.get("multi_agent_synthesis_temperature").and_then(|v| v.parse().ok()).unwrap_or(0.4);
    let model = settings.get("multi_agent_synthesis_model").and_then(|m| if m.is_empty() { None } else { Some(m.clone()) });
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
    history: &[LlmMessage],
) -> anyhow::Result<String> {
    let enabled: Vec<&str> = settings
        .get("multi_agent_enabled_agents")
        .map(|v| v.as_str())
        .unwrap_or("retrieval,synthesis")
        .split(',').map(|s| s.trim()).collect();

    let max_steps: usize = settings.get("multi_agent_max_steps").and_then(|v| v.parse().ok()).unwrap_or(4);
    let selected = select_agents(message, context_type, &enabled, max_steps);

    let plan: Vec<serde_json::Value> = selected.iter()
        .map(|a| json!({ "agent_name": a, "title": agent_title(a), "goal": agent_goal(a) }))
        .collect();
    let _ = app.emit("chat:plan", json!({ "request_id": request_id, "plan": plan }));

    let mut context_parts: Vec<String> = Vec::new();
    let worker_temp: f32 = settings.get("multi_agent_worker_temperature").and_then(|v| v.parse().ok()).unwrap_or(0.3);
    let worker_model = settings.get("multi_agent_worker_model").and_then(|m| if m.is_empty() { None } else { Some(m.clone()) });

    for (idx, agent_name) in selected.iter().enumerate() {
        if *agent_name == "synthesis" { continue; }

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
    let synthesis_temp: f32 = settings.get("multi_agent_synthesis_temperature").and_then(|v| v.parse().ok()).unwrap_or(0.4);
    let synthesis_model = settings.get("multi_agent_synthesis_model").and_then(|m| if m.is_empty() { None } else { Some(m.clone()) });
    let ctx = context_parts.join("\n\n---\n\n");
    let synthesis_prompt = if ctx.is_empty() {
        message.to_string()
    } else {
        format!("以下是各 agent 的分析结果：\n\n{}\n\n---\n\n请综合上述内容，给出针对问题「{}」的完整、结构化回答：", ctx, message)
    };

    let mut synthesis_msgs = vec![LlmMessage::system(
        "你是智研 Copilot 的综合分析员。请整合各 agent 产出，给出权威、结构化的最终答复，使用中文。",
    )];
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
    match agent_name {
        "retrieval" => {
            if let Ok(embed_client) = LlmClient::embed_client_from_settings(settings) {
                if let Ok(embeddings) = embed_client.embed(&[message.to_string()]).await {
                    if let Some(emb) = embeddings.into_iter().next() {
                        let top_k: usize = settings.get("rag_top_k").and_then(|v| v.parse().ok()).unwrap_or(5);
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
            let prompt = format!("请分析以下论文内容，回答问题：「{}」\n\n论文内容：\n{}", message, preview);
            let msgs = vec![LlmMessage::system("你是一位资深论文分析专家。"), LlmMessage::user(&prompt)];
            client.chat(&msgs, model, temperature).await
        }
        "planner" => {
            let prompt = format!("请为研究方向「{}」设计学习路径。背景：{}", message, prior_context.join("; "));
            let msgs = vec![LlmMessage::system("你是一位学术导师。"), LlmMessage::user(&prompt)];
            client.chat(&msgs, model, temperature).await
        }
        "literature_scout" => {
            let prompt = format!("请列出与「{}」最相关的核心论文（标题、作者、年份、核心贡献）。", message);
            let msgs = vec![LlmMessage::system("你是一位文献调研专家。"), LlmMessage::user(&prompt)];
            client.chat(&msgs, model, temperature).await
        }
        "survey" => {
            let prompt = format!(
                "请为「{}」领域撰写结构化文献综述，涵盖发展历程、主要方法、对比分析与未来趋势。\n\n参考：{}",
                message, prior_context.join("\n\n")
            );
            let msgs = vec![LlmMessage::system("你是一位综述写作专家。"), LlmMessage::user(&prompt)];
            client.chat(&msgs, model, temperature).await
        }
        "reproduction" => {
            let text = paper_text(db, context_id).await;
            let preview = if text.len() > 6000 { &text[..6000] } else { &text };
            let prompt = format!("请给出论文复现指南，重点回答：「{}」\n\n论文内容：{}", message, preview);
            let msgs = vec![LlmMessage::system("你是一位 ML 工程师，专注于论文复现。"), LlmMessage::user(&prompt)];
            client.chat(&msgs, model, temperature).await
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

// ── Agent selection ─────────────────────────────────────────────

fn select_agents<'a>(message: &str, context_type: &str, enabled: &[&'a str], max_steps: usize) -> Vec<&'a str> {
    fn add<'a>(list: &mut Vec<&'a str>, enabled: &[&'a str], name: &'a str) {
        if enabled.contains(&name) && !list.contains(&name) { list.push(name); }
    }
    let mut agents: Vec<&'a str> = Vec::new();
    add(&mut agents, enabled, "retrieval");
    if ["研究方向","规划","学习路径","roadmap","入门","方向"].iter().any(|k| message.contains(k)) {
        add(&mut agents, enabled, "planner");
    }
    if ["综述","survey","文献","论文推荐","最新研究","领域现状","调研"].iter().any(|k| message.contains(k)) {
        add(&mut agents, enabled, "literature_scout");
        add(&mut agents, enabled, "survey");
    }
    if context_type == "paper" || ["论文","创新点","方法","实验","局限","精读"].iter().any(|k| message.contains(k)) {
        add(&mut agents, enabled, "paper_analyst");
    }
    if context_type == "paper" && ["复现","reproduce","训练","实验配置","实现"].iter().any(|k| message.contains(k)) {
        add(&mut agents, enabled, "reproduction");
    }
    let mut result: Vec<&'a str> = agents.iter().filter(|&&a| a != "synthesis").copied().take(max_steps).collect();
    if enabled.contains(&"synthesis") { result.push("synthesis"); }
    result
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
        "synthesis" => "汇总各 agent 结果并组织为用户可直接使用的答复",
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
