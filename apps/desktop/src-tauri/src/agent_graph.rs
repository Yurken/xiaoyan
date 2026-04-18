use crate::agent_nodes::{agent_title, execute_agent_node};
use crate::assistant_prompts::synthesis_system;
use crate::commands::memory::{
    is_long_term_memory_enabled, record_agent_run_completion_event, record_agent_run_failure_event,
};
use crate::llm::{resolve_model, resolve_temperature, LlmClient, LlmMessage};
use anyhow::Result;
use serde_json::json;
use std::collections::{HashMap, HashSet};
use tauri::Emitter;
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
enum AgentNode {
    Start,
    Retrieval,
    Planner,
    LiteratureScout,
    Survey,
    PaperAnalyst,
    Reproduction,
    Synthesis,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum NodeStatus {
    Pending,
    Running,
    Done,
    Failed,
}

#[derive(Debug)]
struct AgentGraphState {
    statuses: HashMap<AgentNode, NodeStatus>,
    selected_agents: Vec<String>,
    context_parts: Vec<String>,
    outputs: HashMap<String, String>,
    failures: Vec<String>,
}

impl AgentGraphState {
    fn new(selected_agents: Vec<String>, context_parts: Vec<String>) -> Self {
        let mut statuses = HashMap::new();
        statuses.insert(AgentNode::Start, NodeStatus::Pending);
        statuses.insert(AgentNode::Synthesis, NodeStatus::Pending);
        for node in [
            AgentNode::Retrieval,
            AgentNode::Planner,
            AgentNode::LiteratureScout,
            AgentNode::Survey,
            AgentNode::PaperAnalyst,
            AgentNode::Reproduction,
        ] {
            statuses.insert(node, NodeStatus::Pending);
        }

        Self {
            statuses,
            selected_agents,
            context_parts,
            outputs: HashMap::new(),
            failures: Vec::new(),
        }
    }

    fn mark(&mut self, node: AgentNode, status: NodeStatus) {
        self.statuses.insert(node, status);
    }

    fn status(&self, node: AgentNode) -> NodeStatus {
        self.statuses
            .get(&node)
            .copied()
            .unwrap_or(NodeStatus::Pending)
    }
}

fn node_from_agent(name: &str) -> Option<AgentNode> {
    match name {
        "retrieval" => Some(AgentNode::Retrieval),
        "planner" => Some(AgentNode::Planner),
        "literature_scout" => Some(AgentNode::LiteratureScout),
        "survey" => Some(AgentNode::Survey),
        "paper_analyst" => Some(AgentNode::PaperAnalyst),
        "reproduction" => Some(AgentNode::Reproduction),
        "synthesis" => Some(AgentNode::Synthesis),
        _ => None,
    }
}

fn agent_from_node(node: AgentNode) -> Option<&'static str> {
    match node {
        AgentNode::Retrieval => Some("retrieval"),
        AgentNode::Planner => Some("planner"),
        AgentNode::LiteratureScout => Some("literature_scout"),
        AgentNode::Survey => Some("survey"),
        AgentNode::PaperAnalyst => Some("paper_analyst"),
        AgentNode::Reproduction => Some("reproduction"),
        AgentNode::Synthesis | AgentNode::Start => None,
    }
}

fn ordered_nodes() -> &'static [AgentNode] {
    &[
        AgentNode::Start,
        AgentNode::Retrieval,
        AgentNode::Planner,
        AgentNode::LiteratureScout,
        AgentNode::Survey,
        AgentNode::PaperAnalyst,
        AgentNode::Reproduction,
        AgentNode::Synthesis,
    ]
}

fn active_nodes(selected_agents: &[String]) -> HashSet<AgentNode> {
    let mut result = HashSet::from([AgentNode::Start, AgentNode::Synthesis]);
    for agent in selected_agents {
        if let Some(node) = node_from_agent(agent) {
            result.insert(node);
        }
    }
    result
}

