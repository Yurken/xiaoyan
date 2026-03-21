use crate::llm::{resolve_model, resolve_temperature, LlmClient, LlmMessage};
use crate::rag::{chunk_text, serialize_embedding};
use crate::state::AppState;
use serde_json::json;
use sqlx::Row;
use tauri::{Emitter, State};
use uuid::Uuid;

// ── List ────────────────────────────────────────────────────────

#[tauri::command]
pub async fn papers_list(
    state: State<'_, AppState>,
    offset: Option<i64>,
    limit: Option<i64>,
) -> Result<serde_json::Value, String> {
    let offset = offset.unwrap_or(0);
    let limit = limit.unwrap_or(20);
    let rows = sqlx::query(
        "SELECT p.id, p.title, p.authors, p.abstract, p.year, p.venue, p.doi, p.tags, p.status, p.created_at, p.updated_at,
                a.research_question, a.core_method, a.experiment_design, a.innovations, a.limitations, a.key_conclusions,
                rg.environment_setup, rg.dependencies, rg.dataset_preparation, rg.training_process,
                rg.inference_process, rg.evaluation_metrics, rg.risks_and_notes
         FROM papers p
         LEFT JOIN paper_analyses a ON a.paper_id = p.id
         LEFT JOIN reproduction_guides rg ON rg.paper_id = p.id
         ORDER BY p.created_at DESC LIMIT ? OFFSET ?",
    )
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    let papers: Vec<serde_json::Value> = rows
        .iter()
        .map(|r| {
            let mut v = paper_row_to_json(r, false);
            // Attach analysis inline if any field is present
            let rq: Option<String> = r.try_get("research_question").ok().flatten();
            if rq.is_some() {
                v["analysis"] = json!({
                    "research_question": r.try_get::<Option<String>, _>("research_question").ok().flatten(),
                    "core_method": r.try_get::<Option<String>, _>("core_method").ok().flatten(),
                    "experiment_design": r.try_get::<Option<String>, _>("experiment_design").ok().flatten(),
                    "innovations": r.try_get::<Option<String>, _>("innovations").ok().flatten(),
                    "limitations": r.try_get::<Option<String>, _>("limitations").ok().flatten(),
                    "key_conclusions": r.try_get::<Option<String>, _>("key_conclusions").ok().flatten(),
                });
            }
            let env: Option<String> = r.try_get("environment_setup").ok().flatten();
            if env.is_some() {
                v["reproduction_guide"] = json!({
                    "environment_setup": r.try_get::<Option<String>, _>("environment_setup").ok().flatten(),
                    "dependencies": r.try_get::<Option<String>, _>("dependencies").ok().flatten(),
                    "dataset_preparation": r.try_get::<Option<String>, _>("dataset_preparation").ok().flatten(),
                    "training_process": r.try_get::<Option<String>, _>("training_process").ok().flatten(),
                    "inference_process": r.try_get::<Option<String>, _>("inference_process").ok().flatten(),
                    "evaluation_metrics": r.try_get::<Option<String>, _>("evaluation_metrics").ok().flatten(),
                    "risks_and_notes": r.try_get::<Option<String>, _>("risks_and_notes").ok().flatten(),
                });
            }
            v
        })
        .collect();
    Ok(json!(papers))
}

// ── Get ─────────────────────────────────────────────────────────

