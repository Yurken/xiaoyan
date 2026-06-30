use crate::assistant_prompts::specialist_system;
use crate::ccf::match_venue;
use crate::commands::paper_search::search_survey_candidates;
use crate::links::{doi_url, paper_reference_url, paper_search_url};
use crate::llm::{resolve_model, resolve_temperature, LlmClient, LlmMessage};
use crate::state::AppState;
use serde_json::json;
use sqlx::Row;
use std::collections::HashSet;
use tauri::{Emitter, State};
use uuid::Uuid;

// ── Planner ─────────────────────────────────────────────────────

const PLANNER_TPL: &str = r#"请为研究主题「{topic}」（关键词：{keywords}）规划研究学习路径，仅返回合法 JSON：
{{
  "overview": "领域概述（2-3句）",
  "prerequisites": [{{"name": "前置知识名", "description": "说明", "resources": ["推荐资源"]}}],
  "learning_stages": [{{"stage": 1, "title": "阶段标题", "duration": "预计时长", "goals": ["学习目标"], "topics": ["学习主题"], "resources": ["资源"]}}],
  "classic_papers": [{{"title": "论文标题", "authors": "作者", "year": 2020, "venue": "会议/期刊名称", "reason": "推荐理由"}}],
  "research_directions": [{{"direction": "研究方向", "description": "描述", "open_problems": ["开放问题"]}}],
  "tools_and_frameworks": ["工具/框架列表"],
  "communities": ["社区/会议/期刊"]
}}"#;

fn planner_system() -> String {
    specialist_system(
        "研究方向规划助手",
        "为研究者生成结构化、可执行、可落地的研究学习路径。",
        Some("输出必须清晰、专业、可直接使用。"),
    )
}

pub async fn run_planner_generation(
    app: tauri::AppHandle,
    settings: std::collections::HashMap<String, String>,
    topic: String,
    keywords: Vec<String>,
) -> Result<(), String> {
    let planner_id = Uuid::new_v4().to_string();
    let _ = app.emit(
        "interest:agent_start",
        json!({
            "id": "planner",
            "agent": {
                "id": planner_id,
                "name": "学习路径规划",
                "role": "生成研究方向学习计划",
                "status": "running"
            }
        }),
    );
    tokio::spawn(async move {
        let client = match LlmClient::from_settings(&settings) {
            Ok(c) => c,
            Err(e) => {
                let _ = app.emit("planner:error", json!({ "error": e.to_string() }));
                let _ = app.emit(
                    "interest:error",
                    json!({ "id": "planner", "error": e.to_string() }),
                );
                return;
            }
        };
        let prompt = PLANNER_TPL
            .replace("{topic}", &topic)
            .replace("{keywords}", &keywords.join("、"));
        let msgs = vec![
            LlmMessage::system(planner_system()),
            LlmMessage::user(&prompt),
        ];
        let planner_model = resolve_model(&settings, &["planner_generation_model"]);
        let planner_temperature =
            resolve_temperature(&settings, "planner_generation_temperature", 0.3);
        match client
            .chat(&msgs, planner_model.as_deref(), planner_temperature)
            .await
        {
            Ok(resp) => {
                let clean = extract_json(&resp);
                let v: serde_json::Value = enrich_planner_result(
                    serde_json::from_str(&clean).unwrap_or(json!({"raw": resp})),
                );
                let _ = app.emit("planner:result", json!({ "topic": topic, "plan": v }));
                let _ = app.emit(
                    "interest:agent_complete",
                    json!({ "id": "planner", "agent": { "id": planner_id } }),
                );
            }
            Err(e) => {
                let _ = app.emit("planner:error", json!({ "error": e.to_string() }));
                let _ = app.emit(
                    "interest:error",
                    json!({ "id": "planner", "error": e.to_string() }),
                );
            }
        }
    });
    Ok(())
}

#[tauri::command]
pub async fn planner_generate(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    topic: String,
    keywords: Vec<String>,
) -> Result<(), String> {
    let settings = state.settings.read().await.clone();
    run_planner_generation(app, settings, topic, keywords).await
}

// ── Survey ───────────────────────────────────────────────────────

const SURVEY_PLANNER_TPL: &str = r#"请针对研究问题「{query}」输出检索规划。时间范围：{time_range}。文献类型：{lit_types}。检索数据库偏好：{databases}。输出语言偏好：{language}。仅返回合法 JSON：
{
    "scope": "一句话定义本次综述范围",
    "search_queries": ["用于检索的短语，3-6条"],
    "must_cover": ["必须覆盖的核心子主题"],
    "expected_methods": ["候选方法类别"],
    "discipline_scope": "学科范围描述"
}"#;

const SURVEY_TIMELINE_TPL: &str = r#"请根据以下候选文献，梳理「{query}」领域的发展脉络。仅返回合法 JSON：
{
    "timeline": [
        {
            "period": "时间段（如 2015-2018）",
            "milestone": "这一阶段的标志性进展（1-2句）",
            "key_works": ["该阶段代表性论文标题"],
            "significance": "为何重要、对后续研究的影响"
        }
    ],
    "earliest_period": "领域起源期简介（1句）",
    "current_frontier": "当前前沿方向概括（1句）"
}

研究问题：{query}

候选文献（按年份排序）：
{papers_by_year}"#;

const SURVEY_WRITER_TPL: &str = r#"请基于研究问题、文献及发展脉络，输出全面的结构化文献综述。仅返回合法 JSON。所有代表性工作、趋势和判断都必须优先来自候选文献或补充语义证据；证据不足时请明确写成研究缺口，不要杜撰论文、作者或结论。
输出语言要求：{language}。
{
    "background": "研究背景（2-4句，含领域定义、重要性与应用价值）",
    "major_methods": [
        {
            "name": "方法类别",
            "description": "方法核心思想",
            "representative_papers": ["代表论文标题"],
            "pros": "主要优势",
            "cons": "主要局限"
        }
    ],
    "schools_of_thought": [
        {
            "name": "学派/流派名称",
            "description": "核心主张与视角",
            "representatives": ["代表学者或代表性工作"]
        }
    ],
    "methodology_summary": {
        "mainstream": "当前主流方法简述",
        "emerging": "新兴方法简述",
        "comparison": "方法优劣对比小结"
    },
    "research_trends": [
        {
            "trend": "趋势名称",
            "signal": "为何出现该趋势、证据"
        }
    ],
    "controversies": [
        {
            "topic": "学界争议点",
            "positions": ["各方观点简述"]
        }
    ],
    "challenges": ["当前关键挑战"],
    "research_gaps": ["现有研究缺口，每条对应一个可切入的空白点"],
    "future_directions": ["未来研究方向与预测"],
    "recommended_topics": [
        {
            "topic": "适合新手切入的研究主题",
            "why": "推荐原因",
            "first_step": "第一步行动建议"
        }
    ],
    "overall_summary": "总结与方向建议（3-5句）"
}

研究问题：{query}
任务范围：{scope}
时间范围：{time_range}
文献类型：{lit_types}
输出语言：{language}
必须覆盖：{must_cover}
候选方法：{expected_methods}

发展脉络：
{timeline}

候选文献：
{papers}

补充语义证据：
{evidence}"#;

