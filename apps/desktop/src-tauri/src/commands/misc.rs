use crate::ccf::match_venue;
use crate::links::{doi_url, paper_reference_url, paper_search_url};
use crate::llm::{resolve_model, resolve_temperature, LlmClient, LlmMessage};
use crate::state::AppState;
use serde_json::json;
use sqlx::Row;
use std::collections::HashSet;
use tauri::{Emitter, State};

// ── Planner ─────────────────────────────────────────────────────

const PLANNER_SYS: &str = "你是一位顶尖的研究方向规划专家，帮助研究者设计系统化的研究学习路径。";
const PLANNER_TPL: &str = r#"请为研究主题「{topic}」（关键词：{keywords}）规划研究学习路径。以 JSON 格式返回：
{{
  "overview": "领域概述（2-3句）",
  "prerequisites": [{{"name": "前置知识名", "description": "说明", "resources": ["推荐资源"]}}],
  "learning_stages": [{{"stage": 1, "title": "阶段标题", "duration": "预计时长", "goals": ["学习目标"], "topics": ["学习主题"], "resources": ["资源"]}}],
  "classic_papers": [{{"title": "论文标题", "authors": "作者", "year": 2020, "venue": "会议/期刊名称", "reason": "推荐理由"}}],
  "research_directions": [{{"direction": "研究方向", "description": "描述", "open_problems": ["开放问题"]}}],
  "tools_and_frameworks": ["工具/框架列表"],
  "communities": ["社区/会议/期刊"]
}}"#;

#[tauri::command]
pub async fn planner_generate(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    topic: String,
    keywords: Vec<String>,
) -> Result<(), String> {
    let settings = state.settings.read().await.clone();
    tokio::spawn(async move {
        let client = match LlmClient::from_settings(&settings) {
            Ok(c) => c,
            Err(e) => {
                let _ = app.emit("planner:error", json!({ "error": e.to_string() }));
                return;
            }
        };
        let prompt = PLANNER_TPL
            .replace("{topic}", &topic)
            .replace("{keywords}", &keywords.join("、"));
        let msgs = vec![LlmMessage::system(PLANNER_SYS), LlmMessage::user(&prompt)];
        let planner_model = resolve_model(&settings, &["planner_generation_model"]);
        let planner_temperature = resolve_temperature(&settings, "planner_generation_temperature", 0.3);
        match client.chat(&msgs, planner_model.as_deref(), planner_temperature).await {
            Ok(resp) => {
                let clean = extract_json(&resp);
                let v: serde_json::Value = enrich_planner_result(serde_json::from_str(&clean).unwrap_or(json!({"raw": resp})));
                let _ = app.emit("planner:result", json!({ "topic": topic, "plan": v }));
            }
            Err(e) => {
                let _ = app.emit("planner:error", json!({ "error": e.to_string() }));
            }
        }
    });
    Ok(())
}

// ── Survey ───────────────────────────────────────────────────────

const SURVEY_PLANNER_SYS: &str = "你是研究任务规划 Agent，负责把用户研究问题拆解成可检索的子问题。";
const SURVEY_PLANNER_TPL: &str = r#"请针对研究问题「{query}」输出检索规划。仅返回 JSON：
{
    "scope": "一句话定义本次综述范围",
    "search_queries": ["用于检索的短语，3-6条"],
    "must_cover": ["必须覆盖的核心子主题"],
    "expected_methods": ["候选方法类别"]
}"#;

const SURVEY_WRITER_SYS: &str = "你是文献综述写作 Agent，擅长生成结构化、可执行的科研入门综述。";
const SURVEY_WRITER_TPL: &str = r#"请基于研究问题与候选文献信息，输出结构化综述。仅返回 JSON：
{
    "background": "研究背景（2-4句）",
    "major_methods": [
        {
            "name": "方法类别",
            "description": "方法核心思想",
            "representative_papers": ["代表论文标题"],
            "pros": "主要优势",
            "cons": "主要局限"
        }
    ],
    "research_trends": [
        {
            "trend": "趋势名称",
            "signal": "为何出现该趋势"
        }
    ],
    "challenges": ["当前挑战"],
    "recommended_topics": [
        {
            "topic": "适合新手切入的研究主题",
            "why": "推荐原因",
            "first_step": "第一步行动建议"
        }
    ],
    "overall_summary": "总结与方向建议"
}

研究问题：{query}
任务范围：{scope}
必须覆盖：{must_cover}
候选方法：{expected_methods}

候选文献：
{papers}