fn predecessors(node: AgentNode, active: &HashSet<AgentNode>) -> Vec<AgentNode> {
    match node {
        AgentNode::Start => Vec::new(),
        AgentNode::Retrieval => vec![AgentNode::Start],
        AgentNode::Planner
        | AgentNode::LiteratureScout
        | AgentNode::Survey
        | AgentNode::PaperAnalyst
        | AgentNode::Reproduction => {
            if active.contains(&AgentNode::Retrieval) {
                vec![AgentNode::Retrieval]
            } else {
                vec![AgentNode::Start]
            }
        }
        AgentNode::Synthesis => {
            let mut deps = ordered_nodes()
                .iter()
                .copied()
                .filter(|candidate| {
                    *candidate != AgentNode::Start
                        && *candidate != AgentNode::Synthesis
                        && active.contains(candidate)
                })
                .collect::<Vec<_>>();
            if deps.is_empty() {
                deps.push(AgentNode::Start);
            }
            deps
        }
    }
}

fn is_node_ready(node: AgentNode, active: &HashSet<AgentNode>, state: &AgentGraphState) -> bool {
    if !active.contains(&node) || state.status(node) != NodeStatus::Pending {
        return false;
    }
    predecessors(node, active).into_iter().all(|dependency| {
        matches!(
            state.status(dependency),
            NodeStatus::Done | NodeStatus::Failed
        )
    })
}