fn survey_planner_system() -> String {
    specialist_system(
        "研究任务规划 Agent",
        "把用户研究问题拆解成可检索的子问题，并充分利用用户给定的约束条件。",
        Some("输出必须聚焦、可检索、可执行。"),
    )
}

fn survey_timeline_system() -> String {
    specialist_system(
        "文献时序分析 Agent",
        "梳理学术领域的发展脉络、关键阶段和演进逻辑。",
        Some("输出必须基于候选文献，不得编造。"),
    )
}

fn survey_writer_system() -> String {
    specialist_system(
        "文献综述写作 Agent",
        "生成结构化、全面、可信且可执行的学术文献综述。",
        Some("输出必须基于输入材料，不得夸大或编造。"),
    )
}

#[tauri::command]
pub async fn run_survey_generation(
    app: tauri::AppHandle,
    db: sqlx::SqlitePool,
    settings: std::collections::HashMap<String, String>,
    query: String,
    max_papers: Option<i32>,
    time_from: Option<i32>,
    time_to: Option<i32>,
    lit_types: Option<Vec<String>>,
    databases: Option<Vec<String>>,
    citation_format: Option<String>,
    language: Option<String>,
    paper_ids: Option<Vec<String>>,
    request_id: Option<String>,
) -> Result<(), String> {
    let request_id = request_id
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());

    tokio::spawn(async move {
        let client = match LlmClient::from_settings(&settings) {
            Ok(c) => c,
            Err(e) => {
                let _ = app.emit(
                    "survey:error",
                    json!({ "request_id": request_id, "error": e.to_string() }),
                );
                return;
            }
        };

        let time_range_str = match (time_from, time_to) {
            (Some(from), Some(to)) => format!("{} - {}", from, to),
            (Some(from), None) => format!("{} 至今", from),
            (None, Some(to)) => format!("{} 年以前", to),
            (None, None) => "不限".to_string(),
        };
        let lit_types_str = lit_types
            .as_ref()
            .map(|v| v.join("、"))
            .unwrap_or_else(|| "不限".to_string());
        let databases_str = databases
            .as_ref()
            .map(|v| v.join("、"))
            .unwrap_or_else(|| "不限".to_string());
        let language_str = match language.as_deref().unwrap_or("both") {
            "zh" => "仅使用简体中文输出".to_string(),
            "en" => "Use English only".to_string(),
            _ => "优先使用简体中文，保留英文术语与论文标题".to_string(),
        };

        // ── Agent 1: Intent Planner ──────────────────────────────────────

        let plan_agent_id = uuid::Uuid::new_v4().to_string();
        let _ = app.emit(
            "survey:agent_start",
            json!({
                "request_id": request_id,
                "agent": {
                    "id": plan_agent_id,
                    "name": "检索规划 Agent",
                    "role": "规划研究范围与检索策略",
                    "status": "running"
                }
            }),
        );

        let plan_prompt = SURVEY_PLANNER_TPL
            .replace("{query}", &query)
            .replace("{time_range}", &time_range_str)
            .replace("{lit_types}", &lit_types_str)
            .replace("{databases}", &databases_str)
            .replace("{language}", &language_str);
        let plan_msgs = vec![
            LlmMessage::system(survey_planner_system()),
            LlmMessage::user(plan_prompt),
        ];
        let survey_planner_model = resolve_model(&settings, &["survey_planner_model"]);
        let survey_planner_temperature =
            resolve_temperature(&settings, "survey_planner_temperature", 0.2);
        let plan_json = match client
            .chat(
                &plan_msgs,
                survey_planner_model.as_deref(),
                survey_planner_temperature,
            )
            .await
        {
            Ok(resp) => {
                let parsed = serde_json::from_str::<serde_json::Value>(&extract_json(&resp))
                    .unwrap_or(json!({}));
                let _ = app.emit("survey:agent_complete", json!({
                    "request_id": request_id,
                    "agent": {
                        "id": plan_agent_id,
                        "name": "检索规划 Agent",
                        "role": "规划研究范围与检索策略",
                        "status": "done",
                        "summary": parsed.get("scope").and_then(|v| v.as_str()).unwrap_or("已生成检索规划")
                    }
                }));
                parsed
            }
            Err(e) => {
                let _ = app.emit(
                    "survey:agent_error",
                    json!({
                        "request_id": request_id,
                        "agent": {
                            "id": plan_agent_id,
                            "name": "检索规划 Agent",
                            "role": "规划研究范围与检索策略",
                            "status": "failed",
                            "error": e.to_string()
                        }
                    }),
                );
                json!({
                    "scope": format!("围绕{}进行文献综述", query),
                    "search_queries": [query.clone()],
                    "must_cover": ["研究背景", "主要方法", "研究趋势"],
                    "expected_methods": []
                })
            }
        };

        let search_queries = plan_json
            .get("search_queries")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                    .collect::<Vec<String>>()
            })
            .unwrap_or_else(|| vec![query.clone()]);

        // ── Agent 2: Literature Retriever ──────────────────────────────────

        let retrieval_agent_id = uuid::Uuid::new_v4().to_string();
        let _ = app.emit(
            "survey:agent_start",
            json!({
                "request_id": request_id,
                "agent": {
                    "id": retrieval_agent_id,
                    "name": "文献检索 Agent",
                    "role": "检索候选文献",
                    "status": "running"
                }
            }),
        );

        let paper_limit = i64::from(max_papers.unwrap_or(20).max(1));
        let pinned_ids = paper_ids
            .as_ref()
            .map(|v| {
                v.iter()
                    .filter(|s| !s.is_empty())
                    .take(paper_limit as usize)
                    .cloned()
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();
        let (mut papers, mut retrieval_summary) = if !pinned_ids.is_empty() {
            // 用户已从论文库中手动选择论文，直接按 ID 加载，跳过文本检索
            match fetch_papers_by_ids(&db, &pinned_ids).await {
                Ok(list) => {
                    let count = list.len();
                    (list, format!("已加载论文库中选定的 {} 篇论文", count))
                }
                Err(e) => {
                    let _ = app.emit(
                        "survey:agent_error",
                        json!({
                            "request_id": request_id,
                            "agent": {
                                "id": retrieval_agent_id,
                                "name": "文献检索 Agent",
                                "role": "检索候选文献",
                                "status": "failed",
                                "error": e.clone()
                            }
                        }),
                    );
                    let _ = app.emit(
                        "survey:error",
                        json!({ "request_id": request_id, "error": e }),
                    );
                    return;
                }
            }
        } else {
            match retrieve_papers(
                &db,
                &query,
                &search_queries,
                paper_limit,
                time_from,
                time_to,
            )
            .await
            {
                Ok(list) => {
                    let count = list.len();
                    let filter_desc = if time_from.is_some() || time_to.is_some() {
                        format!("（时间范围：{}）", time_range_str)
                    } else {
                        String::new()
                    };
                    (
                        list,
                        format!("已从论文库检索到 {} 篇候选文献{}", count, filter_desc),
                    )
                }
                Err(e) => (
                    Vec::new(),
                    format!("论文库检索失败，已切换外部学术源补充：{}", e),
                ),
            }
        };

        if pinned_ids.is_empty() && papers.len() < paper_limit as usize {
            let external_limit = (paper_limit as usize).saturating_sub(papers.len()).max(6);
            match search_survey_candidates(
                &settings,
                &query,
                &search_queries,
                external_limit,
                time_from,
                time_to,
            )
            .await
            {
                Ok(external_papers) => {
                    let external_added =
                        merge_survey_papers(&mut papers, external_papers, paper_limit as usize);
                    if external_added > 0 {
                        retrieval_summary = if papers.len() == external_added {
                            format!("已从外部学术源检索到 {} 篇候选文献", external_added)
                        } else {
                            format!(
                                "{}，并从外部学术源补充 {} 篇候选文献",
                                retrieval_summary, external_added
                            )
                        };
                    }
                }
                Err(error) => {
                    if papers.is_empty() {
                        retrieval_summary = format!("论文库与外部学术源均未完成检索：{}", error);
                    }
                }
            }
        }

        if papers.is_empty() {
            let message = "未检索到候选文献，请调整研究问题、放宽时间范围，或先在论文库中导入几篇相关论文后重试。";
            let _ = app.emit(
                "survey:agent_error",
                json!({
                    "request_id": request_id,
                    "agent": {
                        "id": retrieval_agent_id,
                        "name": "文献检索 Agent",
                        "role": "检索候选文献",
                        "status": "failed",
                        "error": message
                    }
                }),
            );
            let _ = app.emit(
                "survey:error",
                json!({ "request_id": request_id, "error": message }),
            );
            return;
        }

        let _ = app.emit(
            "survey:agent_complete",
            json!({
                "request_id": request_id,
                "agent": {
                    "id": retrieval_agent_id,
                    "name": "文献检索 Agent",
                    "role": "检索候选文献",
                    "status": "done",
                    "summary": retrieval_summary
                }
            }),
        );

        // RAG evidence
        let rag_context = if let Ok(embed_client) = LlmClient::embed_client_from_settings(&settings)
        {
            if let Ok(embeddings) = embed_client.embed(&[query.clone()]).await {
                if let Some(emb) = embeddings.into_iter().next() {
                    let top_k = max_papers.unwrap_or(10) as usize;
                    crate::rag::combined_search(&db, &emb, top_k)
                        .await
                        .ok()
                        .map(|results| {
                            results
                                .iter()
                                .map(|r| {
                                    format!(
                                        "【{}】\n{}",
                                        r.source,
                                        truncate_for_prompt(&r.content, 1200)
                                    )
                                })
                                .collect::<Vec<_>>()
                                .join("\n\n")
                        })
                        .unwrap_or_default()
                } else {
                    String::new()
                }
            } else {
                String::new()
            }
        } else {
            String::new()
        };

        // ── Agent 3: Timeline Analyst ──────────────────────────────────────

        let timeline_agent_id = uuid::Uuid::new_v4().to_string();
        let _ = app.emit(
            "survey:agent_start",
            json!({
                "request_id": request_id,
                "agent": {
                    "id": timeline_agent_id,
                    "name": "时序分析 Agent",
                    "role": "梳理领域发展脉络与演进阶段",
                    "status": "running"
                }
            }),
        );

        let papers_by_year_text = build_papers_by_year_text(&papers);
        let timeline_prompt = SURVEY_TIMELINE_TPL
            .replace("{query}", &query)
            .replace("{papers_by_year}", &papers_by_year_text);
        let timeline_msgs = vec![
            LlmMessage::system(survey_timeline_system()),
            LlmMessage::user(timeline_prompt),
        ];
        let timeline_model = resolve_model(&settings, &["survey_planner_model"]);
        let timeline_temperature =
            resolve_temperature(&settings, "survey_planner_temperature", 0.2);
        let (timeline_json, timeline_text) = match client
            .chat(
                &timeline_msgs,
                timeline_model.as_deref(),
                timeline_temperature,
            )
            .await
        {
            Ok(resp) => {
                let parsed = serde_json::from_str::<serde_json::Value>(&extract_json(&resp))
                    .unwrap_or(json!({}));
                let stages = parsed
                    .get("timeline")
                    .and_then(|v| v.as_array())
                    .map(|a| a.len())
                    .unwrap_or(0);
                let _ = app.emit(
                    "survey:agent_complete",
                    json!({
                        "request_id": request_id,
                        "agent": {
                            "id": timeline_agent_id,
                            "name": "时序分析 Agent",
                            "role": "梳理领域发展脉络与演进阶段",
                            "status": "done",
                            "summary": format!("已识别 {} 个发展阶段", stages)
                        }
                    }),
                );
                let text = build_timeline_text(&parsed);
                (parsed, text)
            }
            Err(e) => {
                let _ = app.emit(
                    "survey:agent_error",
                    json!({
                        "request_id": request_id,
                        "agent": {
                            "id": timeline_agent_id,
                            "name": "时序分析 Agent",
                            "role": "梳理领域发展脉络与演进阶段",
                            "status": "failed",
                            "error": e.to_string()
                        }
                    }),
                );
                (json!({}), String::new())
            }
        };

        // ── Agent 4: Survey Writer ──────────────────────────────────────

        let writer_agent_id = uuid::Uuid::new_v4().to_string();
        let _ = app.emit(
            "survey:agent_start",
            json!({
                "request_id": request_id,
                "agent": {
                    "id": writer_agent_id,
                    "name": "综述写作 Agent",
                    "role": "生成全面结构化文献综述",
                    "status": "running"
                }
            }),
        );

        let papers_text = build_papers_text(&papers);
        let writer_prompt = SURVEY_WRITER_TPL
            .replace("{query}", &query)
            .replace(
                "{scope}",
                plan_json
                    .get("scope")
                    .and_then(|v| v.as_str())
                    .unwrap_or("围绕用户研究问题给出入门综述"),
            )
            .replace("{time_range}", &time_range_str)
            .replace("{lit_types}", &lit_types_str)
            .replace("{language}", &language_str)
            .replace(
                "{must_cover}",
                &plan_json
                    .get("must_cover")
                    .and_then(|v| v.as_array())
                    .map(|arr| {
                        arr.iter()
                            .filter_map(|v| v.as_str())
                            .collect::<Vec<_>>()
                            .join("、")
                    })
                    .unwrap_or_else(|| "研究背景、主要方法、研究趋势".to_string()),
            )
            .replace(
                "{expected_methods}",
                &plan_json
                    .get("expected_methods")
                    .and_then(|v| v.as_array())
                    .map(|arr| {
                        arr.iter()
                            .filter_map(|v| v.as_str())
                            .collect::<Vec<_>>()
                            .join("、")
                    })
                    .unwrap_or_default(),
            )
            .replace("{timeline}", &timeline_text)
            .replace("{papers}", &papers_text)
            .replace("{evidence}", &rag_context);

        let writer_msgs = vec![
            LlmMessage::system(survey_writer_system()),
            LlmMessage::user(writer_prompt),
        ];
        let survey_writer_model = resolve_model(&settings, &["survey_writer_model"]);
        let survey_writer_temperature =
            resolve_temperature(&settings, "survey_writer_temperature", 0.3);
        match client
            .chat(
                &writer_msgs,
                survey_writer_model.as_deref(),
                survey_writer_temperature,
            )
            .await
        {
            Ok(resp) => {
                let mut report = serde_json::from_str::<serde_json::Value>(&extract_json(&resp))
                    .unwrap_or(json!({}));
                if !report.is_object() {
                    report = json!({ "overall_summary": resp });
                }

                // Inject timeline from Timeline Analyst
                if timeline_json.get("timeline").is_some() {
                    report["development_timeline"] = timeline_json["timeline"].clone();
                }
                if let Some(v) = timeline_json.get("current_frontier") {
                    report["current_frontier"] = v.clone();
                }
                if let Some(v) = timeline_json.get("earliest_period") {
                    report["earliest_period"] = v.clone();
                }

                // ── Agent 5: Citation Formatter ──────────────────────────────────
                let cite_format = citation_format.as_deref().unwrap_or("gbt7714");
                let formatted_citations: Vec<String> = papers
                    .iter()
                    .enumerate()
                    .map(|(idx, p)| format!("[{}] {}", idx + 1, format_citation(p, cite_format)))
                    .collect();

                let markdown = build_survey_markdown(
                    &query,
                    &report,
                    &papers,
                    &formatted_citations,
                    cite_format,
                );
                let _ = app.emit(
                    "survey:delta",
                    json!({ "request_id": request_id, "delta": markdown }),
                );

                // 落盘：综述结果持久化入库，并通过同步白名单跨端分发（移动端只读消费）。
                let survey_meta = json!({
                    "time_range": time_range_str,
                    "lit_types": lit_types_str,
                    "databases": databases_str,
                    "language": language.as_deref().unwrap_or("both")
                });
                let survey_id = Uuid::new_v4().to_string();
                if let Err(e) = sqlx::query(
                    "INSERT INTO surveys \
                     (id, query, report_json, papers_json, citations_json, citation_format, language, meta_json, markdown) \
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                )
                .bind(&survey_id)
                .bind(&query)
                .bind(serde_json::to_string(&report).unwrap_or_else(|_| "{}".into()))
                .bind(serde_json::to_string(&papers).unwrap_or_else(|_| "[]".into()))
                .bind(serde_json::to_string(&formatted_citations).unwrap_or_else(|_| "[]".into()))
                .bind(cite_format)
                .bind(language.as_deref().unwrap_or("both"))
                .bind(serde_json::to_string(&survey_meta).unwrap_or_else(|_| "{}".into()))
                .bind(&markdown)
                .execute(&db)
                .await
                {
                    eprintln!("[survey] 综述落盘失败: {e}");
                }

                let _ = app.emit(
                    "survey:structured",
                    json!({
                        "request_id": request_id,
                        "id": survey_id,
                        "query": query,
                        "report": report,
                        "papers": papers,
                        "formatted_citations": formatted_citations,
                        "citation_format": cite_format,
                        "meta": survey_meta
                    }),
                );
                let _ = app.emit("survey:agent_complete", json!({
                    "request_id": request_id,
                    "agent": {
                        "id": writer_agent_id,
                        "name": "综述写作 Agent",
                        "role": "生成全面结构化文献综述",
                        "status": "done",
                        "summary": "已完成综述（背景、发展脉络、方法、趋势、挑战、研究缺口与建议方向）"
                    }
                }));
                let _ = app.emit(
                    "survey:done",
                    json!({ "request_id": request_id, "content": markdown }),
                );
            }
            Err(e) => {
                let _ = app.emit(
                    "survey:agent_error",
                    json!({
                        "request_id": request_id,
                        "agent": {
                            "id": writer_agent_id,
                            "name": "综述写作 Agent",
                            "role": "生成全面结构化文献综述",
                            "status": "failed",
                            "error": e.to_string()
                        }
                    }),
                );
                let _ = app.emit(
                    "survey:error",
                    json!({ "request_id": request_id, "error": e.to_string() }),
                );
            }
        }
    });
    Ok(())
}