#[tauri::command]
pub async fn papers_get(
    state: State<'_, AppState>,
    id: String,
) -> Result<serde_json::Value, String> {
    let row = sqlx::query(
        "SELECT id, title, authors, abstract, year, venue, doi, file_path, tags, status, created_at, updated_at
         FROM papers WHERE id = ?",
    )
    .bind(&id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| e.to_string())?
    .ok_or_else(|| "Paper not found".to_string())?;

    let analysis = sqlx::query(
        "SELECT id, research_question, core_method, experiment_design, innovations, limitations, key_conclusions, created_at
         FROM paper_analyses WHERE paper_id = ?",
    )
    .bind(&id)
    .fetch_optional(&state.db)
    .await
    .ok()
    .flatten()
    .map(|a: sqlx::sqlite::SqliteRow| {
        json!({
            "id": a.get::<String, _>("id"),
            "research_question": a.get::<Option<String>, _>("research_question"),
            "core_method": a.get::<Option<String>, _>("core_method"),
            "experiment_design": a.get::<Option<String>, _>("experiment_design"),
            "innovations": a.get::<Option<String>, _>("innovations"),
            "limitations": a.get::<Option<String>, _>("limitations"),
            "key_conclusions": a.get::<Option<String>, _>("key_conclusions"),
            "created_at": a.get::<String, _>("created_at"),
        })
    });

    let guide = sqlx::query(
        "SELECT id, environment_setup, dependencies, dataset_preparation, training_process, inference_process, evaluation_metrics, risks_and_notes, created_at
         FROM reproduction_guides WHERE paper_id = ?",
    )
    .bind(&id)
    .fetch_optional(&state.db)
    .await
    .ok()
    .flatten()
    .map(|g: sqlx::sqlite::SqliteRow| {
        json!({
            "id": g.get::<String, _>("id"),
            "environment_setup": g.get::<Option<String>, _>("environment_setup"),
            "dependencies": g.get::<Option<String>, _>("dependencies"),
            "dataset_preparation": g.get::<Option<String>, _>("dataset_preparation"),
            "training_process": g.get::<Option<String>, _>("training_process"),
            "inference_process": g.get::<Option<String>, _>("inference_process"),
            "evaluation_metrics": g.get::<Option<String>, _>("evaluation_metrics"),
            "risks_and_notes": g.get::<Option<String>, _>("risks_and_notes"),
            "created_at": g.get::<String, _>("created_at"),
        })
    });

    let mut paper = paper_row_to_json(&row, true);
    if let Some(obj) = paper.as_object_mut() {
        obj.insert("analysis".into(), analysis.unwrap_or(serde_json::Value::Null));
        obj.insert("reproduction_guide".into(), guide.unwrap_or(serde_json::Value::Null));
    }
    Ok(paper)
}

// ── Delete ───────────────────────────────────────────────────────

