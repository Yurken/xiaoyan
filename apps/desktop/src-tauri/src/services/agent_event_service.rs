use crate::agent_nodes::{agent_goal, agent_title};
use serde::Serialize;
use serde_json::{json, Value};
use tauri::Emitter;

#[derive(Debug, Clone, Serialize)]
pub struct AgentPlanStep {
    pub agent_name: String,
    pub title: String,
    pub goal: String,
}

impl AgentPlanStep {
    pub fn from_agent_name(agent_name: &str) -> Self {
        Self {
            agent_name: agent_name.to_string(),
            title: agent_title(agent_name).to_string(),
            goal: agent_goal(agent_name).to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum AgentRunStatus {
    Running,
    Done,
    Failed,
}

#[derive(Debug, Clone, Serialize)]
pub struct AgentRunEvent {
    pub id: String,
    pub session_id: String,
    pub request_id: String,
    pub parent_run_id: Option<String>,
    pub agent_name: String,
    pub step_name: String,
    pub status: AgentRunStatus,
    pub order_index: i64,
    pub input_payload: Option<Value>,
    pub output_payload: Option<Value>,
    pub summary: Option<String>,
    pub error: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub artifacts: Vec<Value>,
}

pub struct AgentRunEventInput<'a> {
    pub id: &'a str,
    pub session_id: &'a str,
    pub request_id: &'a str,
    pub agent_name: &'a str,
    pub status: AgentRunStatus,
    pub order_index: i64,
    pub summary: Option<String>,
    pub error: Option<String>,
    pub created_at: &'a str,
    pub updated_at: &'a str,
}

impl AgentRunEvent {
    pub fn from_input(input: AgentRunEventInput<'_>) -> Self {
        Self {
            id: input.id.to_string(),
            session_id: input.session_id.to_string(),
            request_id: input.request_id.to_string(),
            parent_run_id: None,
            agent_name: input.agent_name.to_string(),
            step_name: agent_title(input.agent_name).to_string(),
            status: input.status,
            order_index: input.order_index,
            input_payload: None,
            output_payload: None,
            summary: input.summary,
            error: input.error,
            created_at: input.created_at.to_string(),
            updated_at: input.updated_at.to_string(),
            artifacts: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub enum AgentEvent {
    Plan {
        request_id: String,
        plan: Vec<AgentPlanStep>,
    },
    RunStarted {
        request_id: String,
        run: AgentRunEvent,
    },
    RunFinished {
        request_id: String,
        run: AgentRunEvent,
    },
    TextDelta {
        request_id: String,
        delta: String,
    },
}

pub fn emit_agent_event(app: &tauri::AppHandle, event: AgentEvent) -> tauri::Result<()> {
    emit_unified_agent_event(app, &event)?;

    match event {
        AgentEvent::Plan { request_id, plan } => app.emit(
            "chat:plan",
            json!({ "request_id": request_id, "plan": plan }),
        ),
        AgentEvent::RunStarted { request_id, run } => app.emit(
            "chat:agent_start",
            json!({ "request_id": request_id, "value": run }),
        ),
        AgentEvent::RunFinished { request_id, run } => app.emit(
            "chat:agent_complete",
            json!({ "request_id": request_id, "value": run }),
        ),
        AgentEvent::TextDelta { request_id, delta } => app.emit(
            "chat:delta",
            json!({ "request_id": request_id, "delta": delta }),
        ),
    }
}

fn emit_unified_agent_event(app: &tauri::AppHandle, event: &AgentEvent) -> tauri::Result<()> {
    match event {
        AgentEvent::Plan { request_id, plan } => app.emit(
            "chat:agent_event",
            json!({ "request_id": request_id, "kind": "plan", "payload": { "plan": plan } }),
        ),
        AgentEvent::RunStarted { request_id, run } => app.emit(
            "chat:agent_event",
            json!({ "request_id": request_id, "kind": "run_started", "payload": { "run": run } }),
        ),
        AgentEvent::RunFinished { request_id, run } => app.emit(
            "chat:agent_event",
            json!({ "request_id": request_id, "kind": "run_finished", "payload": { "run": run } }),
        ),
        AgentEvent::TextDelta { request_id, delta } => app.emit(
            "chat:agent_event",
            json!({ "request_id": request_id, "kind": "text_delta", "payload": { "delta": delta } }),
        ),
    }
}
