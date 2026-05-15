use crate::agent_graph::run_agentic_graph;
use crate::llm::{LlmClient, LlmMessage};
use crate::services::agent_event_service::{emit_agent_event, AgentEvent, AgentPlanStep};
use crate::services::agent_routing_service::select_agents;
use anyhow::Result;
use std::collections::HashMap;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AgentRuntimeKind {
    XiaoyanNative,
}

impl AgentRuntimeKind {
    pub fn from_settings(_settings: &HashMap<String, String>) -> Self {
        Self::XiaoyanNative
    }
}

pub struct AgentRuntimeRequest<'a> {
    pub app: &'a tauri::AppHandle,
    pub db: &'a sqlx::SqlitePool,
    pub settings: &'a HashMap<String, String>,
    pub client: &'a LlmClient,
    pub request_id: &'a str,
    pub session_id: &'a str,
    pub message: &'a str,
    pub context_type: &'a str,
    pub context_id: &'a Option<String>,
    pub context_summary: &'a str,
    pub history: &'a [LlmMessage],
}

pub async fn run_agent_runtime(
    kind: AgentRuntimeKind,
    request: AgentRuntimeRequest<'_>,
) -> Result<String> {
    match kind {
        AgentRuntimeKind::XiaoyanNative => run_xiaoyan_native_runtime(request).await,
    }
}

async fn run_xiaoyan_native_runtime(request: AgentRuntimeRequest<'_>) -> Result<String> {
    let enabled = enabled_agents(request.settings);
    let max_steps = max_agent_steps(request.settings);
    let routing_mode = routing_mode(request.settings);
    let selected = select_agents(
        request.client,
        request.settings,
        request.message,
        request.context_type,
        &enabled,
        max_steps,
        routing_mode,
    )
    .await;

    let plan = selected
        .iter()
        .map(|agent| AgentPlanStep::from_agent_name(agent))
        .collect();
    let _ = emit_agent_event(
        request.app,
        AgentEvent::Plan {
            request_id: request.request_id.to_string(),
            plan,
        },
    );

    run_agentic_graph(
        request.app,
        request.db,
        request.settings,
        request.client,
        request.request_id,
        request.session_id,
        request.message,
        request.context_type,
        request.context_id,
        request.context_summary,
        request.history,
        selected,
    )
    .await
}

fn enabled_agents(settings: &HashMap<String, String>) -> Vec<String> {
    settings
        .get("multi_agent_enabled_agents")
        .map(|value| value.as_str())
        .unwrap_or("retrieval,synthesis")
        .split(',')
        .map(|item| item.trim().to_string())
        .filter(|item| !item.is_empty())
        .collect()
}

fn max_agent_steps(settings: &HashMap<String, String>) -> usize {
    settings
        .get("multi_agent_max_steps")
        .and_then(|value| value.parse().ok())
        .filter(|value| *value > 0)
        .unwrap_or(6)
}

fn routing_mode(settings: &HashMap<String, String>) -> &str {
    settings
        .get("multi_agent_routing_mode")
        .map(|value| value.as_str())
        .unwrap_or("hybrid")
}
