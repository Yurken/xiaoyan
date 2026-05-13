use crate::agent_graph::run_agentic_graph;
use crate::agent_nodes::{agent_goal, agent_title};
use crate::assistant_prompts::{main_chat_system, supervisor_system};
use crate::commands::memory::is_long_term_memory_enabled;
use crate::llm::{
    resolve_model, resolve_temperature, web_search_tool_definition, LlmClient, LlmMessage,
    StreamOutcome,
};
use crate::web_search::web_search;
use crate::services::chat_context_service::{build_chat_context_summary, collect_chat_sources};
use crate::state::AppState;
use serde::Deserialize;
use serde_json::json;
use sqlx::Row;
use std::collections::HashMap;
use tauri::{Emitter, State};
use uuid::Uuid;

// ── Session management ──────────────────────────────────────────

#[tauri::command]
pub async fn chat_list_sessions(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    let rows = sqlx::query(
        "SELECT id, title, context_type, context_id, tag, created_at, updated_at FROM chat_sessions WHERE tag = '0' ORDER BY updated_at DESC",
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    let list: Vec<serde_json::Value> = rows
        .iter()
        .map(|r| {
            json!({
                "id": r.get::<String, _>("id"),
                "title": r.get::<String, _>("title"),
                "context_type": r.get::<String, _>("context_type"),
                "context_id": r.get::<Option<String>, _>("context_id"),
                "tag": r.get::<String, _>("tag"),
                "created_at": r.get::<String, _>("created_at"),
                "updated_at": r.get::<Option<String>, _>("updated_at"),
            })
        })
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
pub async fn chat_delete_session(state: State<'_, AppState>, id: String) -> Result<(), String> {
    sqlx::query("DELETE FROM chat_sessions WHERE id = ?")
        .bind(&id)
        .execute(&state.db)
        .await
        .map_err(|e| e.to_string())?;
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
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
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
    chat_mode: Option<String>,
    tag: Option<String>,
    request_id: Option<String>,
) -> Result<serde_json::Value, String> {
    let request_id = request_id
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| Uuid::new_v4().to_string());
    let now = chrono::Utc::now().to_rfc3339();
    let normalized_context_id = context_id.and_then(|value| {
        let trimmed = value.trim().to_string();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    });
    let ctx_type = if context_type.as_deref() == Some("interest") && normalized_context_id.is_some()
    {
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
            + if message.chars().count() > 40 {
                "…"
            } else {
                ""
            };
        sqlx::query(
            "INSERT INTO chat_sessions (id, title, context_type, context_id, tag, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&id).bind(&title).bind(&ctx_type).bind(&normalized_context_id).bind(&tag.unwrap_or_else(|| "0".into())).bind(&now).bind(&now)
        .execute(&state.db).await.map_err(|e| e.to_string())?;
        id
    };

    // Save user message
    let msg_id = Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO chat_messages (id, session_id, role, content, created_at) VALUES (?, ?, 'user', ?, ?)")
        .bind(&msg_id).bind(&sid).bind(&message).bind(&now)
        .execute(&state.db).await.map_err(|e| e.to_string())?;

    let history = fetch_history(&state.db, &sid, 10)
        .await
        .map_err(|e| e.to_string())?;
    let settings = state.settings.read().await.clone();
    let long_term_memory_enabled = is_long_term_memory_enabled(&settings);
    if long_term_memory_enabled {
        let _ = crate::commands::memory::record_chat_prompt_event(
            &state.db,
            &sid,
            &ctx_type,
            normalized_context_id.as_deref(),
            &message,
        )
        .await;
    }
    let db = state.db.clone();
    let rid = request_id.clone();
    let sid_clone = sid.clone();
    let message_clone = message.clone();
    let ctx_type_clone = ctx_type.clone();
    let context_id_clone = normalized_context_id.clone();
    let chat_handles = state.chat_handles.clone();

    let handle = tokio::spawn(async move {
        let result = run_chat(
            &app,
            &db,
            &settings,
            &rid,
            &sid_clone,
            &message,
            &ctx_type,
            &normalized_context_id,
            chat_mode.as_deref().unwrap_or("task"),
            history,
        )
        .await;

        if let Err(e) = result {
            if long_term_memory_enabled {
                let _ = crate::commands::memory::record_chat_failure_event(
                    &db,
                    &sid_clone,
                    &ctx_type_clone,
                    context_id_clone.as_deref(),
                    &message_clone,
                    &e.to_string(),
                )
                .await;
            }
            let _ = app.emit(
                "chat:error",
                json!({ "request_id": rid, "error": e.to_string() }),
            );
        }
        let _ = app.emit("chat:done", json!({ "request_id": rid }));
        let _ = chat_handles.lock().await.remove(&rid);
    });

    let mut handles = state.chat_handles.lock().await;
    handles.insert(request_id.clone(), handle);
    if handles
        .get(&request_id)
        .is_some_and(|handle| handle.is_finished())
    {
        handles.remove(&request_id);
    }

    Ok(json!({ "request_id": request_id, "session_id": sid }))
}

#[tauri::command]
pub async fn chat_cancel(state: State<'_, AppState>, request_id: String) -> Result<(), String> {
    if let Some(handle) = state.chat_handles.lock().await.remove(&request_id) {
        handle.abort();
    }
    Ok(())
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
    chat_mode: &str,
    history: Vec<LlmMessage>,
) -> anyhow::Result<()> {
    let client = LlmClient::from_settings(settings)?;
    let multi_agent = settings
        .get("multi_agent_enabled")
        .map(|v| v == "true")
        .unwrap_or(true);
    let long_term_memory_enabled = is_long_term_memory_enabled(settings);
    let context_summary = build_chat_context_summary(
        db,
        context_type,
        context_id,
        message,
        long_term_memory_enabled,
    )
    .await;

    let use_direct_chat = chat_mode == "direct";

    let full = if !use_direct_chat && multi_agent {
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
        run_simple(
            app,
            &client,
            settings,
            request_id,
            message,
            &context_summary,
            &history,
        )
        .await?
    };

    let sources = collect_chat_sources(db, settings, message).await;
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

    if long_term_memory_enabled {
        let _ = crate::commands::memory::record_chat_completion_event(
            db,
            session_id,
            context_type,
            context_id.as_deref(),
            message,
            &full,
            sources.len(),
        )
        .await;
    }

    if !sources.is_empty() {
        let _ = app.emit(
            "chat:sources",
            json!({ "request_id": request_id, "value": sources }),
        );
    }
    Ok(())
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
    let app_ref = app.clone();

    let web_search_enabled = settings
        .get("web_search_enabled")
        .map(|v| v == "true")
        .unwrap_or(false);
    let max_tool_rounds: usize = settings
        .get("web_search_max_rounds")
        .and_then(|v| v.parse().ok())
        .unwrap_or(3);

    let tools = if web_search_enabled {
        vec![web_search_tool_definition()]
    } else {
        vec![]
    };

    let mut tool_rounds = 0usize;

    loop {
        let outcome = if tools.is_empty() || tool_rounds >= max_tool_rounds {
            let text = client
                .stream_chat(&msgs, model.as_deref(), temperature, {
                    let app = app_ref.clone();
                    let rid = rid.clone();
                    move |delta| {
                        let _ = app.emit("chat:delta", json!({ "request_id": rid, "delta": delta }));
                    }
                })
                .await?;
            StreamOutcome::TextCompleted(text)
        } else {
            client
                .stream_chat_with_tools(&msgs, &tools, model.as_deref(), temperature, {
                    let app = app_ref.clone();
                    let rid = rid.clone();
                    move |delta| {
                        let _ = app.emit("chat:delta", json!({ "request_id": rid, "delta": delta }));
                    }
                })
                .await?
        };

        match outcome {
            StreamOutcome::TextCompleted(text) => return Ok(text),
            StreamOutcome::ToolCalls(tool_calls) => {
                tool_rounds += 1;
                msgs.push(LlmMessage::assistant_with_tool_calls(tool_calls.clone()));

                for tc in &tool_calls {
                    if tc.name == "web_search" {
                        let query: String = serde_json::from_str::<serde_json::Value>(&tc.arguments)
                            .ok()
                            .and_then(|v| v["query"].as_str().map(|s| s.to_string()))
                            .unwrap_or_default();

                        let _ = app_ref.emit(
                            "chat:searching",
                            json!({ "request_id": rid, "query": query }),
                        );

                        if query.is_empty() {
                            msgs.push(LlmMessage::tool(&tc.id, "搜索查询为空，请提供有效的搜索词。"));
                            continue;
                        }

                        match web_search(&query).await {
                            Ok(results) => {
                                msgs.push(LlmMessage::tool(&tc.id, &results));
                            }
                            Err(e) => {
                                msgs.push(LlmMessage::tool(
                                    &tc.id,
                                    format!("搜索失败：{}", e),
                                ));
                            }
                        }
                    }
                }

                if tool_rounds >= max_tool_rounds {
                    msgs.push(LlmMessage::user(
                        "已达到搜索次数上限，请基于已有信息给出当前最佳回答，无需再调用搜索工具。",
                    ));
                }
            }
        }
    }
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

    let plan: Vec<serde_json::Value> = selected
        .iter()
        .map(|a| json!({ "agent_name": a, "title": agent_title(a), "goal": agent_goal(a) }))
        .collect();
    let _ = app.emit(
        "chat:plan",
        json!({ "request_id": request_id, "plan": plan }),
    );

    run_agentic_graph(
        app,
        db,
        settings,
        client,
        request_id,
        session_id,
        message,
        context_type,
        context_id,
        context_summary,
        history,
        selected,
    )
    .await
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
        &[
            "综述",
            "survey",
            "领域现状",
            "调研",
            "相关工作",
            "趋势",
            "脉络",
            "对比",
        ],
    );
    let asks_for_related_work = contains_any(
        message,
        &[
            "相关工作",
            "benchmark",
            "baseline",
            "领域定位",
            "脉络",
            "对比工作",
        ],
    );
    let asks_for_paper_analysis = is_paper_context
        && contains_any(
            message,
            &[
                "论文",
                "创新点",
                "方法",
                "实验",
                "局限",
                "精读",
                "ablation",
                "消融",
                "细节",
            ],
        );
    let asks_for_reproduction = is_paper_context
        && contains_any(
            message,
            &[
                "复现",
                "reproduce",
                "训练",
                "实验配置",
                "实现",
                "代码",
                "工程",
                "跑通",
                "环境",
                "超参数",
            ],
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
    if is_research_workbench_task || asks_for_survey || (is_paper_context && asks_for_related_work)
    {
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
        "请为一次小妍科研对话选择最合适的专项 Agent。\n\
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
    let response = client
        .chat(&messages, model.as_deref(), temperature)
        .await?;
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

// ── History helper ──────────────────────────────────────────────

async fn fetch_history(
    db: &sqlx::SqlitePool,
    session_id: &str,
    limit: i64,
) -> anyhow::Result<Vec<LlmMessage>> {
    let rows = sqlx::query(
        "SELECT role, content FROM (SELECT role, content, created_at FROM chat_messages WHERE session_id = ? ORDER BY created_at DESC LIMIT ?) ORDER BY created_at ASC",
    )
    .bind(session_id).bind(limit)
    .fetch_all(db).await?;
    Ok(rows
        .iter()
        .map(|r| LlmMessage {
            role: r.get("role"),
            content: r.get("content"),
            tool_call_id: None,
            tool_calls: None,
        })
        .collect())
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
        let selected =
            normalize_selected_agents(vec!["retrieval".to_string()], &enabled_agents(), 0);
        assert_eq!(selected, vec!["retrieval".to_string()]);
    }
}