#[tauri::command]
pub async fn survey_generate(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    query: String,
    max_papers: Option<i32>,
    time_from: Option<i32>,
    time_to: Option<i32>,
    lit_types: Option<Vec<String>>,
    databases: Option<Vec<String>>,
    citation_format: Option<String>,
    language: Option<String>,
    paper_ids: Option<Vec<String>>,
    request_id: Option<String>,
) -> Result<(), String> {
    let settings = state.settings.read().await.clone();
    let db = state.db.clone();
    run_survey_generation(
        app,
        db,
        settings,
        query,
        max_papers,
        time_from,
        time_to,
        lit_types,
        databases,
        citation_format,
        language,
        paper_ids,
        request_id,
    )
    .await
}

/// 已保存综述列表（仅摘要字段），按生成时间倒序。
#[tauri::command]
pub async fn survey_list(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    let rows = sqlx::query("SELECT id, query, created_at FROM surveys ORDER BY created_at DESC")
        .fetch_all(&state.db)
        .await
        .map_err(|e| e.to_string())?;
    Ok(json!(rows
        .into_iter()
        .map(|r| json!({
            "id": r.get::<String, _>("id"),
            "query": r.get::<String, _>("query"),
            "created_at": r.get::<String, _>("created_at"),
        }))
        .collect::<Vec<_>>()))
}

