use crate::assistant_prompts::MAIN_ASSISTANT_NAME;
use crate::services::agent_tool_service::{collect_tool_descriptors, AgentToolDescriptor};

#[derive(Debug, Clone)]
pub struct AgentContext {
    pub parts: Vec<String>,
    pub tools: Vec<AgentToolDescriptor>,
}

pub struct AgentContextRequest<'a> {
    pub context_type: &'a str,
    pub context_id: &'a Option<String>,
    pub context_summary: &'a str,
    pub selected_agents: &'a [String],
}

pub fn build_agent_context(request: AgentContextRequest<'_>) -> AgentContext {
    let tools = collect_tool_descriptors(request.selected_agents, request.context_type);
    let mut parts = vec![
        identity_part(),
        scope_part(request.context_type, request.context_id),
    ];

    if !request.context_summary.trim().is_empty() {
        parts.push(format!(
            "[当前研究工作台]\n{}",
            request.context_summary.trim()
        ));
    }

    if !tools.is_empty() {
        parts.push(tool_part(&tools));
    }

    AgentContext { parts, tools }
}

fn identity_part() -> String {
    format!(
        "[助手身份]\n用户始终只与{MAIN_ASSISTANT_NAME}对话。内部步骤、工具和检索结果都只服务于{MAIN_ASSISTANT_NAME}的最终回答；不要把它们描述成第二个助手或外部人格。"
    )
}

fn scope_part(context_type: &str, context_id: &Option<String>) -> String {
    let label = match context_type {
        "interest" => "研究主题",
        "paper" => "论文",
        _ => "通用对话",
    };
    let id_line = context_id
        .as_deref()
        .filter(|value| !value.trim().is_empty())
        .map(|value| format!("\n上下文 ID：{value}"))
        .unwrap_or_default();

    format!("[任务边界]\n当前上下文类型：{label}{id_line}\n优先回答用户当前问题；只有在必要时引用上下文，信息不足时明确说明缺口。")
}

fn tool_part(tools: &[AgentToolDescriptor]) -> String {
    let rows = tools
        .iter()
        .map(|tool| format!("- {}：{}", tool.title, tool.description))
        .collect::<Vec<_>>()
        .join("\n");

    format!("[可用的小妍能力]\n{rows}")
}

#[cfg(test)]
mod tests {
    use super::{build_agent_context, AgentContextRequest};

    #[test]
    fn context_keeps_xiaoyan_as_only_visible_assistant() {
        let context = build_agent_context(AgentContextRequest {
            context_type: "interest",
            context_id: &Some("topic-1".to_string()),
            context_summary: "当前研究方向：Graph RAG",
            selected_agents: &["planner".to_string()],
        });

        let joined = context.parts.join("\n");
        assert!(joined.contains("用户始终只与小妍对话"));
        assert!(joined.contains("当前研究方向：Graph RAG"));
    }

    #[test]
    fn context_lists_registered_tools() {
        let context = build_agent_context(AgentContextRequest {
            context_type: "paper",
            context_id: &None,
            context_summary: "",
            selected_agents: &["paper_analyst".to_string()],
        });

        assert!(context
            .tools
            .iter()
            .any(|tool| tool.name == "paper_full_text"));
    }
}