pub async fn run_agentic_graph(
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
    selected_agents: Vec<String>,
) -> Result<String> {
    let active = active_nodes(&selected_agents);
    let long_term_memory_enabled = is_long_term_memory_enabled(settings);
    let initial_context = if context_summary.trim().is_empty() {
        Vec::new()
    } else {
        vec![format!("[当前研究工作台]\n{}", context_summary)]
    };
    let mut state = AgentGraphState::new(selected_agents, initial_context);
    state.mark(AgentNode::Start, NodeStatus::Done);

    loop {
        let next_node = ordered_nodes()
            .iter()
            .copied()
            .find(|candidate| is_node_ready(*candidate, &active, &state));

        let Some(node) = next_node else {
            break;
        };

        match node {
            AgentNode::Start => {
                state.mark(node, NodeStatus::Done);
            }
            AgentNode::Synthesis => {
                state.mark(node, NodeStatus::Running);
                let run_id = Uuid::new_v4().to_string();
                let started_at = chrono::Utc::now().to_rfc3339();
                let order_index = state
                    .selected_agents
                    .iter()
                    .position(|item| item == "synthesis")
                    .unwrap_or(state.selected_agents.len())
                    as i64;

                sqlx::query(
                    "INSERT INTO agent_runs (id, session_id, request_id, agent_name, step_name, status, order_index, created_at, updated_at)
                     VALUES (?, ?, ?, 'synthesis', ?, 'running', ?, ?, ?)",
                )
                .bind(&run_id)
                .bind(session_id)
                .bind(request_id)
                .bind(agent_title("synthesis"))
                .bind(order_index)
                .bind(&started_at)
                .bind(&started_at)
                .execute(db)
                .await?;
                let _ = app.emit(
                    "chat:agent_start",
                    json!({
                        "request_id": request_id,
                        "value": {
                            "id": run_id,
                            "session_id": session_id,
                            "request_id": request_id,
                            "agent_name": "synthesis",
                            "step_name": agent_title("synthesis"),
                            "status": "running",
                            "order_index": order_index,
                            "created_at": started_at,
                            "updated_at": started_at,
                            "artifacts": [],
                        }
                    }),
                );

                let synthesis_temp =
                    resolve_temperature(settings, "multi_agent_synthesis_temperature", 0.4);
                let synthesis_model = resolve_model(settings, &["multi_agent_synthesis_model"]);
                let ctx = state.context_parts.join("\n\n---\n\n");
                let synthesis_prompt = if ctx.is_empty() {
                    message.to_string()
                } else {
                    format!(
                        "以下是状态图中各节点累积出的上下文状态：\n\n{}\n\n---\n\n请综合上述内容，给出针对问题「{}」的完整、结构化回答。",
                        ctx, message
                    )
                };

                let mut synthesis_msgs = vec![LlmMessage::system(synthesis_system())];
                synthesis_msgs.extend_from_slice(history);
                synthesis_msgs.push(LlmMessage::user(&synthesis_prompt));

                let rid = request_id.to_string();
                let app_clone = app.clone();
                let result = client
                    .stream_chat(
                        &synthesis_msgs,
                        synthesis_model.as_deref(),
                        synthesis_temp,
                        move |delta| {
                            let _ = app_clone
                                .emit("chat:delta", json!({ "request_id": rid, "delta": delta }));
                        },
                    )
                    .await;

                match result {
                    Ok(output) => {
                        state.mark(node, NodeStatus::Done);
                        let finished_at = chrono::Utc::now().to_rfc3339();
                        sqlx::query("UPDATE agent_runs SET status = 'done', summary = ?, updated_at = ? WHERE id = ?")
                            .bind(&output)
                            .bind(&finished_at)
                            .bind(&run_id)
                            .execute(db)
                            .await?;
                        let _ = app.emit(
                            "chat:agent_complete",
                            json!({
                                "request_id": request_id,
                                "value": {
                                    "id": run_id,
                                    "session_id": session_id,
                                    "request_id": request_id,
                                    "agent_name": "synthesis",
                                    "step_name": agent_title("synthesis"),
                                    "status": "done",
                                    "summary": output,
                                    "order_index": order_index,
                                    "created_at": started_at,
                                    "updated_at": finished_at,
                                    "artifacts": [],
                                }
                            }),
                        );
                        return Ok(output);
                    }
                    Err(error) => {
                        state.mark(node, NodeStatus::Failed);
                        let finished_at = chrono::Utc::now().to_rfc3339();
                        let err_str = error.to_string();
                        sqlx::query("UPDATE agent_runs SET status = 'failed', error = ?, updated_at = ? WHERE id = ?")
                            .bind(&err_str)
                            .bind(&finished_at)
                            .bind(&run_id)
                            .execute(db)
                            .await?;
                        let _ = app.emit(
                            "chat:agent_complete",
                            json!({
                                "request_id": request_id,
                                "value": {
                                    "id": run_id,
                                    "session_id": session_id,
                                    "request_id": request_id,
                                    "agent_name": "synthesis",
                                    "step_name": agent_title("synthesis"),
                                    "status": "failed",
                                    "error": err_str,
                                    "order_index": order_index,
                                    "created_at": started_at,
                                    "updated_at": finished_at,
                                    "artifacts": [],
                                }
                            }),
                        );
                        return Err(error);
                    }
                }
            }
            worker_node => {
                state.mark(worker_node, NodeStatus::Running);
                if let Some(agent_name) = agent_from_node(worker_node) {
                    let order_index = state
                        .selected_agents
                        .iter()
                        .position(|item| item == agent_name)
                        .unwrap_or_default() as i64;
                    let run_id = Uuid::new_v4().to_string();
                    let started_at = chrono::Utc::now().to_rfc3339();

                    sqlx::query(
                        "INSERT INTO agent_runs (id, session_id, request_id, agent_name, step_name, status, order_index, created_at, updated_at)
                         VALUES (?, ?, ?, ?, ?, 'running', ?, ?, ?)",
                    )
                    .bind(&run_id)
                    .bind(session_id)
                    .bind(request_id)
                    .bind(agent_name)
                    .bind(agent_title(agent_name))
                    .bind(order_index)
                    .bind(&started_at)
                    .bind(&started_at)
                    .execute(db)
                    .await?;

                    let payload = json!({
                        "id": run_id,
                        "session_id": session_id,
                        "request_id": request_id,
                        "agent_name": agent_name,
                        "step_name": agent_title(agent_name),
                        "status": "running",
                        "order_index": order_index,
                        "created_at": started_at,
                        "updated_at": started_at,
                        "artifacts": [],
                    });
                    let _ = app.emit(
                        "chat:agent_start",
                        json!({ "request_id": request_id, "value": payload }),
                    );

                    let output = execute_agent_node(
                        client,
                        db,
                        settings,
                        agent_name,
                        message,
                        context_type,
                        context_id,
                        &state.context_parts,
                        history,
                    )
                    .await;

                    let finished_at = chrono::Utc::now().to_rfc3339();
                    match output {
                        Ok(result) => {
                            if !result.trim().is_empty() {
                                state.outputs.insert(agent_name.to_string(), result.clone());
                                state.context_parts.push(format!(
                                    "[{}]\n{}",
                                    agent_title(agent_name),
                                    result
                                ));
                            }
                            state.mark(worker_node, NodeStatus::Done);
                            sqlx::query("UPDATE agent_runs SET status = 'done', summary = ?, updated_at = ? WHERE id = ?")
                                .bind(&result)
                                .bind(&finished_at)
                                .bind(&run_id)
                                .execute(db)
                                .await?;
                            if long_term_memory_enabled {
                                let _ = record_agent_run_completion_event(
                                    db,
                                    session_id,
                                    &run_id,
                                    agent_name,
                                    agent_title(agent_name),
                                    &result,
                                )
                                .await;
                            }
                            let _ = app.emit(
                                "chat:agent_complete",
                                json!({
                                    "request_id": request_id,
                                    "value": {
                                        "id": run_id,
                                        "session_id": session_id,
                                        "request_id": request_id,
                                        "agent_name": agent_name,
                                        "step_name": agent_title(agent_name),
                                        "status": "done",
                                        "summary": result,
                                        "order_index": order_index,
                                        "created_at": started_at,
                                        "updated_at": finished_at,
                                        "artifacts": [],
                                    }
                                }),
                            );
                        }
                        Err(error) => {
                            let err_str = error.to_string();
                            state.failures.push(format!("{}: {}", agent_name, err_str));
                            state.mark(worker_node, NodeStatus::Failed);
                            sqlx::query("UPDATE agent_runs SET status = 'failed', error = ?, updated_at = ? WHERE id = ?")
                                .bind(&err_str)
                                .bind(&finished_at)
                                .bind(&run_id)
                                .execute(db)
                                .await?;
                            if long_term_memory_enabled {
                                let _ = record_agent_run_failure_event(
                                    db,
                                    session_id,
                                    &run_id,
                                    agent_name,
                                    agent_title(agent_name),
                                    &err_str,
                                )
                                .await;
                            }
                            let _ = app.emit(
                                "chat:agent_complete",
                                json!({
                                    "request_id": request_id,
                                    "value": {
                                        "id": run_id,
                                        "agent_name": agent_name,
                                        "step_name": agent_title(agent_name),
                                        "status": "failed",
                                        "error": err_str,
                                        "created_at": started_at,
                                        "updated_at": finished_at,
                                    }
                                }),
                            );
                        }
                    }
                }
            }
        }
    }

    let fallback = state
        .context_parts
        .last()
        .cloned()
        .unwrap_or_else(|| "未生成可用回答。".to_string());
    Ok(fallback)
}