/// 读取单条已保存综述的完整结构。
#[tauri::command]
pub async fn survey_get(
    state: State<'_, AppState>,
    id: String,
) -> Result<serde_json::Value, String> {
    let row = sqlx::query("SELECT * FROM surveys WHERE id = ?")
        .bind(&id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "综述不存在".to_string())?;

    let parse = |col: &str, fallback: serde_json::Value| {
        serde_json::from_str::<serde_json::Value>(&row.get::<String, _>(col)).unwrap_or(fallback)
    };
    Ok(json!({
        "id": row.get::<String, _>("id"),
        "query": row.get::<String, _>("query"),
        "report": parse("report_json", json!({})),
        "papers": parse("papers_json", json!([])),
        "formatted_citations": parse("citations_json", json!([])),
        "citation_format": row.get::<Option<String>, _>("citation_format"),
        "language": row.get::<Option<String>, _>("language"),
        "meta": parse("meta_json", json!({})),
        "markdown": row.get::<Option<String>, _>("markdown"),
        "created_at": row.get::<String, _>("created_at"),
    }))
}

/// 删除一条已保存综述（删除会经墓碑机制同步到其他设备）。
#[tauri::command]
pub async fn survey_delete(state: State<'_, AppState>, id: String) -> Result<(), String> {
    sqlx::query("DELETE FROM surveys WHERE id = ?")
        .bind(&id)
        .execute(&state.db)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn survey_search(
    state: State<'_, AppState>,
    query: String,
    limit: Option<i64>,
) -> Result<serde_json::Value, String> {
    let limit = limit.unwrap_or(20) as usize;
    let settings = state.settings.read().await.clone();

    if let Ok(embed_client) = LlmClient::embed_client_from_settings(&settings) {
        if let Ok(embeddings) = embed_client.embed(&[query.clone()]).await {
            if let Some(emb) = embeddings.into_iter().next() {
                let results = crate::rag::search_paper_chunks(&state.db, &emb, None, limit)
                    .await
                    .map_err(|e| e.to_string())?;
                let mut seen = std::collections::HashSet::new();
                let mut papers = Vec::new();
                for r in results {
                    if seen.insert(r.id.clone()) {
                        papers.push(json!({ "id": r.id, "content": r.content, "source": r.source, "score": r.score }));
                    }
                }
                return Ok(json!(papers));
            }
        }
    }

    let like = format!("%{}%", query);
    let rows = sqlx::query(
        "SELECT id, title, abstract, status FROM papers WHERE title LIKE ? OR abstract LIKE ? LIMIT ?",
    )
    .bind(&like).bind(&like).bind(limit as i64)
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    Ok(json!(rows.into_iter().map(|r| {
        let paper_abstract: Option<String> = r.get("abstract");
        let mut obj = json!({ "id": r.get::<String, _>("id"), "title": r.get::<String, _>("title"), "status": r.get::<String, _>("status") });
        obj["abstract"] = json!(paper_abstract);
        obj
    }).collect::<Vec<_>>()))
}

// ── Helpers ───────────────────────────────────────────────────────

fn extract_json(s: &str) -> String {
    let s = s.trim();
    let s = if s.starts_with("```") {
        let lines: Vec<&str> = s.lines().collect();
        lines[1..lines.len().saturating_sub(1)].join("\n")
    } else {
        s.to_string()
    };
    let start = s.find('{').unwrap_or(0);
    let end = s.rfind('}').map(|i| i + 1).unwrap_or(s.len());
    s[start..end].to_string()
}

fn truncate_for_prompt(text: &str, max_chars: usize) -> String {
    let normalized = text.split_whitespace().collect::<Vec<_>>().join(" ");
    if normalized.chars().count() <= max_chars {
        return normalized;
    }
    let mut truncated = normalized.chars().take(max_chars).collect::<String>();
    truncated.push_str("...");
    truncated
}

fn build_papers_text(papers: &[serde_json::Value]) -> String {
    if papers.is_empty() {
        return "无匹配论文。".to_string();
    }
    papers
        .iter()
        .enumerate()
        .map(|(idx, p)| {
            format!(
                "[{}] {} | {} | {} | {}\n摘要: {}",
                idx + 1,
                p.get("title").and_then(|v| v.as_str()).unwrap_or(""),
                p.get("authors").and_then(|v| v.as_str()).unwrap_or(""),
                p.get("year")
                    .and_then(|v| v.as_i64())
                    .map(|y| y.to_string())
                    .unwrap_or_default(),
                p.get("venue").and_then(|v| v.as_str()).unwrap_or(""),
                truncate_for_prompt(
                    p.get("abstract").and_then(|v| v.as_str()).unwrap_or(""),
                    900,
                )
            )
        })
        .collect::<Vec<_>>()
        .join("\n\n")
}

fn build_papers_by_year_text(papers: &[serde_json::Value]) -> String {
    if papers.is_empty() {
        return "无匹配论文。".to_string();
    }
    let mut sorted = papers.to_vec();
    sorted.sort_by_key(|p| p.get("year").and_then(|v| v.as_i64()).unwrap_or(0));
    sorted
        .iter()
        .map(|p| {
            format!(
                "[{}] {} ({})",
                p.get("year")
                    .and_then(|v| v.as_i64())
                    .map(|y| y.to_string())
                    .unwrap_or_else(|| "年份未知".to_string()),
                p.get("title").and_then(|v| v.as_str()).unwrap_or(""),
                p.get("venue").and_then(|v| v.as_str()).unwrap_or("")
            )
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn build_timeline_text(timeline_json: &serde_json::Value) -> String {
    let mut out = String::new();
    if let Some(ep) = timeline_json
        .get("earliest_period")
        .and_then(|v| v.as_str())
    {
        out.push_str(&format!("起源：{}\n\n", ep));
    }
    if let Some(stages) = timeline_json.get("timeline").and_then(|v| v.as_array()) {
        for stage in stages {
            let period = stage.get("period").and_then(|v| v.as_str()).unwrap_or("");
            let milestone = stage
                .get("milestone")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            out.push_str(&format!("• {}：{}\n", period, milestone));
        }
    }
    if let Some(frontier) = timeline_json
        .get("current_frontier")
        .and_then(|v| v.as_str())
    {
        out.push_str(&format!("\n当前前沿：{}", frontier));
    }
    out
}

async fn fetch_papers_by_ids(
    db: &sqlx::SqlitePool,
    ids: &[String],
) -> Result<Vec<serde_json::Value>, String> {
    if ids.is_empty() {
        return Ok(Vec::new());
    }
    let placeholders = ids.iter().map(|_| "?").collect::<Vec<_>>().join(", ");
    let sql = format!(
        "SELECT id, title, authors, abstract, year, venue, doi, file_path, status FROM papers WHERE id IN ({})",
        placeholders
    );
    let mut query = sqlx::query(&sql);
    for id in ids {
        query = query.bind(id);
    }
    let rows = query.fetch_all(db).await.map_err(|e| e.to_string())?;

    let mut papers = Vec::new();
    for row in rows {
        let mut paper = json!({
            "id": row.get::<String, _>("id"),
            "title": row.get::<String, _>("title"),
            "authors": row.get::<Option<String>, _>("authors").unwrap_or_default(),
            "abstract": row.get::<Option<String>, _>("abstract").unwrap_or_default(),
            "year": row.get::<Option<i64>, _>("year"),
            "venue": row.get::<Option<String>, _>("venue").unwrap_or_default(),
            "doi": row.get::<Option<String>, _>("doi").unwrap_or_default(),
            "paper_url": paper_reference_url(
                row.get::<Option<String>, _>("title").as_deref(),
                row.get::<Option<String>, _>("doi").as_deref(),
                row.get::<Option<String>, _>("file_path").as_deref(),
            ),
            "status": row.get::<String, _>("status"),
        });
        if let Some(venue) = paper.get("venue").and_then(|v| v.as_str()) {
            if let Some(tag) = match_venue(venue) {
                paper["ccf_rating"] = json!(tag.rating);
                paper["ccf_area"] = json!(tag.area);
                paper["ccf_type"] = json!(tag.kind);
                paper["ccf_label"] = json!(tag.label);
                paper["ccf_publisher"] = json!(tag.publisher);
                paper["venue_url"] = json!(tag.url);
            }
        }
        papers.push(paper);
    }
    papers.sort_by_key(|paper| {
        paper
            .get("id")
            .and_then(|value| value.as_str())
            .and_then(|id| ids.iter().position(|item| item == id))
            .unwrap_or(usize::MAX)
    });
    Ok(papers)
}

fn merge_survey_papers(
    target: &mut Vec<serde_json::Value>,
    incoming: Vec<serde_json::Value>,
    limit: usize,
) -> usize {
    if target.len() >= limit {
        return 0;
    }

    let mut seen = target
        .iter()
        .filter_map(survey_paper_identity)
        .collect::<HashSet<_>>();
    let before_len = target.len();

    for paper in incoming {
        if target.len() >= limit {
            break;
        }
        let Some(key) = survey_paper_identity(&paper) else {
            continue;
        };
        if !seen.insert(key) {
            continue;
        }
        target.push(paper);
    }

    target.len().saturating_sub(before_len)
}

fn survey_paper_identity(paper: &serde_json::Value) -> Option<String> {
    if let Some(doi) = paper
        .get("doi")
        .and_then(|value| value.as_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        return Some(format!("doi:{}", doi.to_lowercase()));
    }

    paper
        .get("title")
        .and_then(|value| value.as_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| value.to_lowercase())
}

// ── Translate ─────────────────────────────────────────────────────

#[tauri::command]
pub async fn translate_text(
    state: State<'_, AppState>,
    text: String,
    target_lang: String,
    source_lang: Option<String>,
) -> Result<String, String> {
    let settings = state.settings.read().await.clone();
    let client = LlmClient::from_settings(&settings).map_err(|e| e.to_string())?;

    let model = resolve_model(&settings, &["translation_model"]);
    let temperature = resolve_temperature(&settings, "translation_temperature", 0.1);

    let lang_map: &[(&str, &str)] = &[
        ("zh", "简体中文"),
        ("en", "English"),
        ("ja", "日本語"),
        ("de", "Deutsch"),
        ("fr", "Français"),
    ];
    let target_display = lang_map
        .iter()
        .find(|(code, _)| *code == target_lang.as_str())
        .map(|(_, name)| *name)
        .unwrap_or(target_lang.as_str());

    let source_hint = match &source_lang {
        Some(src) => {
            let src_display = lang_map
                .iter()
                .find(|(code, _)| *code == src.as_str())
                .map(|(_, name)| *name)
                .unwrap_or(src.as_str());
            format!("原文语言：{src_display}\n")
        }
        None => "原文语言：自动识别\n".to_string(),
    };

    let system = specialist_system(
        "学术翻译专家",
        "将学术文本精准翻译为目标语言，严格保留专业术语、保持学术写作风格，不增删原文内容。",
        Some("只返回译文，不加任何解释、标注或前缀。"),
    );

    let user = format!("{source_hint}目标语言：{target_display}\n\n原文：\n{text}");

    let msgs = vec![LlmMessage::system(system), LlmMessage::user(&user)];
    client
        .chat(&msgs, model.as_deref(), temperature)
        .await
        .map_err(|e| e.to_string())
}

// ── Markdown Format ───────────────────────────────────────────────

#[tauri::command]
pub async fn markdown_format_chunk(
    state: State<'_, AppState>,
    text: String,
    style_summary: String,
) -> Result<serde_json::Value, String> {
    let settings = state.settings.read().await.clone();
    let client = LlmClient::from_settings(&settings).map_err(|e| e.to_string())?;

    let model = resolve_model(&settings, &["copilot_simple_model"]);
    let temperature = resolve_temperature(&settings, "copilot_simple_temperature", 0.3);

    let style_context = if style_summary.trim().is_empty() {
        "这是第一块，请自行确定合适的 Markdown 排版风格，并在末尾的风格摘要里简要记录约定（标题层级、列表风格、强调与代码块用法等），供后续块继承。".to_string()
    } else {
        format!("请严格延续以下排版约定，保证全文风格一致：\n{style_summary}")
    };

    let system = specialist_system(
        "Markdown 排版整理专家",
        "把任意文本整理为规范、一致、结构清晰的 Markdown，完整保留原始内容与语义。",
        Some("不要翻译、不要增删或解释内容；不要用代码块包裹整篇输出。"),
    );

    // 用分隔行而非 JSON 承载结果：Markdown 常含引号/反斜杠/代码块/LaTeX，JSON 转义极易破坏内容。
    let user = format!(
        "{style_context}\n\n请整理下面的文本，严格按以下格式输出：\n\
         1) 先输出整理后的完整 Markdown 正文（逐字保留原始信息，仅做排版与结构化）。\n\
         2) 另起一行，单独输出一行分隔标记：{STYLE_SENTINEL}\n\
         3) 在分隔标记之后输出本次排版约定摘要（≤150 字，供后续块继承）。\n\
         除上述内容外不要输出任何额外说明。\n\n待整理文本：\n{text}",
        STYLE_SENTINEL = MARKDOWN_STYLE_SENTINEL,
    );

    let msgs = vec![LlmMessage::system(system), LlmMessage::user(&user)];
    let raw = client
        .chat(&msgs, model.as_deref(), temperature)
        .await
        .map_err(|e| e.to_string())?;

    let body = strip_outer_markdown_fence(raw.trim());
    let (formatted, next_style) = match body.rfind(MARKDOWN_STYLE_SENTINEL) {
        Some(idx) => (
            body[..idx].trim_end().to_string(),
            body[idx + MARKDOWN_STYLE_SENTINEL.len()..]
                .trim()
                .to_string(),
        ),
        // 模型未给分隔标记：整段视为正文，沿用上一块的风格摘要。
        None => (body.clone(), style_summary.trim().to_string()),
    };

    Ok(serde_json::json!({
        "formatted": formatted,
        "styleSummary": next_style,
    }))
}

const MARKDOWN_STYLE_SENTINEL: &str = "<<<STYLE-SUMMARY>>>";

/// 仅当整段输出被一个显式的 ```markdown / ```md 代码块整体包裹时才剥离外层围栏，
/// 避免破坏正文里合法的代码块（普通 ``` 包裹无法与「正文就是一个代码块」区分，故不剥离）。
fn strip_outer_markdown_fence(text: &str) -> String {
    let trimmed = text.trim();
    let lines: Vec<&str> = trimmed.lines().collect();
    if lines.len() >= 2 {
        let first = lines[0].trim();
        let last = lines[lines.len() - 1].trim();
        if (first == "```markdown" || first == "```md") && last == "```" {
            return lines[1..lines.len() - 1].join("\n").trim().to_string();
        }
    }
    trimmed.to_string()
}

async fn retrieve_papers(
    db: &sqlx::SqlitePool,
    query: &str,
    search_queries: &[String],
    limit: i64,
    year_from: Option<i32>,
    year_to: Option<i32>,
) -> Result<Vec<serde_json::Value>, String> {
    let mut terms = vec![query.to_string()];
    terms.extend(search_queries.iter().cloned());

    let year_clause = match (year_from, year_to) {
        (Some(from), Some(to)) => format!(
            " AND (year IS NULL OR (year >= {} AND year <= {}))",
            from, to
        ),
        (Some(from), None) => format!(" AND (year IS NULL OR year >= {})", from),
        (None, Some(to)) => format!(" AND (year IS NULL OR year <= {})", to),
        (None, None) => String::new(),
    };

    let mut seen = HashSet::new();
    let mut papers = Vec::new();
    for term in terms.into_iter().take(8) {
        if papers.len() >= limit as usize {
            break;
        }
        let like = format!("%{}%", term);
        let sql = format!(
            "SELECT id, title, authors, abstract, year, venue, doi, file_path, status
             FROM papers
             WHERE (title LIKE ? OR abstract LIKE ?){}
             ORDER BY updated_at DESC LIMIT ?",
            year_clause
        );
        let rows = sqlx::query(&sql)
            .bind(&like)
            .bind(&like)
            .bind(limit)
            .fetch_all(db)
            .await
            .map_err(|e| e.to_string())?;

        for row in rows {
            let id: String = row.get("id");
            if !seen.insert(id.clone()) {
                continue;
            }
            papers.push(json!({
                "id": id,
                "title": row.get::<String, _>("title"),
                "authors": row.get::<Option<String>, _>("authors").unwrap_or_default(),
                "abstract": row.get::<Option<String>, _>("abstract").unwrap_or_default(),
                "year": row.get::<Option<i64>, _>("year"),
                "venue": row.get::<Option<String>, _>("venue").unwrap_or_default(),
                "doi": row.get::<Option<String>, _>("doi").unwrap_or_default(),
                "paper_url": paper_reference_url(
                    row.get::<Option<String>, _>("title").as_deref(),
                    row.get::<Option<String>, _>("doi").as_deref(),
                    row.get::<Option<String>, _>("file_path").as_deref(),
                ),
                "status": row.get::<String, _>("status"),
            }));
            if let Some(last) = papers.last_mut() {
                if let Some(venue) = last.get("venue").and_then(|v| v.as_str()) {
                    if let Some(tag) = match_venue(venue) {
                        last["ccf_rating"] = json!(tag.rating);
                        last["ccf_area"] = json!(tag.area);
                        last["ccf_type"] = json!(tag.kind);
                        last["ccf_label"] = json!(tag.label);
                        last["ccf_publisher"] = json!(tag.publisher);
                        last["venue_url"] = json!(tag.url);
                    }
                }
            }
            if papers.len() >= limit as usize {
                break;
            }
        }
    }
    Ok(papers)
}

fn format_citation(paper: &serde_json::Value, format: &str) -> String {
    let title = paper
        .get("title")
        .and_then(|v| v.as_str())
        .unwrap_or("Unknown Title");
    let authors = paper.get("authors").and_then(|v| v.as_str()).unwrap_or("");
    let year = paper
        .get("year")
        .and_then(|v| v.as_i64())
        .map(|y| y.to_string())
        .unwrap_or_default();
    let venue = paper.get("venue").and_then(|v| v.as_str()).unwrap_or("");
    let doi = paper
        .get("doi")
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty());
    let is_journal = paper.get("ccf_type").and_then(|v| v.as_str()) == Some("journal");

    match format {
        "apa" => {
            let mut s = String::new();
            if !authors.is_empty() {
                s.push_str(authors);
                s.push_str(". ");
            }
            if !year.is_empty() {
                s.push_str(&format!("({}). ", year));
            }
            s.push_str(title);
            s.push('.');
            if !venue.is_empty() {
                s.push_str(&format!(" {}", venue));
            }
            if let Some(d) = doi {
                s.push_str(&format!(". https://doi.org/{}", d));
            }
            s
        }
        "mla" => {
            let mut s = String::new();
            if !authors.is_empty() {
                s.push_str(authors);
                s.push_str(". ");
            }
            s.push_str(&format!("\"{}\"", title));
            if !venue.is_empty() {
                s.push_str(&format!(", {}", venue));
            }
            if !year.is_empty() {
                s.push_str(&format!(", {}", year));
            }
            s.push('.');
            if let Some(d) = doi {
                s.push_str(&format!(" doi:{}", d));
            }
            s
        }
        "ieee" => {
            let mut s = String::new();
            if !authors.is_empty() {
                s.push_str(authors);
                s.push_str(", ");
            }
            s.push_str(&format!("\"{}\"", title));
            if !venue.is_empty() {
                s.push_str(&format!(", {}", venue));
            }
            if !year.is_empty() {
                s.push_str(&format!(", {}", year));
            }
            s.push('.');
            if let Some(d) = doi {
                s.push_str(&format!(" doi: {}", d));
            }
            s
        }
        _ => {
            // GB/T 7714
            let lit_mark = if is_journal { "J" } else { "C" };
            let mut s = String::new();
            if !authors.is_empty() {
                s.push_str(authors);
                s.push_str(". ");
            }
            s.push_str(&format!("{}[{}]", title, lit_mark));
            if !venue.is_empty() {
                s.push_str(&format!(". {}", venue));
            }
            if !year.is_empty() {
                s.push_str(&format!(", {}", year));
            }
            if let Some(d) = doi {
                s.push_str(&format!(". DOI:{}", d));
            } else {
                s.push('.');
            }
            s
        }
    }
}

fn build_survey_markdown(
    query: &str,
    report: &serde_json::Value,
    papers: &[serde_json::Value],
    formatted_citations: &[String],
    cite_format: &str,
) -> String {
    let mut out = String::new();
    out.push_str(&format!("# 文献综述\n\n**研究问题**：{}\n\n", query));

    if let Some(bg) = report.get("background").and_then(|v| v.as_str()) {
        out.push_str("## 研究背景\n\n");
        out.push_str(bg);
        out.push_str("\n\n");
    }

    if let Some(stages) = report
        .get("development_timeline")
        .and_then(|v| v.as_array())
    {
        if !stages.is_empty() {
            out.push_str("## 发展脉络\n\n");
            if let Some(ep) = report.get("earliest_period").and_then(|v| v.as_str()) {
                out.push_str(&format!("> {}\n\n", ep));
            }
            for stage in stages {
                let period = stage.get("period").and_then(|v| v.as_str()).unwrap_or("");
                let milestone = stage
                    .get("milestone")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                out.push_str(&format!("**{}**：{}\n", period, milestone));
                if let Some(works) = stage.get("key_works").and_then(|v| v.as_array()) {
                    let works_str = works
                        .iter()
                        .filter_map(|w| w.as_str())
                        .map(|t| {
                            paper_search_url(Some(t))
                                .map(|u| format!("[{}]({})", t, u))
                                .unwrap_or_else(|| t.to_string())
                        })
                        .collect::<Vec<_>>()
                        .join("；");
                    if !works_str.is_empty() {
                        out.push_str(&format!("  - 代表工作：{}\n", works_str));
                    }
                }
                if let Some(sig) = stage.get("significance").and_then(|v| v.as_str()) {
                    out.push_str(&format!("  - 意义：{}\n", sig));
                }
                out.push('\n');
            }
            if let Some(frontier) = report.get("current_frontier").and_then(|v| v.as_str()) {
                out.push_str(&format!("**当前前沿**：{}\n\n", frontier));
            }
        }
    }

    if let Some(methods) = report.get("major_methods").and_then(|v| v.as_array()) {
        out.push_str("## 主要方法\n\n");
        for (idx, m) in methods.iter().enumerate() {
            out.push_str(&format!(
                "### {}. {}\n",
                idx + 1,
                m.get("name").and_then(|v| v.as_str()).unwrap_or("未命名")
            ));
            if let Some(desc) = m.get("description").and_then(|v| v.as_str()) {
                out.push_str(&format!("- 核心思想：{}\n", desc));
            }
            if let Some(pros) = m.get("pros").and_then(|v| v.as_str()) {
                out.push_str(&format!("- 优势：{}\n", pros));
            }
            if let Some(cons) = m.get("cons").and_then(|v| v.as_str()) {
                out.push_str(&format!("- 局限：{}\n", cons));
            }
            if let Some(reps) = m.get("representative_papers").and_then(|v| v.as_array()) {
                let rep_titles = reps
                    .iter()
                    .filter_map(|v| v.as_str())
                    .map(|t| {
                        paper_search_url(Some(t))
                            .map(|u| format!("[{}]({})", t, u))
                            .unwrap_or_else(|| t.to_string())
                    })
                    .collect::<Vec<_>>()
                    .join("；");
                if !rep_titles.is_empty() {
                    out.push_str(&format!("- 代表论文：{}\n", rep_titles));
                }
            }
            out.push('\n');
        }
    }

    if let Some(schools) = report.get("schools_of_thought").and_then(|v| v.as_array()) {
        if !schools.is_empty() {
            out.push_str("## 主要学派与流派\n\n");
            for school in schools {
                let name = school
                    .get("name")
                    .and_then(|v| v.as_str())
                    .unwrap_or("未命名");
                out.push_str(&format!("**{}**", name));
                if let Some(desc) = school.get("description").and_then(|v| v.as_str()) {
                    out.push_str(&format!("：{}", desc));
                }
                out.push('\n');
                if let Some(reps) = school.get("representatives").and_then(|v| v.as_array()) {
                    let rep_str = reps
                        .iter()
                        .filter_map(|v| v.as_str())
                        .collect::<Vec<_>>()
                        .join("、");
                    if !rep_str.is_empty() {
                        out.push_str(&format!("  - 代表：{}\n", rep_str));
                    }
                }
            }
            out.push('\n');
        }
    }

    if let Some(ms) = report.get("methodology_summary") {
        if ms
            .get("mainstream")
            .or(ms.get("emerging"))
            .or(ms.get("comparison"))
            .is_some()
        {
            out.push_str("## 研究方法总结\n\n");
            if let Some(v) = ms.get("mainstream").and_then(|v| v.as_str()) {
                out.push_str(&format!("- **主流方法**：{}\n", v));
            }
            if let Some(v) = ms.get("emerging").and_then(|v| v.as_str()) {
                out.push_str(&format!("- **新兴方法**：{}\n", v));
            }
            if let Some(v) = ms.get("comparison").and_then(|v| v.as_str()) {
                out.push_str(&format!("- **方法对比**：{}\n", v));
            }
            out.push('\n');
        }
    }

    if let Some(trends) = report.get("research_trends").and_then(|v| v.as_array()) {
        out.push_str("## 研究趋势\n\n");
        for t in trends {
            let name = t.get("trend").and_then(|v| v.as_str()).unwrap_or("趋势");
            let signal = t.get("signal").and_then(|v| v.as_str()).unwrap_or("");
            out.push_str(&format!("- **{}**：{}\n", name, signal));
        }
        out.push('\n');
    }

    if let Some(contrs) = report.get("controversies").and_then(|v| v.as_array()) {
        if !contrs.is_empty() {
            out.push_str("## 研究争议\n\n");
            for c in contrs {
                let topic = c.get("topic").and_then(|v| v.as_str()).unwrap_or("争议点");
                out.push_str(&format!("**{}**\n", topic));
                if let Some(positions) = c.get("positions").and_then(|v| v.as_array()) {
                    for pos in positions {
                        if let Some(s) = pos.as_str() {
                            out.push_str(&format!("  - {}\n", s));
                        }
                    }
                }
                out.push('\n');
            }
        }
    }

    if let Some(challenges) = report.get("challenges").and_then(|v| v.as_array()) {
        out.push_str("## 当前挑战\n\n");
        for c in challenges {
            if let Some(text) = c.as_str() {
                out.push_str(&format!("- {}\n", text));
            }
        }
        out.push('\n');
    }

    if let Some(gaps) = report.get("research_gaps").and_then(|v| v.as_array()) {
        if !gaps.is_empty() {
            out.push_str("## 研究缺口\n\n");
            for (idx, g) in gaps.iter().enumerate() {
                if let Some(text) = g.as_str() {
                    out.push_str(&format!("{}. {}\n", idx + 1, text));
                }
            }
            out.push('\n');
        }
    }

    if let Some(futures) = report.get("future_directions").and_then(|v| v.as_array()) {
        if !futures.is_empty() {
            out.push_str("## 未来研究方向\n\n");
            for f in futures {
                if let Some(text) = f.as_str() {
                    out.push_str(&format!("- {}\n", text));
                }
            }
            out.push('\n');
        }
    }

    if let Some(topics) = report.get("recommended_topics").and_then(|v| v.as_array()) {
        out.push_str("## 建议研究主题\n\n");
        for (idx, t) in topics.iter().enumerate() {
            out.push_str(&format!(
                "{}. {}\n",
                idx + 1,
                t.get("topic")
                    .and_then(|v| v.as_str())
                    .unwrap_or("未命名主题")
            ));
            if let Some(why) = t.get("why").and_then(|v| v.as_str()) {
                out.push_str(&format!("   - 推荐理由：{}\n", why));
            }
            if let Some(step) = t.get("first_step").and_then(|v| v.as_str()) {
                out.push_str(&format!("   - 第一步：{}\n", step));
            }
        }
        out.push('\n');
    }

    if let Some(sum) = report.get("overall_summary").and_then(|v| v.as_str()) {
        out.push_str("## 总结\n\n");
        out.push_str(sum);
        out.push_str("\n\n");
    }

    if !papers.is_empty() {
        out.push_str("## 检索到的候选论文\n\n");
        for (idx, p) in papers.iter().enumerate() {
            let title = p
                .get("title")
                .and_then(|v| v.as_str())
                .unwrap_or("未知标题");
            let authors = p.get("authors").and_then(|v| v.as_str()).unwrap_or("");
            let year = p
                .get("year")
                .and_then(|v| v.as_i64())
                .map(|y| y.to_string())
                .unwrap_or_default();
            let venue = p.get("venue").and_then(|v| v.as_str()).unwrap_or("");
            let ccf = p
                .get("ccf_rating")
                .and_then(|v| v.as_str())
                .map(|v| format!(" [CCF {}]", v))
                .unwrap_or_default();
            let venue_type = p
                .get("ccf_type")
                .and_then(|v| v.as_str())
                .map(|v| {
                    if v == "journal" {
                        " [期刊]"
                    } else {
                        " [会议]"
                    }
                })
                .unwrap_or("");
            let link = p
                .get("doi")
                .and_then(|v| v.as_str())
                .filter(|s| !s.is_empty())
                .and_then(|d| doi_url(Some(d)))
                .or_else(|| paper_search_url(Some(title)));
            let linked_title = link
                .map(|u| format!("[{}]({})", title, u))
                .unwrap_or_else(|| title.to_string());
            out.push_str(&format!(
                "{}. {} {} {} {}{}{}\n",
                idx + 1,
                linked_title,
                authors,
                year,
                venue,
                ccf,
                venue_type
            ));
        }
        out.push('\n');
    }

    if !formatted_citations.is_empty() {
        let format_name = match cite_format {
            "apa" => "APA",
            "mla" => "MLA",
            "ieee" => "IEEE",
            _ => "GB/T 7714",
        };
        out.push_str(&format!("## 参考文献（{} 格式）\n\n", format_name));
        for cite in formatted_citations {
            out.push_str(cite);
            out.push_str("\n\n");
        }
    }

    out
}

fn enrich_planner_result(mut value: serde_json::Value) -> serde_json::Value {
    if let Some(papers) = value
        .get_mut("classic_papers")
        .and_then(|item| item.as_array_mut())
    {
        for paper in papers {
            if let Some(venue) = paper.get("venue").and_then(|item| item.as_str()) {
                if let Some(tag) = match_venue(venue) {
                    paper["ccf_rating"] = json!(tag.rating);
                    paper["ccf_area"] = json!(tag.area);
                    paper["ccf_type"] = json!(tag.kind);
                    paper["ccf_label"] = json!(tag.label);
                    paper["ccf_publisher"] = json!(tag.publisher);
                    paper["venue_url"] = json!(tag.url);
                }
            }
            if let Some(title) = paper.get("title").and_then(|item| item.as_str()) {
                if let Some(url) = paper_search_url(Some(title)) {
                    paper["paper_url"] = json!(url);
                }
            }
        }
    }
    value
}
