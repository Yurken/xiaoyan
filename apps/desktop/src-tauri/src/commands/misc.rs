use crate::llm::{LlmClient, LlmMessage};
use crate::state::AppState;
use serde_json::json;
use sqlx::Row;
use tauri::{Emitter, State};

// ── Planner ─────────────────────────────────────────────────────

const PLANNER_SYS: &str = "你是一位顶尖的研究方向规划专家，帮助研究者设计系统化的研究学习路径。";
const PLANNER_TPL: &str = r#"请为研究主题「{topic}」（关键词：{keywords}）规划研究学习路径。以 JSON 格式返回：
{{
  "overview": "领域概述（2-3句）",
  "prerequisites": [{{"name": "前置知识名", "description": "说明", "resources": ["推荐资源"]}}],
  "learning_stages": [{{"stage": 1, "title": "阶段标题", "duration": "预计时长", "goals": ["学习目标"], "topics": ["学习主题"], "resources": ["资源"]}}],
  "classic_papers": [{{"title": "论文标题", "authors": "作者", "year": 2020, "reason": "推荐理由"}}],
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
        match client.chat(&msgs, None, 0.3).await {
            Ok(resp) => {
                let clean = extract_json(&resp);
                let v: serde_json::Value = serde_json::from_str(&clean).unwrap_or(json!({"raw": resp}));
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

const SURVEY_SYS: &str = "你是一位文献综述专家，能够快速梳理研究领域的发展脉络、核心方法和前沿进展。";
const SURVEY_TPL: &str = r#"请就「{query}」撰写一份学术文献综述，内容包括：
1. 领域背景与重要性
2. 主要研究方向与方法分类
3. 关键论文与代表性工作（含作者、年份）
4. 各方向优缺点对比
5. 当前挑战与未来趋势

要求：结构清晰、引用具体、适合快速了解领域全貌。"#;

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
        let client = match LlmClient::from_settings(&settings) {
            Ok(c) => c,
            Err(e) => {
                let _ = app.emit("survey:error", json!({ "error": e.to_string() }));
                return;
            }
        };

        // Try RAG: embed query and search papers
        let rag_context = if let Ok(embeddings) = client.embed(&[query.clone()]).await {
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
        };

        let prompt_base = SURVEY_TPL.replace("{query}", &query);
        let prompt = if rag_context.is_empty() {
            prompt_base
        } else {
            format!("{}\n\n以下是知识库中的相关内容供参考：\n\n{}", prompt_base, rag_context)
        };

        let rid = uuid::Uuid::new_v4().to_string();
        let msgs = vec![LlmMessage::system(SURVEY_SYS), LlmMessage::user(&prompt)];
        let app_clone = app.clone();
        let rid_clone = rid.clone();

        match client.stream_chat(&msgs, None, 0.4, move |delta| {
            let _ = app_clone.emit("survey:delta", json!({ "request_id": rid_clone, "delta": delta }));
        }).await {
            Ok(full) => {
                let _ = app.emit("survey:done", json!({ "request_id": rid, "content": full }));
            }
            Err(e) => {
                let _ = app.emit("survey:error", json!({ "error": e.to_string() }));
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
    if let Ok(client) = LlmClient::from_settings(&settings) {
        if let Ok(embeddings) = client.embed(&[query.clone()]).await {
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