#[tauri::command]
pub async fn papers_delete(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    sqlx::query("DELETE FROM papers WHERE id = ?")
        .bind(&id)
        .execute(&state.db)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ── Upload ───────────────────────────────────────────────────────

#[tauri::command]
pub async fn papers_upload(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    file_path: tauri_plugin_fs::FilePath,
) -> Result<serde_json::Value, String> {
    let path = file_path.into_path().map_err(|e| e.to_string())?;
    let file_path_str = path.to_string_lossy().to_string();
    let file_name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown.pdf");
    let title_guess = file_name
        .strip_suffix(".pdf")
        .unwrap_or(file_name)
        .replace(['_', '-'], " ");

    let full_text = pdf_extract::extract_text(&path)
        .map_err(|e| format!("PDF extraction failed: {e}"))?;

    let paper_id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    sqlx::query(
        "INSERT INTO papers (id, title, file_path, full_text, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'parsed', ?, ?)",
    )
    .bind(&paper_id)
    .bind(&title_guess)
    .bind(&file_path_str)
    .bind(&full_text)
    .bind(&now)
    .bind(&now)
    .execute(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    // Background: chunk + embed
    let db = state.db.clone();
    let settings = state.settings.read().await.clone();
    let pid = paper_id.clone();
    let text = full_text.clone();
    let chunk_size: usize = settings.get("chunk_size").and_then(|v| v.parse().ok()).unwrap_or(800);
    let chunk_overlap: usize = settings.get("chunk_overlap").and_then(|v| v.parse().ok()).unwrap_or(150);

    tokio::spawn(async move {
        let chunks = chunk_text(&text, chunk_size, chunk_overlap);
        let contents: Vec<String> = chunks.iter().map(|c| c.content.clone()).collect();
        let embeddings: Option<Vec<Vec<f32>>> = if let Ok(client) = LlmClient::embed_client_from_settings(&settings) {
            client.embed(&contents).await.ok()
        } else {
            None
        };

        let chunk_now = chrono::Utc::now().to_rfc3339();
        for (i, chunk) in chunks.iter().enumerate() {
            let chunk_id = Uuid::new_v4().to_string();
            let emb_str: Option<String> = embeddings.as_ref().and_then(|v| v.get(i)).map(|e| serialize_embedding(e));
            let idx = chunk.chunk_index as i64;
            let _ = sqlx::query(
                "INSERT INTO paper_chunks (id, paper_id, chunk_index, content, embedding, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            )
            .bind(&chunk_id)
            .bind(&pid)
            .bind(idx)
            .bind(&chunk.content)
            .bind(&emb_str)
            .bind(&chunk_now)
            .execute(&db)
            .await;
        }
        let _ = sqlx::query("UPDATE papers SET status = 'parsed', updated_at = ? WHERE id = ?")
            .bind(&chunk_now)
            .bind(&pid)
            .execute(&db)
            .await;
        let _ = app.emit("paper:status", json!({ "paper_id": pid, "status": "parsed" }));
    });

    Ok(json!({ "paper_id": paper_id, "title": title_guess }))
}

// ── Analyze ──────────────────────────────────────────────────────

const ANALYZE_SYSTEM: &str = "你是一位资深学术研究员，专注于论文精读与分析。";
const ANALYZE_PROMPT: &str = r#"请对以下论文进行精读分析，以严格的 JSON 格式返回（不要输出 JSON 以外的内容）：

{text}

返回格式：
{{"research_question":"...","core_method":"...","experiment_design":"...","innovations":"...","limitations":"...","key_conclusions":"..."}}"#;

#[tauri::command]
pub async fn papers_analyze(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    let row = sqlx::query("SELECT full_text FROM papers WHERE id = ?")
        .bind(&id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("Paper not found")?;
    let full_text: String = row.get::<Option<String>, _>("full_text").unwrap_or_default();
    let text_preview = if full_text.len() > 12000 { &full_text[..12000] } else { &full_text };
    let settings = state.settings.read().await.clone();
    let db = state.db.clone();
    let pid = id.clone();
    let prompt = ANALYZE_PROMPT.replace("{text}", text_preview);

    // Mark as analyzing immediately so the UI can react
    let now_pre = chrono::Utc::now().to_rfc3339();
    let _ = sqlx::query("UPDATE papers SET status = 'analyzing', updated_at = ? WHERE id = ?")
        .bind(&now_pre)
        .bind(&id)
        .execute(&state.db)
        .await;

    tokio::spawn(async move {
        let client = match LlmClient::from_settings(&settings) {
            Ok(c) => c,
            Err(e) => {
                let _ = app.emit("paper:status", json!({ "paper_id": pid, "status": "error", "error": e.to_string() }));
                return;
            }
        };
        let model = resolve_model(&settings, &["paper_analysis_model", "multi_agent_paper_analyst_model", "multi_agent_worker_model"]);
        let temperature = resolve_temperature(&settings, "paper_analysis_temperature", 0.3);
        let msgs = vec![LlmMessage::system(ANALYZE_SYSTEM), LlmMessage::user(&prompt)];

        match client.chat(&msgs, model.as_deref(), temperature).await {
            Ok(response) => {
                let v: serde_json::Value = serde_json::from_str(&extract_json(&response)).unwrap_or_default();
                let analysis_id = Uuid::new_v4().to_string();
                let now = chrono::Utc::now().to_rfc3339();
                let raw = serde_json::to_string(&v).unwrap_or_default();
                let _ = sqlx::query(
                    "INSERT INTO paper_analyses (id, paper_id, research_question, core_method, experiment_design, innovations, limitations, key_conclusions, raw_analysis, created_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                     ON CONFLICT(paper_id) DO UPDATE SET
                       research_question = excluded.research_question, core_method = excluded.core_method,
                       experiment_design = excluded.experiment_design, innovations = excluded.innovations,
                       limitations = excluded.limitations, key_conclusions = excluded.key_conclusions,
                       raw_analysis = excluded.raw_analysis",
                )
                .bind(&analysis_id).bind(&pid)
                .bind(v["research_question"].as_str()).bind(v["core_method"].as_str())
                .bind(v["experiment_design"].as_str()).bind(v["innovations"].as_str())
                .bind(v["limitations"].as_str()).bind(v["key_conclusions"].as_str())
                .bind(&raw).bind(&now)
                .execute(&db).await;
                let _ = sqlx::query("UPDATE papers SET status = 'analyzed', updated_at = ? WHERE id = ?")
                    .bind(&now).bind(&pid).execute(&db).await;
                let _ = app.emit("paper:status", json!({ "paper_id": pid, "status": "analyzed" }));
            }
            Err(e) => {
                let _ = app.emit("paper:status", json!({ "paper_id": pid, "status": "error", "error": e.to_string() }));
            }
        }
    });
    Ok(())
}

// ── Reproduce ────────────────────────────────────────────────────

const REPRODUCE_SYSTEM: &str = "你是一位经验丰富的 ML 工程师，专注于论文复现。";
const REPRODUCE_PROMPT: &str = r#"请根据以下论文内容生成复现指南，以严格的 JSON 格式返回：

{text}

返回格式：
{{"environment_setup":"...","dependencies":"...","dataset_preparation":"...","training_process":"...","inference_process":"...","evaluation_metrics":"...","risks_and_notes":"..."}}"#;

#[tauri::command]
pub async fn papers_reproduce(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    let row = sqlx::query("SELECT full_text FROM papers WHERE id = ?")
        .bind(&id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("Paper not found")?;
    let full_text: String = row.get::<Option<String>, _>("full_text").unwrap_or_default();
    let text_preview = if full_text.len() > 12000 { &full_text[..12000] } else { &full_text };
    let settings = state.settings.read().await.clone();
    let db = state.db.clone();
    let pid = id.clone();
    let prompt = REPRODUCE_PROMPT.replace("{text}", text_preview);

    let now_pre = chrono::Utc::now().to_rfc3339();
    let _ = sqlx::query("UPDATE papers SET status = 'analyzing', updated_at = ? WHERE id = ?")
        .bind(&now_pre)
        .bind(&id)
        .execute(&state.db)
        .await;

    tokio::spawn(async move {
        let client = match LlmClient::from_settings(&settings) {
            Ok(c) => c,
            Err(e) => {
                let _ = app.emit("paper:status", json!({ "paper_id": pid, "status": "error", "error": e.to_string() }));
                return;
            }
        };
        let model = resolve_model(&settings, &["paper_reproduction_model", "multi_agent_reproduction_model", "multi_agent_worker_model"]);
        let temperature = resolve_temperature(&settings, "paper_reproduction_temperature", 0.25);
        let msgs = vec![LlmMessage::system(REPRODUCE_SYSTEM), LlmMessage::user(&prompt)];

        match client.chat(&msgs, model.as_deref(), temperature).await {
            Ok(response) => {
                let v: serde_json::Value = serde_json::from_str(&extract_json(&response)).unwrap_or_default();
                let guide_id = Uuid::new_v4().to_string();
                let now = chrono::Utc::now().to_rfc3339();
                let raw = serde_json::to_string(&v).unwrap_or_default();
                let _ = sqlx::query(
                    "INSERT INTO reproduction_guides (id, paper_id, environment_setup, dependencies, dataset_preparation, training_process, inference_process, evaluation_metrics, risks_and_notes, raw_guide, created_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                     ON CONFLICT(paper_id) DO UPDATE SET
                       environment_setup = excluded.environment_setup, dependencies = excluded.dependencies,
                       dataset_preparation = excluded.dataset_preparation, training_process = excluded.training_process,
                       inference_process = excluded.inference_process, evaluation_metrics = excluded.evaluation_metrics,
                       risks_and_notes = excluded.risks_and_notes, raw_guide = excluded.raw_guide",
                )
                .bind(&guide_id).bind(&pid)
                .bind(v["environment_setup"].as_str()).bind(v["dependencies"].as_str())
                .bind(v["dataset_preparation"].as_str()).bind(v["training_process"].as_str())
                .bind(v["inference_process"].as_str()).bind(v["evaluation_metrics"].as_str())
                .bind(v["risks_and_notes"].as_str()).bind(&raw).bind(&now)
                .execute(&db).await;
                let _ = sqlx::query("UPDATE papers SET status = 'reproduced', updated_at = ? WHERE id = ?")
                    .bind(&now).bind(&pid).execute(&db).await;
                let _ = app.emit("paper:status", json!({ "paper_id": pid, "status": "reproduced" }));
            }
            Err(e) => {
                let _ = app.emit("paper:status", json!({ "paper_id": pid, "status": "error", "error": e.to_string() }));
            }
        }
    });
    Ok(())
}

// ── Helpers ──────────────────────────────────────────────────────

pub fn extract_json_pub(s: &str) -> String {
    extract_json(s)
}

pub(crate) fn extract_json(s: &str) -> String {
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

fn paper_row_to_json(r: &sqlx::sqlite::SqliteRow, _include_file_path: bool) -> serde_json::Value {
    let tags_str: String = r.get::<Option<String>, _>("tags").unwrap_or_else(|| "[]".into());
    // "abstract" is a Rust reserved keyword; fetch into a variable first
    let paper_abstract: Option<String> = r.get("abstract");
    let mut obj = json!({
        "id": r.get::<String, _>("id"),
        "title": r.get::<String, _>("title"),
        "authors": r.get::<Option<String>, _>("authors"),
        "year": r.get::<Option<i64>, _>("year"),
        "venue": r.get::<Option<String>, _>("venue"),
        "doi": r.get::<Option<String>, _>("doi"),
        "tags": serde_json::from_str::<serde_json::Value>(&tags_str).unwrap_or(json!([])),
        "status": r.get::<String, _>("status"),
        "created_at": r.get::<String, _>("created_at"),
        "updated_at": r.get::<String, _>("updated_at"),
    });
    obj["abstract"] = json!(paper_abstract);
    obj
}