补充语义证据：
{evidence}
"#;

#[tauri::command]
pub async fn survey_generate(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    query: String,
    max_papers: Option<i32>,
) -> Result<(), String> {
    let settings = state.settings.read().await.clone();
    let db = state.db.clone();

    tokio::spawn(async move {
        let request_id = uuid::Uuid::new_v4().to_string();

        let client = match LlmClient::from_settings(&settings) {
            Ok(c) => c,
            Err(e) => {
                let _ = app.emit("survey:error", json!({ "request_id": request_id, "error": e.to_string() }));
                return;
            }
        };

        let plan_agent_id = uuid::Uuid::new_v4().to_string();
        let _ = app.emit("survey:agent_start", json!({
            "request_id": request_id,
            "agent": {
                "id": plan_agent_id,
                "name": "Intent Planner",
                "role": "规划研究范围与检索策略",
                "status": "running"
            }
        }));

        let plan_prompt = SURVEY_PLANNER_TPL.replace("{query}", &query);
        let plan_msgs = vec![LlmMessage::system(SURVEY_PLANNER_SYS), LlmMessage::user(plan_prompt)];

        let survey_planner_model = resolve_model(&settings, &["survey_planner_model"]);
        let survey_planner_temperature = resolve_temperature(&settings, "survey_planner_temperature", 0.2);
        let plan_json = match client.chat(&plan_msgs, survey_planner_model.as_deref(), survey_planner_temperature).await {
            Ok(resp) => {
                let parsed = serde_json::from_str::<serde_json::Value>(&extract_json(&resp)).unwrap_or(json!({}));
                let _ = app.emit("survey:agent_complete", json!({
                    "request_id": request_id,
                    "agent": {
                        "id": plan_agent_id,
                        "name": "Intent Planner",
                        "role": "规划研究范围与检索策略",
                        "status": "done",
                        "summary": parsed.get("scope").and_then(|v| v.as_str()).unwrap_or("已生成检索规划")
                    }
                }));
                parsed
            }
            Err(e) => {
                let _ = app.emit("survey:agent_error", json!({
                    "request_id": request_id,
                    "agent": {
                        "id": plan_agent_id,
                        "name": "Intent Planner",
                        "role": "规划研究范围与检索策略",
                        "status": "failed",
                        "error": e.to_string()
                    }
                }));
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

        let retrieval_agent_id = uuid::Uuid::new_v4().to_string();
        let _ = app.emit("survey:agent_start", json!({
            "request_id": request_id,
            "agent": {
                "id": retrieval_agent_id,
                "name": "Literature Retriever",
                "role": "自动检索相关文献",
                "status": "running"
            }
        }));

        let paper_limit = i64::from(max_papers.unwrap_or(20).max(1));
        let papers = match retrieve_papers(&db, &query, &search_queries, paper_limit).await {
            Ok(list) => {
                let _ = app.emit("survey:agent_complete", json!({
                    "request_id": request_id,
                    "agent": {
                        "id": retrieval_agent_id,
                        "name": "Literature Retriever",
                        "role": "自动检索相关文献",
                        "status": "done",
                        "summary": format!("已检索到 {} 篇候选文献", list.len())
                    }
                }));
                list
            }
            Err(e) => {
                let _ = app.emit("survey:agent_error", json!({
                    "request_id": request_id,
                    "agent": {
                        "id": retrieval_agent_id,
                        "name": "Literature Retriever",
                        "role": "自动检索相关文献",
                        "status": "failed",
                        "error": e.clone()
                    }
                }));
                Vec::new()
            }
        };

        // Try RAG evidence for synthesis grounding.
        let rag_context = if let Ok(embed_client) = LlmClient::embed_client_from_settings(&settings) {
            if let Ok(embeddings) = embed_client.embed(&[query.clone()]).await {
                if let Some(emb) = embeddings.into_iter().next() {
                    let top_k = max_papers.unwrap_or(10) as usize;
                    crate::rag::combined_search(&db, &emb, top_k)
                        .await
                        .ok()
                        .map(|results| {
                            results
                                .iter()
                                .map(|r| format!("【{}】\n{}", r.source, r.content))
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

        let writer_agent_id = uuid::Uuid::new_v4().to_string();
        let _ = app.emit("survey:agent_start", json!({
            "request_id": request_id,
            "agent": {
                "id": writer_agent_id,
                "name": "Survey Writer",
                "role": "生成结构化文献综述",
                "status": "running"
            }
        }));

        let papers_text = if papers.is_empty() {
            "无匹配论文。".to_string()
        } else {
            papers
                .iter()
                .enumerate()
                .map(|(idx, p)| {
                    format!(
                        "[{}] {} | {} | {} | {}\n摘要: {}",
                        idx + 1,
                        p.get("title").and_then(|v| v.as_str()).unwrap_or(""),
                        p.get("authors").and_then(|v| v.as_str()).unwrap_or(""),
                        p.get("year").and_then(|v| v.as_i64()).map(|y| y.to_string()).unwrap_or_default(),
                        p.get("venue").and_then(|v| v.as_str()).unwrap_or(""),
                        p.get("abstract").and_then(|v| v.as_str()).unwrap_or("")
                    )
                })
                .collect::<Vec<String>>()
                .join("\n\n")
        };

        let writer_prompt = SURVEY_WRITER_TPL
            .replace("{query}", &query)
            .replace(
                "{scope}",
                plan_json
                    .get("scope")
                    .and_then(|v| v.as_str())
                    .unwrap_or("围绕用户研究问题给出入门综述"),
            )
            .replace(
                "{must_cover}",
                &plan_json
                    .get("must_cover")
                    .and_then(|v| v.as_array())
                    .map(|arr| {
                        arr.iter()
                            .filter_map(|v| v.as_str())
                            .collect::<Vec<&str>>()
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
                            .collect::<Vec<&str>>()
                            .join("、")
                    })
                    .unwrap_or_default(),
            )
            .replace("{papers}", &papers_text)
            .replace("{evidence}", &rag_context);

        let writer_msgs = vec![LlmMessage::system(SURVEY_WRITER_SYS), LlmMessage::user(writer_prompt)];
        let survey_writer_model = resolve_model(&settings, &["survey_writer_model"]);
        let survey_writer_temperature = resolve_temperature(&settings, "survey_writer_temperature", 0.3);
        match client.chat(&writer_msgs, survey_writer_model.as_deref(), survey_writer_temperature).await {
            Ok(resp) => {
                let mut report =
                    serde_json::from_str::<serde_json::Value>(&extract_json(&resp)).unwrap_or(json!({}));
                if !report.is_object() {
                    report = json!({ "overall_summary": resp });
                }

                let markdown = build_survey_markdown(&query, &report, &papers);
                let _ = app.emit("survey:delta", json!({ "request_id": request_id, "delta": markdown }));
                let _ = app.emit("survey:structured", json!({
                    "request_id": request_id,
                    "query": query,
                    "report": report,
                    "papers": papers
                }));

                let _ = app.emit("survey:agent_complete", json!({
                    "request_id": request_id,
                    "agent": {
                        "id": writer_agent_id,
                        "name": "Survey Writer",
                        "role": "生成结构化文献综述",
                        "status": "done",
                        "summary": "已完成结构化综述（背景、方法、趋势、挑战与建议方向）"
                    }
                }));
                let _ = app.emit("survey:done", json!({ "request_id": request_id, "content": markdown }));
            }
            Err(e) => {
                let _ = app.emit("survey:agent_error", json!({
                    "request_id": request_id,
                    "agent": {
                        "id": writer_agent_id,
                        "name": "Survey Writer",
                        "role": "生成结构化文献综述",
                        "status": "failed",
                        "error": e.to_string()
                    }
                }));
                let _ = app.emit("survey:error", json!({ "request_id": request_id, "error": e.to_string() }));
            }
        }
    });
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

    // Try semantic search
    if let Ok(embed_client) = LlmClient::embed_client_from_settings(&settings) {
        if let Ok(embeddings) = embed_client.embed(&[query.clone()]).await {
            if let Some(emb) = embeddings.into_iter().next() {
                let results = crate::rag::search_paper_chunks(&state.db, &emb, None, limit)
                    .await
                    .map_err(|e| e.to_string())?;

                // Return unique paper IDs
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

    // Fallback: full-text search
    let like = format!("%{}%", query);
    let rows = sqlx::query(
        "SELECT id, title, abstract, status FROM papers WHERE title LIKE ? OR abstract LIKE ? LIMIT ?",
    )
    .bind(&like).bind(&like).bind(limit as i64)
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    Ok(json!(rows
        .into_iter()
        .map(|r| {
            let paper_abstract: Option<String> = r.get("abstract");
            let mut obj = json!({ "id": r.get::<String, _>("id"), "title": r.get::<String, _>("title"), "status": r.get::<String, _>("status") });
            obj["abstract"] = json!(paper_abstract);
            obj
        })
        .collect::<Vec<_>>()))
}

// ── Helper ───────────────────────────────────────────────────────

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

async fn retrieve_papers(
    db: &sqlx::SqlitePool,
    query: &str,
    search_queries: &[String],
    limit: i64,
) -> Result<Vec<serde_json::Value>, String> {
    let mut terms = vec![query.to_string()];
    terms.extend(search_queries.iter().cloned());

    let mut seen = HashSet::new();
    let mut papers = Vec::new();
    for term in terms.into_iter().take(8) {
        if papers.len() >= limit as usize {
            break;
        }
        let like = format!("%{}%", term);
        let rows = sqlx::query(
            "SELECT id, title, authors, abstract, year, venue, doi, file_path, status
             FROM papers
             WHERE title LIKE ? OR abstract LIKE ?
             ORDER BY updated_at DESC
             LIMIT ?",
        )
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
                if let Some(venue) = last.get("venue").and_then(|value| value.as_str()) {
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

fn build_survey_markdown(
    query: &str,
    report: &serde_json::Value,
    papers: &[serde_json::Value],
) -> String {
    let mut out = String::new();
    out.push_str(&format!("# 文献综述\n\n研究问题：{}\n\n", query));

    if let Some(bg) = report.get("background").and_then(|v| v.as_str()) {
        out.push_str("## 研究背景\n\n");
        out.push_str(bg);
        out.push_str("\n\n");
    }

    if let Some(methods) = report.get("major_methods").and_then(|v| v.as_array()) {
        out.push_str("## 主要方法\n\n");
        for (idx, m) in methods.iter().enumerate() {
            out.push_str(&format!("### {}. {}\n", idx + 1, m.get("name").and_then(|v| v.as_str()).unwrap_or("未命名方法")));
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
                    .map(|title| {
                        paper_search_url(Some(title))
                            .map(|url| format!("[{}]({})", title, url))
                            .unwrap_or_else(|| title.to_string())
                    })
                    .collect::<Vec<String>>()
                    .join("；");
                if !rep_titles.is_empty() {
                    out.push_str(&format!("- 代表论文：{}\n", rep_titles));
                }
            }
            out.push('\n');
        }
    }

    if let Some(trends) = report.get("research_trends").and_then(|v| v.as_array()) {
        out.push_str("## 研究趋势\n\n");
        for t in trends {
            let name = t.get("trend").and_then(|v| v.as_str()).unwrap_or("趋势");
            let signal = t.get("signal").and_then(|v| v.as_str()).unwrap_or("");
            out.push_str(&format!("- {}：{}\n", name, signal));
        }
        out.push('\n');
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

    if let Some(topics) = report.get("recommended_topics").and_then(|v| v.as_array()) {
        out.push_str("## 建议研究主题\n\n");
        for (idx, t) in topics.iter().enumerate() {
            out.push_str(&format!("{}. {}\n", idx + 1, t.get("topic").and_then(|v| v.as_str()).unwrap_or("未命名主题")));
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
            let title = p.get("title").and_then(|v| v.as_str()).unwrap_or("未知标题");
            let authors = p.get("authors").and_then(|v| v.as_str()).unwrap_or("");
            let year = p.get("year").and_then(|v| v.as_i64()).map(|y| y.to_string()).unwrap_or_default();
            let venue = p.get("venue").and_then(|v| v.as_str()).unwrap_or("");
            let ccf = p
                .get("ccf_rating")
                .and_then(|v| v.as_str())
                .map(|value| format!(" [CCF {}]", value))
                .unwrap_or_default();
            let venue_type = p
                .get("ccf_type")
                .and_then(|v| v.as_str())
                .map(|value| if value == "journal" { " [期刊]" } else { " [会议]" })
                .unwrap_or("");
            let link = p
                .get("doi")
                .and_then(|v| v.as_str())
                .and_then(|value| doi_url(Some(value)))
                .or_else(|| paper_search_url(Some(title)));
            let linked_title = link
                .map(|url| format!("[{}]({})", title, url))
                .unwrap_or_else(|| title.to_string());
            out.push_str(&format!("{}. {} {} {} {}{}{}\n", idx + 1, linked_title, authors, year, venue, ccf, venue_type));
        }
    }

    out
}

fn enrich_planner_result(mut value: serde_json::Value) -> serde_json::Value {
    if let Some(papers) = value.get_mut("classic_papers").and_then(|item| item.as_array_mut()) {
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
