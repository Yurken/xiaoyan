use crate::agent_nodes::{agent_goal, agent_title};
use serde::Serialize;
use serde_json::json;
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
pub enum AgentEvent {
    Plan {
        request_id: String,
        plan: Vec<AgentPlanStep>,
    },
}

pub fn emit_agent_event(app: &tauri::AppHandle, event: AgentEvent) -> tauri::Result<()> {
    match event {
        AgentEvent::Plan { request_id, plan } => app.emit(
            "chat:plan",
            json!({ "request_id": request_id, "plan": plan }),
        ),
    }
}
