use crate::assistant_prompts::supervisor_system;
use crate::llm::{resolve_model, resolve_temperature, LlmClient, LlmMessage};
use serde::Deserialize;
use std::collections::HashMap;

#[derive(Deserialize)]
struct RoutingDecision {
    agents: Vec<String>,
}

pub async fn select_agents(
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