#[cfg(test)]
mod tests {
    use super::{
        active_nodes, is_node_ready, predecessors, AgentGraphState, AgentNode, NodeStatus,
    };

    #[test]
    fn synthesis_waits_for_all_active_workers() {
        let active = active_nodes(&[
            "retrieval".to_string(),
            "planner".to_string(),
            "survey".to_string(),
            "synthesis".to_string(),
        ]);
        let mut state = AgentGraphState::new(
            vec![
                "retrieval".to_string(),
                "planner".to_string(),
                "survey".to_string(),
                "synthesis".to_string(),
            ],
            Vec::new(),
        );
        state.mark(AgentNode::Start, NodeStatus::Done);
        state.mark(AgentNode::Retrieval, NodeStatus::Done);
        state.mark(AgentNode::Planner, NodeStatus::Done);
        assert!(!is_node_ready(AgentNode::Synthesis, &active, &state));
        state.mark(AgentNode::Survey, NodeStatus::Done);
        assert!(is_node_ready(AgentNode::Synthesis, &active, &state));
    }

    #[test]
    fn workers_depend_on_retrieval_when_present() {
        let active = active_nodes(&["retrieval".to_string(), "planner".to_string()]);
        assert_eq!(
            predecessors(AgentNode::Planner, &active),
            vec![AgentNode::Retrieval]
        );
    }
}
