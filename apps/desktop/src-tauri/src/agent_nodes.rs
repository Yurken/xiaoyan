use crate::assistant_prompts::specialist_system;
use crate::graph_rag::build_graph_rag_context;
use crate::llm::{resolve_model, resolve_temperature, resolve_temperature_chain, LlmClient, LlmMessage};
use crate::rag::combined_search;
use anyhow::Result;
use sqlx::Row;
use std::collections::HashMap;

pub async fn execute_agent_node(
    client: &LlmClient,
    db: &sqlx::SqlitePool,
    settings: &HashMap<String, String>,
    agent_name: &str,
    message: &str,
    context_type: &str,
    context_id: &Option<String>,
    prior_context: &[String],
    _history: &[LlmMessage],
) -> Result<String> {
    let worker_temp = resolve_temperature(settings, "multi_agent_worker_temperature", 0.3);
    let worker_model = resolve_model(settings, &["multi_agent_worker_model"]);
    let (agent_model, agent_temperature) =
        resolve_agent_model_config(settings, agent_name, worker_model.as_deref(), worker_temp);

    match agent_name {
        "retrieval" => retrieval_context(client, db, settings, message).await,
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
                    "你正在一个已规划的研究工作台中继续推进研究路线。\n\n当前共享状态：\n{}\n\n请围绕用户问题给出下一步学习安排、实验推进建议或路线修订意见。\n用户问题：{}",
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
                    "这里是当前研究工作台的共享状态：\n{}\n\n请围绕用户问题推荐最值得优先阅读的核心论文，输出标题、作者、年份、核心贡献，并说明为什么适合当前路线。\n用户问题：{}",
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
                    "请基于当前研究工作台共享状态，为用户问题整理结构化综述或相关工作总结，重点服务于当前路线推进。\n\n共享状态：\n{}\n\n用户问题：{}",
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

async fn retrieval_context(
    client: &LlmClient,
    db: &sqlx::SqlitePool,
    settings: &HashMap<String, String>,
    message: &str,
) -> Result<String> {
    let embedding = if let Ok(embed_client) = LlmClient::embed_client_from_settings(settings) {
        embed_client
            .embed(&[message.to_string()])
            .await?
            .into_iter()
            .next()
    } else {
        None
    };

    let Some(embedding) = embedding else {
        let prompt = format!("请围绕问题「{}」提炼出你认为最需要检索的证据类型与关键词。", message);
        let messages = vec![
            LlmMessage::system(specialist_system(
                "检索子 Agent",
                "补充当前问题最需要的检索方向。",
                Some("尽量输出简洁证据线索。"),
            )),
            LlmMessage::user(prompt),
        ];
        return client.chat(&messages, None, 0.2).await;
    };

    let top_k: usize = settings
        .get("multi_agent_search_limit")
        .or_else(|| settings.get("rag_top_k"))
        .and_then(|v| v.parse().ok())
        .unwrap_or(5);

    let graph_context = build_graph_rag_context(db, &embedding, top_k).await.unwrap_or_default();
    let retrievals = combined_search(db, &embedding, top_k).await.unwrap_or_default();
    let semantic_context = if retrievals.is_empty() {
        String::new()
    } else {
        format!(
            "[语义检索原文]\n{}",
            retrievals
                .iter()
                .map(|item| format!("来源：{}\n{}", item.source, item.content))
                .collect::<Vec<_>>()
                .join("\n\n")
        )
    };

    let merged = [graph_context, semantic_context]
        .into_iter()
        .filter(|part| !part.trim().is_empty())
        .collect::<Vec<_>>()
        .join("\n\n");

    if merged.trim().is_empty() {
        let prompt = format!("请围绕问题「{}」提炼出你认为最需要检索的证据类型与关键词。", message);
        let messages = vec![
            LlmMessage::system(specialist_system(
                "检索子 Agent",
                "补充当前问题最需要的检索方向。",
                Some("尽量输出简洁证据线索。"),
            )),
            LlmMessage::user(prompt),
        ];
        return client.chat(&messages, None, 0.2).await;
    }

    Ok(merged)
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

pub fn agent_title(name: &str) -> &str {
    match name {
        "retrieval" => "图谱与语义检索",
        "planner" => "生成研究路径",
        "literature_scout" => "筛选候选论文",
        "survey" => "组织文献综述",
        "paper_analyst" => "解析当前论文",
        "reproduction" => "输出复现建议",
        "synthesis" => "整合最终回答",
        _ => name,
    }
}

pub fn agent_goal(name: &str) -> &str {
    match name {
        "retrieval" => "从知识图谱与语义检索中收集与当前问题直接相关的证据和溯源链",
        "planner" => "围绕用户主题给出系统化学习和研究推进路径",
        "literature_scout" => "快速检索和整理该问题对应的核心论文与线索",
        "survey" => "把检索到的论文整理成结构化领域概览",
        "paper_analyst" => "提炼研究问题、方法、实验与局限",
        "reproduction" => "围绕当前论文给出复现链路和风险提示",
        "synthesis" => "汇总各节点状态并组织为用户可直接使用的答复",
        _ => "处理任务",
    }
}
