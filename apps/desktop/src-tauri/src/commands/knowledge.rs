use crate::assistant_prompts::specialist_system;
use crate::ccf::match_venue;
use crate::links::paper_search_url;
use crate::llm::{resolve_model, resolve_temperature, LlmClient, LlmMessage};
use crate::rag::{combined_search, serialize_embedding};
use crate::state::AppState;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::HashSet;
use sqlx::Row;
use tauri::{Emitter, State};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ResearchInterestProfilePayload {
    pub goal: Option<String>,
    pub background: Option<String>,
    pub time_budget: Option<String>,
    pub constraints: Option<Vec<String>>,
    pub known_context: Option<String>,
    pub preferred_output: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResearchInterestHintResponse {
    pub summary: String,
    pub next_field: String,
    pub matched_domains: Vec<String>,
    pub keyword_suggestions: Vec<String>,
    pub goal_suggestions: Vec<String>,
    pub background_prompts: Vec<String>,
    pub time_budget_suggestions: Vec<String>,
    pub constraint_suggestions: Vec<String>,
    pub known_context_suggestions: Vec<String>,
    pub output_suggestions: Vec<String>,
}

// ── Research Interests ──────────────────────────────────────────

#[tauri::command]
pub async fn knowledge_list_interests(
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let rows = sqlx::query(
        "SELECT id, topic, folder_name, keywords, profile, learning_path, status, created_at FROM research_interests ORDER BY created_at DESC",
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    let list: Vec<serde_json::Value> = rows.iter().map(research_interest_row_to_json).collect();
    Ok(json!(list))
}

#[tauri::command]
pub async fn knowledge_create_interest(
    state: State<'_, AppState>,
    topic: String,
    keywords: Vec<String>,
    profile: Option<ResearchInterestProfilePayload>,
) -> Result<serde_json::Value, String> {
    let trimmed_topic = topic.trim();
    if trimmed_topic.is_empty() {
        return Err("研究方向不能为空".to_string());
    }

    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let kw_json = serde_json::to_string(&keywords).unwrap_or_else(|_| "[]".into());
    let profile_json = profile
        .as_ref()
        .and_then(|value| serde_json::to_string(value).ok());
    let folder_name = default_interest_folder_name(trimmed_topic);
    sqlx::query(
        "INSERT INTO research_interests (id, topic, folder_name, keywords, profile, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(trimmed_topic)
    .bind(&folder_name)
    .bind(&kw_json)
    .bind(&profile_json)
    .bind(&now)
    .execute(&state.db)
    .await
    .map_err(|e| e.to_string())?;
    Ok(json!({
        "id": id,
        "topic": trimmed_topic,
        "folder_name": folder_name,
        "keywords": keywords,
        "profile": profile,
        "status": "active",
        "created_at": now
    }))
}

#[tauri::command]
pub async fn knowledge_update_interest_folder(
    state: State<'_, AppState>,
    id: String,
    folder_name: String,
) -> Result<serde_json::Value, String> {
    let trimmed_folder_name = folder_name.trim();
    if trimmed_folder_name.is_empty() {
        return Err("文件夹名称不能为空".to_string());
    }

    sqlx::query("UPDATE research_interests SET folder_name = ? WHERE id = ?")
        .bind(trimmed_folder_name)
        .bind(&id)
        .execute(&state.db)
        .await
        .map_err(|e| e.to_string())?;

    let row = sqlx::query(
        "SELECT id, topic, folder_name, keywords, profile, learning_path, status, created_at FROM research_interests WHERE id = ?",
    )
    .bind(&id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| e.to_string())?
    .ok_or("未找到对应研究方向。")?;

    Ok(research_interest_row_to_json(&row))
}

#[tauri::command]
pub async fn knowledge_delete_interest_bundle(
    state: State<'_, AppState>,
    id: String,
) -> Result<serde_json::Value, String> {
    let mut tx = state.db.begin().await.map_err(|e| e.to_string())?;

    let exists = sqlx::query("SELECT id FROM research_interests WHERE id = ?")
        .bind(&id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

    if exists.is_none() {
        return Err("未找到对应研究方向。".to_string());
    }

    let deleted_sessions = sqlx::query("DELETE FROM chat_sessions WHERE context_type = 'interest' AND context_id = ?")
        .bind(&id)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?
        .rows_affected();

    let deleted_notes = sqlx::query("DELETE FROM knowledge_notes WHERE research_interest_id = ?")
        .bind(&id)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?
        .rows_affected();

    let deleted_papers = sqlx::query("DELETE FROM papers WHERE research_interest_id = ?")
        .bind(&id)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?
        .rows_affected();

    sqlx::query("DELETE FROM research_interests WHERE id = ?")
        .bind(&id)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

    tx.commit().await.map_err(|e| e.to_string())?;

    Ok(json!({
        "deleted_interest_id": id,
        "deleted_sessions": deleted_sessions,
        "deleted_notes": deleted_notes,
        "deleted_papers": deleted_papers,
    }))
}

/// Deletes only the research interest record.
/// Papers and notes lose their association (ON DELETE SET NULL).
/// Chat sessions are moved back to the general context rather than deleted.
#[tauri::command]
pub async fn knowledge_delete_interest_only(
    state: State<'_, AppState>,
    id: String,
) -> Result<serde_json::Value, String> {
    // Detach sessions from the interest (move to general)
    sqlx::query(
        "UPDATE chat_sessions SET context_type = 'general', context_id = NULL \
         WHERE context_type = 'interest' AND context_id = ?",
    )
    .bind(&id)
    .execute(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    // Delete the interest — ON DELETE SET NULL handles papers and notes automatically
    sqlx::query("DELETE FROM research_interests WHERE id = ?")
        .bind(&id)
        .execute(&state.db)
        .await
        .map_err(|e| e.to_string())?;

    Ok(json!({ "deleted_interest_id": id }))
}

const PLANNER_PROMPT: &str = r#"请为研究方向「{topic}」（关键词：{keywords}）设计系统化学习路线，仅返回合法 JSON：
{{"overview":"...","prerequisites":[{{"name":"...","description":"...","resources":["..."]}}],"learning_stages":[{{"stage":1,"title":"...","duration":"...","goals":["..."],"topics":["..."],"resources":["..."]}}],"classic_papers":[{{"title":"...","authors":"...","year":2020,"venue":"会议/期刊名称","reason":"..."}}],"research_directions":[{{"direction":"...","description":"...","open_problems":["..."]}}],"tools_and_frameworks":["..."],"communities":["..."]}}"#;
const PLANNER_ANALYST_PROMPT: &str = r#"请分析研究方向「{topic}」（关键词：{keywords}），仅返回合法 JSON：
{"scope":"一句话定义范围","focus_topics":["核心主题"],"skill_targets":["需要掌握的能力"],"risk_points":["新手常见误区"]}"#;
const INTEREST_HINT_PROMPT: &str = r#"请根据下面这个"正在填写中的研究规划表单"，给出实时补全建议。

目标：
1. 用 1-2 句中文总结你当前理解的研究方向，避免空泛。
2. 判断"现在最值得继续填写的字段" next_field。只能从 topic, keywords, goal, background, time_budget, constraints, known_context, preferred_output 中选择一个。
3. 给出各字段的候选建议，供界面做点击补全。建议应补充用户输入，而不是重复原文。
4. 每个数组最多 6 项，尽量短、可直接点击、避免长句。
5. 若研究主题与大模型/LLM 相关，关键词建议通常要优先覆盖 LLM、Deep Learning、Transformer、Alignment、RLHF、RAG、Reasoning、Evaluation 中合适的项，但仍然要结合用户已经填写的内容过滤不合适项。
6. 在信息不足时，优先顺序通常是：topic -> keywords -> goal -> background -> time_budget -> constraints -> known_context -> preferred_output；但如果你认为某个后续字段更关键，可以调整。
7. background_prompts 只能写"当前基础可补充的信息"或"可直接填写的短语模板"，例如"学过深度学习与 PyTorch""做过时序预测 benchmark 复现"。不要写成问句，不要写数据集选择、baseline 比较、实验设计、评价指标等内容。
8. constraint_suggestions 才适合出现算力、公开数据、中文资料优先等限制；known_context_suggestions 才适合出现论文、模型、baseline 名称。

只返回合法 JSON，不要包含 markdown、解释或代码块：
{
  "summary": "一句到两句中文总结",
  "next_field": "keywords",
  "matched_domains": ["领域标签"],
  "keyword_suggestions": ["关键词"],
  "goal_suggestions": ["研究目标建议"],
  "background_prompts": ["当前基础补充问题"],
  "time_budget_suggestions": ["时间预算建议"],
  "constraint_suggestions": ["约束条件建议"],
  "known_context_suggestions": ["已知论文或方法"],
  "output_suggestions": ["期望输出建议"]
}

当前表单：
{form}
"#;

fn planner_system() -> String {
    specialist_system(
        "科研规划助手",
        "为研究者设计结构化、可执行、可落地的研究学习路线。",
        Some("输出必须专业、克制、可操作。"),
    )
}

fn planner_analyst_system() -> String {
    specialist_system(
        "研究方向分析 Agent",
        "把研究主题拆解为清晰的学习重点、能力目标和风险点。",
        Some("输出必须准确、简洁、可执行。"),
    )
}

fn interest_hint_system() -> String {
    specialist_system(
        "研究规划表单实时助手",
        "基于用户已填写的信息，判断下一步最值得补充的字段，并给出可直接点击的候选短语。",
        Some("你的职责不是直接生成完整路线，输出必须稳定、克制、可执行。"),
    )
}

#[tauri::command]
pub async fn knowledge_generate_plan(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    let row = sqlx::query("SELECT topic, keywords, profile FROM research_interests WHERE id = ?")
        .bind(&id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("未找到对应研究方向。")?;

    let topic: String = row.get("topic");
    let kw_str: String = row.get::<Option<String>, _>("keywords").unwrap_or_else(|| "[]".into());
    let profile_str: Option<String> = row.get::<Option<String>, _>("profile");
    let keywords: Vec<String> = serde_json::from_str(&kw_str).unwrap_or_default();
    let profile = profile_str
        .and_then(|value| serde_json::from_str::<ResearchInterestProfilePayload>(&value).ok())
        .unwrap_or_default();
    let settings = state.settings.read().await.clone();
    let db = state.db.clone();
    let rid = id.clone();

    tokio::spawn(async move {
        let client = match LlmClient::from_settings(&settings) {
            Ok(c) => c,
            Err(e) => { let _ = app.emit("interest:error", json!({ "id": rid, "error": e.to_string() })); return; }
        };

        let analyst_id = Uuid::new_v4().to_string();
        let _ = app.emit("interest:agent_start", json!({
            "id": rid,
            "agent": {
                "id": analyst_id,
                "name": "主题分析 Agent",
                "role": "拆解研究主题与能力目标",
                "status": "running"
            }
        }));

        let analyst_prompt = PLANNER_ANALYST_PROMPT
            .replace("{topic}", &topic)
            .replace("{keywords}", &keywords.join("、"))
            + &profile_to_analysis_context(&profile);
        let analyst_msgs = vec![LlmMessage::system(planner_analyst_system()), LlmMessage::user(&analyst_prompt)];
        let analyst_model = resolve_model(&settings, &["planner_analysis_model"]);
        let analyst_temperature = resolve_temperature(&settings, "planner_analysis_temperature", 0.2);
        let analysis_json = match client.chat(&analyst_msgs, analyst_model.as_deref(), analyst_temperature).await {
            Ok(resp) => {
                let clean = crate::commands::papers::extract_json_pub(&resp);
                let parsed = serde_json::from_str::<serde_json::Value>(&clean).unwrap_or(json!({}));
                let _ = app.emit("interest:agent_complete", json!({
                    "id": rid,
                    "agent": {
                        "id": analyst_id,
                        "name": "主题分析 Agent",
                        "role": "拆解研究主题与能力目标",
                        "status": "done",
                        "summary": parsed.get("scope").and_then(|v| v.as_str()).unwrap_or("已完成主题拆解")
                    }
                }));
                parsed
            }
            Err(e) => {
                let _ = app.emit("interest:agent_error", json!({
                    "id": rid,
                    "agent": {
                        "id": analyst_id,
                        "name": "主题分析 Agent",
                        "role": "拆解研究主题与能力目标",
                        "status": "failed",
                        "error": e.to_string()
                    }
                }));
                json!({})
            }
        };

        let scout_id = Uuid::new_v4().to_string();
        let _ = app.emit("interest:agent_start", json!({
            "id": rid,
            "agent": {
                "id": scout_id,
                "name": "参考文献筛选 Agent",
                "role": "从本地论文库筛选参考论文",
                "status": "running"
            }
        }));

        let mut paper_hints: Vec<String> = Vec::new();
        let mut seen_titles = HashSet::new();
        let associated_rows = sqlx::query(
            "SELECT title, year FROM papers WHERE research_interest_id = ? ORDER BY updated_at DESC LIMIT 8",
        )
        .bind(&rid)
        .fetch_all(&db)
        .await
        .unwrap_or_default();

        for row in associated_rows {
            let title: String = row.get("title");
            let normalized_title = title.trim().to_lowercase();
            if normalized_title.is_empty() || !seen_titles.insert(normalized_title) {
                continue;
            }
            let year: Option<i64> = row.get("year");
            paper_hints.push(format!("{}{}", title, year.map(|y| format!(" ({})", y)).unwrap_or_default()));
        }

        let direct_paper_count = paper_hints.len();
        if paper_hints.len() < 8 {
            let mut terms = vec![topic.clone()];
            terms.extend(keywords.clone());
            for term in terms.into_iter().take(6) {
                let like = format!("%{}%", term);
                let rows = sqlx::query(
                    "SELECT title, year FROM papers WHERE (title LIKE ? OR abstract LIKE ?) AND (research_interest_id IS NULL OR research_interest_id != ?) LIMIT 3",
                )
                .bind(&like)
                .bind(&like)
                .bind(&rid)
                .fetch_all(&db)
                .await
                .unwrap_or_default();
                for row in rows {
                    let title: String = row.get("title");
                    let normalized_title = title.trim().to_lowercase();
                    if normalized_title.is_empty() || !seen_titles.insert(normalized_title) {
                        continue;
                    }
                    let year: Option<i64> = row.get("year");
                    paper_hints.push(format!("{}{}", title, year.map(|y| format!(" ({})", y)).unwrap_or_default()));
                    if paper_hints.len() >= 8 {
                        break;
                    }
                }
                if paper_hints.len() >= 8 {
                    break;
                }
            }
        }
        let _ = app.emit("interest:agent_complete", json!({
            "id": rid,
            "agent": {
                "id": scout_id,
                "name": "参考文献筛选 Agent",
                "role": "从本地论文库筛选参考论文",
                "status": "done",
                "summary": if direct_paper_count > 0 {
                    format!("已找到 {} 篇候选参考论文，其中 {} 篇来自当前主题文件夹", paper_hints.len(), direct_paper_count)
                } else {
                    format!("已找到 {} 篇候选参考论文", paper_hints.len())
                }
            }
        }));

        let designer_id = Uuid::new_v4().to_string();
        let _ = app.emit("interest:agent_start", json!({
            "id": rid,
            "agent": {
                "id": designer_id,
                "name": "学习路径规划 Agent",
                "role": "生成结构化学习路线",
                "status": "running"
            }
        }));

        let analysis_scope = analysis_json
            .get("scope")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        let analysis_focus = analysis_json
            .get("focus_topics")
            .and_then(|v| v.as_array())
            .map(|arr| arr.iter().filter_map(|x| x.as_str()).collect::<Vec<&str>>().join("、"))
            .unwrap_or_default();
        let profile_context = profile_to_prompt_context(&profile);
        let prompt = format!(
            "{}\n{}\n\n补充约束：\n- 方向范围：{}\n- 优先覆盖主题：{}\n- 本地候选论文：{}",
            PLANNER_PROMPT
                .replace("{topic}", &topic)
                .replace("{keywords}", &keywords.join(", ")),
            profile_context,
            analysis_scope,
            analysis_focus,
            if paper_hints.is_empty() { "无".to_string() } else { paper_hints.join("；") }
        );
        let designer_model = resolve_model(&settings, &["planner_generation_model"]);
        let designer_temperature = resolve_temperature(&settings, "planner_generation_temperature", 0.3);
        let msgs = vec![LlmMessage::system(planner_system()), LlmMessage::user(&prompt)];
        match client.chat(&msgs, designer_model.as_deref(), designer_temperature).await {
            Ok(resp) => {
                let clean = crate::commands::papers::extract_json_pub(&resp);
                let v: serde_json::Value = enrich_learning_path_json(serde_json::from_str(&clean).unwrap_or_default());
                let path_str = serde_json::to_string(&v).unwrap_or_default();
                let _ = sqlx::query("UPDATE research_interests SET learning_path = ?, status = 'planned' WHERE id = ?")
                    .bind(&path_str).bind(&rid).execute(&db).await;
                let stage_count = v
                    .get("learning_stages")
                    .and_then(|x| x.as_array())
                    .map(|arr| arr.len())
                    .unwrap_or(0);
                let _ = app.emit("interest:agent_complete", json!({
                    "id": rid,
                    "agent": {
                        "id": designer_id,
                        "name": "学习路径规划 Agent",
                        "role": "生成结构化学习路线",
                        "status": "done",
                        "summary": format!("学习路线生成完成，共 {} 个阶段", stage_count)
                    }
                }));
                let _ = app.emit("interest:plan", json!({ "id": rid, "learning_path": v }));
            }
            Err(e) => {
                let _ = app.emit("interest:agent_error", json!({
                    "id": rid,
                    "agent": {
                        "id": designer_id,
                        "name": "学习路径规划 Agent",
                        "role": "生成结构化学习路线",
                        "status": "failed",
                        "error": e.to_string()
                    }
                }));
                let _ = app.emit("interest:error", json!({ "id": rid, "error": e.to_string() }));
            }
        }
    });
    Ok(())
}

#[tauri::command]
pub async fn knowledge_generate_interest_hints(
    state: State<'_, AppState>,
    topic: String,
    keywords: Option<Vec<String>>,
    goal: Option<String>,
    background: Option<String>,
    time_budget: Option<String>,
    constraints: Option<Vec<String>>,
    known_context: Option<String>,
    preferred_output: Option<String>,
) -> Result<serde_json::Value, String> {
    let settings = state.settings.read().await.clone();
    let client = LlmClient::from_settings(&settings).map_err(|e| e.to_string())?;

    let profile = ResearchInterestProfilePayload {
        goal,
        background,
        time_budget,
        constraints,
        known_context,
        preferred_output,
    };
    let keywords = keywords.unwrap_or_default();
    let prompt = INTEREST_HINT_PROMPT.replace("{form}", &format_interest_hint_form(&topic, &keywords, &profile));
    let messages = vec![
        LlmMessage::system(interest_hint_system()),
        LlmMessage::user(prompt),
    ];
    let hint_model = resolve_model(&settings, &["planner_hint_model"]);
    let hint_temperature = resolve_temperature(&settings, "planner_hint_temperature", 0.2);
    let response = client
        .chat(&messages, hint_model.as_deref(), hint_temperature)
        .await
        .map_err(|e| e.to_string())?;
    let clean = crate::commands::papers::extract_json_pub(&response);
    let parsed: serde_json::Value = serde_json::from_str(&clean).map_err(|e| format!("Failed to parse interest hints JSON: {e}"))?;

    let result = ResearchInterestHintResponse {
        summary: parsed
            .get("summary")
            .and_then(|value| value.as_str())
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| "已结合当前输入生成实时建议。".to_string()),
        next_field: normalize_next_field(
            parsed
                .get("next_field")
                .and_then(|value| value.as_str())
        ),
        matched_domains: extract_string_list(parsed.get("matched_domains"), 4),
        keyword_suggestions: extract_string_list(parsed.get("keyword_suggestions"), 6),
        goal_suggestions: extract_string_list(parsed.get("goal_suggestions"), 6),
        background_prompts: extract_string_list(parsed.get("background_prompts"), 6),
        time_budget_suggestions: extract_string_list(parsed.get("time_budget_suggestions"), 6),
        constraint_suggestions: extract_string_list(parsed.get("constraint_suggestions"), 6),
        known_context_suggestions: extract_string_list(parsed.get("known_context_suggestions"), 6),
        output_suggestions: extract_string_list(parsed.get("output_suggestions"), 6),
    };

    Ok(json!(result))
}

// ── Topic Discovery ──────────────────────────────────────────────

const TOPIC_SUGGEST_PROMPT: &str = r#"你是一位资深研究导师，请根据学生情况给出 4~5 个具体、可执行的研究课题方向。

学生情况：
- 感兴趣的研究领域：{field}
- 希望做的研究类型：{goal_type}
- 个人背景：{background}

要求：
- 每个课题必须具体可执行，避免宽泛的领域名词（例如"机器学习"太宽，"基于对比学习的低资源医学图像分割"才是合格的课题）
- 课题名称 10~30 字，使用中文
- 体现近两年学术前沿或有实际落地价值
- 仅返回合法 JSON 数组，不要输出任何其他文本：["课题方向1", "课题方向2", ...]"#;

#[tauri::command]
pub async fn knowledge_suggest_topics(
    state: State<'_, AppState>,
    field: String,
    goal_type: String,
    background: String,
) -> Result<Vec<String>, String> {
    let settings = state.settings.read().await.clone();
    let client = LlmClient::from_settings(&settings).map_err(|e| e.to_string())?;

    let bg = if background.trim().is_empty() { "未提供".to_string() } else { background.trim().to_string() };
    let prompt = TOPIC_SUGGEST_PROMPT
        .replace("{field}", field.trim())
        .replace("{goal_type}", goal_type.trim())
        .replace("{background}", &bg);

    let messages = vec![
        LlmMessage::system("你是一位资深学术导师，擅长帮助研究生找到有价值的研究切入点。"),
        LlmMessage::user(prompt),
    ];
    let model = resolve_model(&settings, &["planner_hint_model"]);
    let temperature = resolve_temperature(&settings, "planner_hint_temperature", 0.7);
    let response = client.chat(&messages, model.as_deref(), temperature).await.map_err(|e| e.to_string())?;
    let clean = crate::commands::papers::extract_json_pub(&response);
    let topics: Vec<String> = serde_json::from_str(&clean)
        .map_err(|e| format!("课题建议解析失败：{e}"))?;
    Ok(topics)
}

fn profile_to_analysis_context(profile: &ResearchInterestProfilePayload) -> String {
    let mut lines = Vec::new();

    if let Some(goal) = profile.goal.as_deref().filter(|value| !value.trim().is_empty()) {
        lines.push(format!("- 用户目标：{}", goal));
    }
    if let Some(background) = profile.background.as_deref().filter(|value| !value.trim().is_empty()) {
        lines.push(format!("- 用户基础：{}", background));
    }
    if let Some(time_budget) = profile.time_budget.as_deref().filter(|value| !value.trim().is_empty()) {
        lines.push(format!("- 时间预算：{}", time_budget));
    }
    if let Some(known_context) = profile.known_context.as_deref().filter(|value| !value.trim().is_empty()) {
        lines.push(format!("- 已知论文/方法：{}", known_context));
    }
    if let Some(preferred_output) = profile.preferred_output.as_deref().filter(|value| !value.trim().is_empty()) {
        lines.push(format!("- 期望输出：{}", preferred_output));
    }
    if let Some(constraints) = profile.constraints.as_ref().filter(|value| !value.is_empty()) {
        lines.push(format!("- 约束条件：{}", constraints.join("、")));
    }

    if lines.is_empty() {
        String::new()
    } else {
        format!("\n补充用户画像：\n{}", lines.join("\n"))
    }
}

fn profile_to_prompt_context(profile: &ResearchInterestProfilePayload) -> String {
    let context = profile_to_analysis_context(profile);
    if context.is_empty() {
        String::new()
    } else {
        format!("{}\n- 请据此调整学习路线的深度、节奏和资源选择。", context)
    }
}

fn format_interest_hint_form(
    topic: &str,
    keywords: &[String],
    profile: &ResearchInterestProfilePayload,
) -> String {
    let to_line = |label: &str, value: Option<&str>| -> String {
        format!("- {}：{}", label, value.filter(|item| !item.trim().is_empty()).unwrap_or("未填写"))
    };

    [
        to_line("研究主题", Some(topic)),
        if keywords.is_empty() {
            "- 关键词：未填写".to_string()
        } else {
            format!("- 关键词：{}", keywords.join("、"))
        },
        to_line("研究目标", profile.goal.as_deref()),
        to_line("当前基础", profile.background.as_deref()),
        to_line("时间预算", profile.time_budget.as_deref()),
        if let Some(items) = profile.constraints.as_ref().filter(|value| !value.is_empty()) {
            format!("- 约束条件：{}", items.join("、"))
        } else {
            "- 约束条件：未填写".to_string()
        },
        to_line("已知论文/方法", profile.known_context.as_deref()),
        to_line("期望输出", profile.preferred_output.as_deref()),
    ]
    .join("\n")
}

fn normalize_next_field(value: Option<&str>) -> String {
    match value.unwrap_or_default().trim() {
        "topic" => "topic",
        "keywords" => "keywords",
        "goal" => "goal",
        "background" => "background",
        "time_budget" => "time_budget",
        "constraints" => "constraints",
        "known_context" => "known_context",
        "preferred_output" => "preferred_output",
        _ => "keywords",
    }
    .to_string()
}

fn extract_string_list(value: Option<&serde_json::Value>, limit: usize) -> Vec<String> {
    let mut seen = HashSet::new();

    value
        .and_then(|items| items.as_array())
        .into_iter()
        .flatten()
        .filter_map(|item| item.as_str())
        .map(|item| item.trim())
        .filter(|item| !item.is_empty())
        .filter(|item| seen.insert(item.to_lowercase()))
        .take(limit)
        .map(|item| item.to_string())
        .collect()
}

fn enrich_learning_path_json(mut value: serde_json::Value) -> serde_json::Value {
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

// ── Knowledge Notes ─────────────────────────────────────────────

#[tauri::command]
pub async fn knowledge_list_notes(
    state: State<'_, AppState>,
    search: Option<String>,
) -> Result<serde_json::Value, String> {
    if let Some(q) = search.filter(|s| !s.is_empty()) {
        let settings = state.settings.read().await.clone();
        if let Ok(client) = LlmClient::embed_client_from_settings(&settings) {
            if let Ok(embeddings) = client.embed(&[q.clone()]).await {
                if let Some(emb) = embeddings.into_iter().next() {
                    let top_k: usize = settings.get("rag_top_k").and_then(|v| v.parse().ok()).unwrap_or(10);
                    let results = crate::rag::search_knowledge_notes(&state.db, &emb, top_k)
                        .await.map_err(|e| e.to_string())?;
                    let mut notes = Vec::new();
                    for r in results {
                        if let Ok(Some(row)) = sqlx::query(
                            "SELECT id, title, content, source_type, source_id, tags, research_interest_id, created_at, updated_at FROM knowledge_notes WHERE id = ?",
                        )
                        .bind(&r.id)
                        .fetch_optional(&state.db)
                        .await
                        {
                            notes.push(note_row_to_json(&row));
                        }
                    }
                    return Ok(json!(notes));
                }
            }
        }
        // Fallback: full-text search
        let like = format!("%{}%", q);
        let rows = sqlx::query(
            "SELECT id, title, content, source_type, source_id, tags, research_interest_id, created_at, updated_at
             FROM knowledge_notes WHERE title LIKE ? OR content LIKE ? ORDER BY created_at DESC LIMIT 20",
        )
        .bind(&like).bind(&like)
        .fetch_all(&state.db)
        .await
        .map_err(|e| e.to_string())?;
        return Ok(json!(rows.iter().map(note_row_to_json).collect::<Vec<_>>()));
    }

    let rows = sqlx::query(
        "SELECT id, title, content, source_type, source_id, tags, research_interest_id, created_at, updated_at
         FROM knowledge_notes ORDER BY created_at DESC",
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;
    Ok(json!(rows.iter().map(note_row_to_json).collect::<Vec<_>>()))
}

#[tauri::command]
pub async fn knowledge_create_note(
    state: State<'_, AppState>,
    title: String,
    content: String,
    tags: Option<Vec<String>>,
    research_interest_id: Option<String>,
) -> Result<serde_json::Value, String> {
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let next_tags = tags.unwrap_or_default();
    let tags_json = serde_json::to_string(&next_tags).unwrap_or_else(|_| "[]".into());
    sqlx::query(
        "INSERT INTO knowledge_notes (id, title, content, tags, research_interest_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id).bind(&title).bind(&content).bind(&tags_json).bind(&research_interest_id).bind(&now).bind(&now)
    .execute(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    let db = state.db.clone();
    let settings = state.settings.read().await.clone();
    let note_id = id.clone();
    let text = format!("{} {}", title, content);
    tokio::spawn(async move {
        if let Ok(client) = LlmClient::embed_client_from_settings(&settings) {
            if let Ok(embeddings) = client.embed(&[text]).await {
                if let Some(emb) = embeddings.into_iter().next() {
                    let emb_str = serialize_embedding(&emb);
                    let _ = sqlx::query("UPDATE knowledge_notes SET embedding = ? WHERE id = ?")
                        .bind(&emb_str).bind(&note_id).execute(&db).await;
                }
            }
        }
    });

    Ok(json!({
        "id": id,
        "title": title,
        "content": content,
        "source_type": "manual",
        "source_id": serde_json::Value::Null,
        "tags": next_tags,
        "research_interest_id": research_interest_id,
        "created_at": now,
        "updated_at": now
    }))
}

#[tauri::command]
pub async fn knowledge_update_note(
    state: State<'_, AppState>,
    id: String,
    title: Option<String>,
    content: Option<String>,
    tags: Option<Vec<String>>,
) -> Result<serde_json::Value, String> {
    let now = chrono::Utc::now().to_rfc3339();
    if let Some(t) = &title {
        sqlx::query("UPDATE knowledge_notes SET title = ?, updated_at = ? WHERE id = ?")
            .bind(t).bind(&now).bind(&id).execute(&state.db).await.map_err(|e| e.to_string())?;
    }
    if let Some(c) = &content {
        sqlx::query("UPDATE knowledge_notes SET content = ?, updated_at = ? WHERE id = ?")
            .bind(c).bind(&now).bind(&id).execute(&state.db).await.map_err(|e| e.to_string())?;
    }
    if let Some(t) = &tags {
        let tj = serde_json::to_string(t).unwrap_or_else(|_| "[]".into());
        sqlx::query("UPDATE knowledge_notes SET tags = ?, updated_at = ? WHERE id = ?")
            .bind(&tj).bind(&now).bind(&id).execute(&state.db).await.map_err(|e| e.to_string())?;
    }
    let row = sqlx::query(
        "SELECT id, title, content, source_type, source_id, tags, research_interest_id, created_at, updated_at FROM knowledge_notes WHERE id = ?",
    )
    .bind(&id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| e.to_string())?
    .ok_or("未找到对应笔记。")?;
    Ok(note_row_to_json(&row))
}

#[tauri::command]
pub async fn knowledge_move_note(
    state: State<'_, AppState>,
    id: String,
    research_interest_id: Option<String>,
) -> Result<serde_json::Value, String> {
    let now = chrono::Utc::now().to_rfc3339();
    let normalized_interest_id = research_interest_id.and_then(|value| {
        let trimmed = value.trim().to_string();
        if trimmed.is_empty() { None } else { Some(trimmed) }
    });

    sqlx::query("UPDATE knowledge_notes SET research_interest_id = ?, updated_at = ? WHERE id = ?")
        .bind(&normalized_interest_id)
        .bind(&now)
        .bind(&id)
        .execute(&state.db)
        .await
        .map_err(|e| e.to_string())?;

    let row = sqlx::query(
        "SELECT id, title, content, source_type, source_id, tags, research_interest_id, created_at, updated_at FROM knowledge_notes WHERE id = ?",
    )
    .bind(&id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| e.to_string())?
    .ok_or("未找到对应笔记。")?;

    Ok(note_row_to_json(&row))
}

#[tauri::command]
pub async fn knowledge_delete_note(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    sqlx::query("DELETE FROM knowledge_notes WHERE id = ?")
        .bind(&id).execute(&state.db).await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn knowledge_search(
    state: State<'_, AppState>,
    q: String,
    top_k: Option<i64>,
) -> Result<serde_json::Value, String> {
    let top_k = top_k.unwrap_or(5) as usize;
    let settings = state.settings.read().await.clone();
    let client = match LlmClient::embed_client_from_settings(&settings) {
        Ok(c) => c,
        Err(_) => return Ok(json!([])),
    };
    let embeddings = match client.embed(&[q]).await {
        Ok(e) => e,
        Err(_) => return Ok(json!([])),
    };
    let emb = match embeddings.into_iter().next() {
        Some(e) => e,
        None => return Ok(json!([])),
    };
    let results = combined_search(&state.db, &emb, top_k).await.map_err(|e| e.to_string())?;
    Ok(json!(results.into_iter().map(|r| json!({ "id": r.id, "content": r.content, "source": r.source, "score": r.score })).collect::<Vec<_>>()))
}

// ── Helper ───────────────────────────────────────────────────────

fn note_row_to_json(r: &sqlx::sqlite::SqliteRow) -> serde_json::Value {
    let tags_str: String = r.get::<Option<String>, _>("tags").unwrap_or_else(|| "[]".into());
    json!({
        "id": r.get::<String, _>("id"),
        "title": r.get::<String, _>("title"),
        "content": r.get::<String, _>("content"),
        "source_type": r.get::<String, _>("source_type"),
        "source_id": r.get::<Option<String>, _>("source_id"),
        "tags": serde_json::from_str::<serde_json::Value>(&tags_str).unwrap_or(json!([])),
        "research_interest_id": r.get::<Option<String>, _>("research_interest_id"),
        "created_at": r.get::<String, _>("created_at"),
        "updated_at": r.get::<String, _>("updated_at"),
    })
}

fn research_interest_row_to_json(r: &sqlx::sqlite::SqliteRow) -> serde_json::Value {
    let keywords: String = r
        .get::<Option<String>, _>("keywords")
        .unwrap_or_else(|| "[]".into());
    let profile_str: Option<String> = r.get::<Option<String>, _>("profile");
    let learning_path = r
        .get::<Option<String>, _>("learning_path")
        .and_then(|value| serde_json::from_str::<serde_json::Value>(&value).ok())
        .map(enrich_learning_path_json);

    json!({
        "id": r.get::<String, _>("id"),
        "topic": r.get::<String, _>("topic"),
        "folder_name": r.get::<Option<String>, _>("folder_name"),
        "keywords": serde_json::from_str::<serde_json::Value>(&keywords).unwrap_or(json!([])),
        "profile": profile_str.and_then(|value| serde_json::from_str::<serde_json::Value>(&value).ok()),
        "learning_path": learning_path,
        "status": r.get::<String, _>("status"),
        "created_at": r.get::<String, _>("created_at"),
    })
}

fn default_interest_folder_name(topic: &str) -> String {
    let trimmed = topic.trim();
    if trimmed.is_empty() {
        "未命名主题".to_string()
    } else {
        trimmed.to_string()
    }
}
