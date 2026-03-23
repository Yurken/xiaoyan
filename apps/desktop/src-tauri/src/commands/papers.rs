use crate::assistant_prompts::specialist_system;
use crate::ccf::{infer_from_text, match_venue};
use crate::journal_partitions::match_journal;
use crate::links::paper_reference_url;
use crate::llm::{resolve_model, resolve_temperature, LlmClient, LlmMessage};
use crate::rag::{chunk_text, serialize_embedding};
use crate::state::AppState;
use serde::Deserialize;
use serde_json::json;
use sqlx::Row;
use std::path::{Path, PathBuf};
use tauri::{Emitter, State};
use uuid::Uuid;

// ── List ────────────────────────────────────────────────────────

#[tauri::command]
pub async fn papers_list(
    state: State<'_, AppState>,
    offset: Option<i64>,
    limit: Option<i64>,
    research_interest_id: Option<String>,
) -> Result<serde_json::Value, String> {
    let offset = offset.unwrap_or(0);
    let limit = limit.unwrap_or(20);
    let rows = if let Some(interest_id) = research_interest_id.filter(|value| !value.trim().is_empty()) {
        sqlx::query(
            "SELECT p.id, p.title, p.authors, p.abstract, p.year, p.venue, p.doi, p.file_path, p.tags, p.research_interest_id, p.status, p.created_at, p.updated_at,
                    a.research_question, a.core_method, a.experiment_design, a.experiment_results, a.innovations, a.limitations, a.key_conclusions,
                    rg.code_repository, rg.environment_setup, rg.dependencies, rg.dataset_preparation, rg.training_process,
                    rg.inference_process, rg.evaluation_metrics, rg.risks_and_notes
             FROM papers p
             LEFT JOIN paper_analyses a ON a.paper_id = p.id
             LEFT JOIN reproduction_guides rg ON rg.paper_id = p.id
             WHERE p.research_interest_id = ?
             ORDER BY p.created_at DESC LIMIT ? OFFSET ?",
        )
        .bind(&interest_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(&state.db)
        .await
        .map_err(|e| e.to_string())?
    } else {
        sqlx::query(
            "SELECT p.id, p.title, p.authors, p.abstract, p.year, p.venue, p.doi, p.file_path, p.tags, p.research_interest_id, p.status, p.created_at, p.updated_at,
                    a.research_question, a.core_method, a.experiment_design, a.experiment_results, a.innovations, a.limitations, a.key_conclusions,
                    rg.code_repository, rg.environment_setup, rg.dependencies, rg.dataset_preparation, rg.training_process,
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
        .map_err(|e| e.to_string())?
    };

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
                    "experiment_results": r.try_get::<Option<String>, _>("experiment_results").ok().flatten(),
                    "innovations": r.try_get::<Option<String>, _>("innovations").ok().flatten(),
                    "limitations": r.try_get::<Option<String>, _>("limitations").ok().flatten(),
                    "key_conclusions": r.try_get::<Option<String>, _>("key_conclusions").ok().flatten(),
                });
            }
            let env: Option<String> = r.try_get("environment_setup").ok().flatten();
            if env.is_some() {
                v["reproduction_guide"] = json!({
                    "code_repository": r.try_get::<Option<String>, _>("code_repository").ok().flatten(),
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
        "SELECT id, title, authors, abstract, year, venue, doi, file_path, tags, research_interest_id, status, created_at, updated_at
         FROM papers WHERE id = ?",
    )
    .bind(&id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| e.to_string())?
    .ok_or_else(|| "未找到对应论文。".to_string())?;

    let analysis = sqlx::query(
        "SELECT id, research_question, core_method, experiment_design, experiment_results, innovations, limitations, key_conclusions, created_at
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
            "experiment_results": a.get::<Option<String>, _>("experiment_results"),
            "innovations": a.get::<Option<String>, _>("innovations"),
            "limitations": a.get::<Option<String>, _>("limitations"),
            "key_conclusions": a.get::<Option<String>, _>("key_conclusions"),
            "created_at": a.get::<String, _>("created_at"),
        })
    });

    let guide = sqlx::query(
        "SELECT id, code_repository, environment_setup, dependencies, dataset_preparation, training_process, inference_process, evaluation_metrics, risks_and_notes, created_at
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
            "code_repository": g.get::<Option<String>, _>("code_repository"),
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

#[tauri::command]
pub async fn papers_update(
    state: State<'_, AppState>,
    id: String,
    title: Option<String>,
    authors: Option<String>,
    venue: Option<String>,
    year: Option<i64>,
    doi: Option<String>,
    research_interest_id: Option<String>,
) -> Result<serde_json::Value, String> {
    let now = chrono::Utc::now().to_rfc3339();

    if let Some(value) = title {
        let next = value.trim();
        if next.is_empty() {
            return Err("论文标题不能为空".to_string());
        }
        sqlx::query("UPDATE papers SET title = ?, updated_at = ? WHERE id = ?")
            .bind(next)
            .bind(&now)
            .bind(&id)
            .execute(&state.db)
            .await
            .map_err(|e| e.to_string())?;
    }

    if let Some(value) = authors {
        let next = value.trim();
        sqlx::query("UPDATE papers SET authors = ?, updated_at = ? WHERE id = ?")
            .bind(if next.is_empty() { None::<String> } else { Some(next.to_string()) })
            .bind(&now)
            .bind(&id)
            .execute(&state.db)
            .await
            .map_err(|e| e.to_string())?;
    }

    if let Some(value) = venue {
        let next = value.trim();
        sqlx::query("UPDATE papers SET venue = ?, updated_at = ? WHERE id = ?")
            .bind(if next.is_empty() { None::<String> } else { Some(next.to_string()) })
            .bind(&now)
            .bind(&id)
            .execute(&state.db)
            .await
            .map_err(|e| e.to_string())?;
    }

    if let Some(value) = year {
        sqlx::query("UPDATE papers SET year = ?, updated_at = ? WHERE id = ?")
            .bind(if value <= 0 { None } else { Some(value) })
            .bind(&now)
            .bind(&id)
            .execute(&state.db)
            .await
            .map_err(|e| e.to_string())?;
    }

    if let Some(value) = doi {
        let next = value.trim();
        sqlx::query("UPDATE papers SET doi = ?, updated_at = ? WHERE id = ?")
            .bind(if next.is_empty() { None::<String> } else { Some(next.to_string()) })
            .bind(&now)
            .bind(&id)
            .execute(&state.db)
            .await
            .map_err(|e| e.to_string())?;
    }

    if let Some(value) = research_interest_id {
        let next = value.trim();
        sqlx::query("UPDATE papers SET research_interest_id = ?, updated_at = ? WHERE id = ?")
            .bind(if next.is_empty() { None::<String> } else { Some(next.to_string()) })
            .bind(&now)
            .bind(&id)
            .execute(&state.db)
            .await
            .map_err(|e| e.to_string())?;
    }

    papers_get(state, id).await
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

#[derive(Debug, Clone, Deserialize, Default)]
struct ImportRenameMetadata {
    title: Option<String>,
    authors: Option<String>,
    year: Option<i64>,
    venue: Option<String>,
    doi: Option<String>,
}

const IMPORT_RENAME_PROMPT: &str = r#"请根据用户提供的 PDF 文件名和正文前段识别论文元数据，仅返回合法 JSON：
{"title":"...","authors":"作者1, 作者2","year":2024,"venue":"期刊或会议名称","doi":"10.1234/abcd"}

要求：
1. title 尽量使用论文首页中的正式标题，不要保留文件名噪声。
2. authors 返回单行作者列表，使用英文逗号分隔。
3. year 无法确认时返回 0。
4. venue 无法确认时返回空字符串。
5. doi 仅返回 DOI 本身；没有就返回空字符串。
6. 不要输出 markdown、解释或额外文本。

文件名：{file_name}
当前标题猜测：{title_guess}
正文前段：
{text}
"#;

fn import_rename_system() -> String {
    specialist_system(
        "论文元数据识别助手",
        "从文件名和正文片段中提取稳定、可信的论文元数据。",
        Some("输出必须严格、克制、可直接用于归档。"),
    )
}

#[tauri::command]
pub async fn papers_upload(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    file_path: tauri_plugin_fs::FilePath,
    research_interest_id: Option<String>,
) -> Result<serde_json::Value, String> {
    let path = file_path.into_path().map_err(|e| e.to_string())?;
    let file_name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown.pdf");
    let original_stem = path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("unknown")
        .to_string();
    let title_guess = file_name
        .strip_suffix(".pdf")
        .unwrap_or(file_name)
        .replace(['_', '-'], " ");

    let full_text = pdf_extract::extract_text(&path)
        .map_err(|e| format!("PDF 解析失败：{e}"))?;
    let settings = state.settings.read().await.clone();
    let inferred_venue = infer_from_text(&full_text).map(|tag| tag.full_name);
    let auto_rename_enabled = settings
        .get("paper_auto_rename_on_import")
        .map(|value| value.trim().eq_ignore_ascii_case("true"))
        .unwrap_or(false);

    let mut detected_title = title_guess.clone();
    let mut detected_authors: Option<String> = None;
    let mut detected_year: Option<i64> = None;
    let mut detected_venue = inferred_venue;
    let mut detected_doi: Option<String> = None;
    let mut final_path = path.clone();

    if auto_rename_enabled {
        if let Some(metadata) = extract_import_rename_metadata(&settings, file_name, &title_guess, &full_text).await {
            let rename_rule = settings
                .get("paper_auto_rename_rule")
                .map(|value| value.as_str())
                .unwrap_or("{first_author} - {title} ({year})");
            let rename_stem = render_import_file_stem(
                rename_rule,
                &metadata,
                &title_guess,
                &original_stem,
            );

            if let Some(value) = clean_optional_text(metadata.title) {
                detected_title = value;
            }
            detected_authors = clean_optional_text(metadata.authors);
            detected_year = metadata.year.filter(|value| *value > 0);
            detected_venue = clean_optional_text(metadata.venue).or(detected_venue);
            detected_doi = clean_optional_text(metadata.doi);
            if let Ok(next_path) = maybe_rename_imported_pdf(&path, &rename_stem) {
                final_path = next_path;
            }
        }
    }

    let file_path_str = final_path.to_string_lossy().to_string();

    let paper_id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    sqlx::query(
        "INSERT INTO papers (id, title, authors, year, venue, doi, file_path, full_text, research_interest_id, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'parsed', ?, ?)",
    )
    .bind(&paper_id)
    .bind(&detected_title)
    .bind(&detected_authors)
    .bind(detected_year)
    .bind(&detected_venue)
    .bind(&detected_doi)
    .bind(&file_path_str)
    .bind(&full_text)
    .bind(&research_interest_id)
    .bind(&now)
    .bind(&now)
    .execute(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    // Background: chunk + embed
    let db = state.db.clone();
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

    Ok(json!({ "paper_id": paper_id, "title": detected_title }))
}

// ── Analyze ──────────────────────────────────────────────────────

const ANALYZE_PROMPT: &str = r#"请对以下论文进行精读分析，仅返回严格合法的 JSON，不要输出 JSON 以外的内容。

要求：
- 所有字段内容必须使用中文
- 如有多条并列内容或带序号的条目，在 JSON 字符串中用 \n 分隔每一条（例如："1. xxx\n2. yyy\n3. zzz"）
- 每个字段限 150 字以内，保持简洁

{text}

返回格式：
{{"research_question":"...","core_method":"...","experiment_design":"...","experiment_results":"...","innovations":"...","limitations":"...","key_conclusions":"..."}}"#;

fn analyze_system() -> String {
    specialist_system(
        "论文精读分析助手",
        "基于论文内容输出客观、结构化、可追溯的分析结论。",
        Some("不得编造论文中未出现的信息。"),
    )
}

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
        .ok_or("未找到对应论文。")?;
    let full_text: String = row.get::<Option<String>, _>("full_text").unwrap_or_default();
    let text_preview = safe_text_preview(&full_text, 12000);
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
        let msgs = vec![LlmMessage::system(analyze_system()), LlmMessage::user(&prompt)];

        match client.chat(&msgs, model.as_deref(), temperature).await {
            Ok(response) => {
                let v: serde_json::Value = serde_json::from_str(&extract_json(&response)).unwrap_or_default();
                let analysis_id = Uuid::new_v4().to_string();
                let now = chrono::Utc::now().to_rfc3339();
                let raw = serde_json::to_string(&v).unwrap_or_default();
                let _ = sqlx::query(
                    "INSERT INTO paper_analyses (id, paper_id, research_question, core_method, experiment_design, experiment_results, innovations, limitations, key_conclusions, raw_analysis, created_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                     ON CONFLICT(paper_id) DO UPDATE SET
                       research_question = excluded.research_question, core_method = excluded.core_method,
                       experiment_design = excluded.experiment_design, experiment_results = excluded.experiment_results,
                       innovations = excluded.innovations, limitations = excluded.limitations,
                       key_conclusions = excluded.key_conclusions, raw_analysis = excluded.raw_analysis",
                )
                .bind(&analysis_id).bind(&pid)
                .bind(v["research_question"].as_str()).bind(v["core_method"].as_str())
                .bind(v["experiment_design"].as_str()).bind(v["experiment_results"].as_str())
                .bind(v["innovations"].as_str()).bind(v["limitations"].as_str())
                .bind(v["key_conclusions"].as_str()).bind(&raw).bind(&now)
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

const REPRODUCE_PROMPT: &str = r#"请根据以下论文内容生成复现指南，仅返回严格合法的 JSON，不要输出 JSON 以外的内容。

要求：
- 所有字段内容必须使用中文（代码仓库 URL 除外）
- code_repository：填写论文中提到的官方代码仓库链接，或论文发布后社区已知的复现仓库（如 GitHub/GitLab/HuggingFace 等），如有多个用 \n 分隔；若论文未提供且无已知复现，填"暂无"
- 步骤类内容（环境配置、依赖安装、训练流程等）请用 \n 分隔各条目（例如："1. 安装 Python 3.10\n2. 配置 CUDA 11.7\n3. ..."）
- 每个字段限 200 字以内，保持可操作性

{text}

返回格式：
{{"code_repository":"...","environment_setup":"...","dependencies":"...","dataset_preparation":"...","training_process":"...","inference_process":"...","evaluation_metrics":"...","risks_and_notes":"..."}}"#;

fn reproduce_system() -> String {
    specialist_system(
        "论文复现助手",
        "基于论文内容输出可执行、可验证、风险可控的复现指南。",
        Some("不得编造论文中未提供的实验细节。"),
    )
}

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
        .ok_or("未找到对应论文。")?;
    let full_text: String = row.get::<Option<String>, _>("full_text").unwrap_or_default();
    let text_preview = safe_text_preview(&full_text, 12000);
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
        let msgs = vec![LlmMessage::system(reproduce_system()), LlmMessage::user(&prompt)];

        match client.chat(&msgs, model.as_deref(), temperature).await {
            Ok(response) => {
                let v: serde_json::Value = serde_json::from_str(&extract_json(&response)).unwrap_or_default();
                let guide_id = Uuid::new_v4().to_string();
                let now = chrono::Utc::now().to_rfc3339();
                let raw = serde_json::to_string(&v).unwrap_or_default();
                let _ = sqlx::query(
                    "INSERT INTO reproduction_guides (id, paper_id, code_repository, environment_setup, dependencies, dataset_preparation, training_process, inference_process, evaluation_metrics, risks_and_notes, raw_guide, created_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                     ON CONFLICT(paper_id) DO UPDATE SET
                       code_repository = excluded.code_repository,
                       environment_setup = excluded.environment_setup, dependencies = excluded.dependencies,
                       dataset_preparation = excluded.dataset_preparation, training_process = excluded.training_process,
                       inference_process = excluded.inference_process, evaluation_metrics = excluded.evaluation_metrics,
                       risks_and_notes = excluded.risks_and_notes, raw_guide = excluded.raw_guide",
                )
                .bind(&guide_id).bind(&pid)
                .bind(v["code_repository"].as_str()).bind(v["environment_setup"].as_str())
                .bind(v["dependencies"].as_str()).bind(v["dataset_preparation"].as_str())
                .bind(v["training_process"].as_str()).bind(v["inference_process"].as_str())
                .bind(v["evaluation_metrics"].as_str()).bind(v["risks_and_notes"].as_str())
                .bind(&raw).bind(&now)
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

fn safe_text_preview(text: &str, max_bytes: usize) -> &str {
    if text.len() <= max_bytes {
        return text;
    }
    let mut end = max_bytes;
    while end > 0 && !text.is_char_boundary(end) {
        end -= 1;
    }
    &text[..end]
}

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

async fn extract_import_rename_metadata(
    settings: &std::collections::HashMap<String, String>,
    file_name: &str,
    title_guess: &str,
    full_text: &str,
) -> Option<ImportRenameMetadata> {
    let client = LlmClient::from_settings(settings).ok()?;
    let text_preview = safe_text_preview(full_text, 12000);
    let prompt = IMPORT_RENAME_PROMPT
        .replace("{file_name}", file_name)
        .replace("{title_guess}", title_guess)
        .replace("{text}", text_preview);
    let messages = vec![
        LlmMessage::system(import_rename_system()),
        LlmMessage::user(prompt),
    ];
    let model = resolve_model(settings, &["planner_hint_model"]);
    let temperature = resolve_temperature(settings, "planner_hint_temperature", 0.2);
    let response = client.chat(&messages, model.as_deref(), temperature).await.ok()?;
    let clean = extract_json(&response);
    serde_json::from_str::<ImportRenameMetadata>(&clean).ok()
}

fn render_import_file_stem(
    rule: &str,
    metadata: &ImportRenameMetadata,
    fallback_title: &str,
    original_stem: &str,
) -> String {
    if rule.trim().is_empty() {
        return sanitize_file_stem(original_stem);
    }

    let title = clean_optional_text(metadata.title.clone()).unwrap_or_else(|| fallback_title.trim().to_string());
    let authors = clean_optional_text(metadata.authors.clone()).unwrap_or_default();
    let first_author = extract_first_author(&authors);
    let year = metadata.year.filter(|value| *value > 0).map(|value| value.to_string()).unwrap_or_default();
    let venue = clean_optional_text(metadata.venue.clone()).unwrap_or_default();
    let doi = clean_optional_text(metadata.doi.clone()).unwrap_or_default();

    let mut rendered = rule.to_string();
    for (token, value) in [
        ("{title}", title.as_str()),
        ("{authors}", authors.as_str()),
        ("{first_author}", first_author.as_str()),
        ("{year}", year.as_str()),
        ("{venue}", venue.as_str()),
        ("{doi}", doi.as_str()),
        ("{original_name}", original_stem),
    ] {
        rendered = rendered.replace(token, value);
    }

    sanitize_file_stem(&strip_placeholder_braces(&rendered))
}

fn clean_optional_text(value: Option<String>) -> Option<String> {
    value
        .map(|item| item.replace('\n', " ").trim().to_string())
        .filter(|item| !item.is_empty())
}

fn extract_first_author(authors: &str) -> String {
    authors
        .split(',')
        .next()
        .map(|item| item.trim())
        .filter(|item| !item.is_empty())
        .unwrap_or_default()
        .to_string()
}

fn strip_placeholder_braces(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let mut brace_depth = 0usize;

    for ch in input.chars() {
        match ch {
            '{' => brace_depth += 1,
            '}' if brace_depth > 0 => brace_depth -= 1,
            _ if brace_depth == 0 => out.push(ch),
            _ => {}
        }
    }

    out
}

fn sanitize_file_stem(input: &str) -> String {
    let mut cleaned = String::with_capacity(input.len());

    for ch in input.chars() {
        if ch.is_control() {
            continue;
        }
        match ch {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => cleaned.push(' '),
            _ => cleaned.push(ch),
        }
    }

    let mut normalized = cleaned
        .replace("()", " ")
        .replace("[]", " ")
        .replace("{}", " ")
        .replace("（）", " ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");

    normalized = normalized
        .trim_matches(|ch: char| matches!(ch, ' ' | '-' | '_' | '.'))
        .to_string();

    if normalized.is_empty() {
        "untitled-paper".to_string()
    } else {
        normalized
    }
}

fn maybe_rename_imported_pdf(path: &Path, desired_stem: &str) -> Result<PathBuf, String> {
    let next_stem = sanitize_file_stem(desired_stem);
    let current_stem = path.file_stem().and_then(|value| value.to_str()).unwrap_or_default();
    if next_stem.eq_ignore_ascii_case(current_stem) {
        return Ok(path.to_path_buf());
    }

    let extension = path.extension().and_then(|value| value.to_str()).unwrap_or("pdf");
    let parent = path.parent().ok_or_else(|| "无法确定 PDF 文件所在目录。".to_string())?;
    let mut candidate = parent.join(format!("{next_stem}.{extension}"));
    if candidate == path {
        return Ok(path.to_path_buf());
    }

    if candidate.exists() {
        let mut found = false;
        for index in 2..1000 {
            let maybe = parent.join(format!("{next_stem} ({index}).{extension}"));
            if !maybe.exists() {
                candidate = maybe;
                found = true;
                break;
            }
        }
        if !found {
            return Err("文件重命名未完成：目标目录中存在过多同名文件。".to_string());
        }
    }

    std::fs::rename(path, &candidate).map_err(|e| e.to_string())?;
    Ok(candidate)
}

fn paper_row_to_json(r: &sqlx::sqlite::SqliteRow, _include_file_path: bool) -> serde_json::Value {
    let tags_str: String = r.get::<Option<String>, _>("tags").unwrap_or_else(|| "[]".into());
    // "abstract" is a Rust reserved keyword; fetch into a variable first
    let paper_abstract: Option<String> = r.get("abstract");
    let paper_venue: Option<String> = r.get("venue");
    let paper_doi: Option<String> = r.get("doi");
    let paper_file_path: Option<String> = r.get("file_path");
    let paper_title: String = r.get("title");
    let mut obj = json!({
        "id": r.get::<String, _>("id"),
        "title": paper_title,
        "authors": r.get::<Option<String>, _>("authors"),
        "year": r.get::<Option<i64>, _>("year"),
        "venue": paper_venue,
        "doi": paper_doi,
        "tags": serde_json::from_str::<serde_json::Value>(&tags_str).unwrap_or(json!([])),
        "research_interest_id": r.get::<Option<String>, _>("research_interest_id"),
        "status": r.get::<String, _>("status"),
        "created_at": r.get::<String, _>("created_at"),
        "updated_at": r.get::<String, _>("updated_at"),
    });
    obj["abstract"] = json!(paper_abstract);
    if let Some(url) = paper_reference_url(
        obj.get("title").and_then(|value| value.as_str()),
        paper_doi.as_deref(),
        paper_file_path.as_deref(),
    ) {
        obj["paper_url"] = json!(url);
    }
    let venue_name = obj
        .get("venue")
        .and_then(|value| value.as_str())
        .map(str::to_string);

    if let Some(venue) = venue_name.as_deref() {
        if let Some(tag) = match_venue(venue) {
            obj["ccf_rating"] = json!(tag.rating);
            obj["ccf_area"] = json!(tag.area);
            obj["ccf_type"] = json!(tag.kind);
            obj["ccf_label"] = json!(tag.label);
            obj["ccf_publisher"] = json!(tag.publisher);
            obj["venue_url"] = json!(tag.url);
        }

        if let Some(tag) = match_journal(venue) {
            obj["wos_indexes"] = json!(tag.indexes);
            obj["wos_categories"] = json!(tag.wos_categories);
            obj["jcr_quartile"] = json!(tag.jcr_quartile);
            obj["jcr_category"] = json!(tag.jcr_category);
            obj["jif"] = json!(tag.jif);
            obj["jif_rank"] = json!(tag.jif_rank);
            obj["cas_quartile"] = json!(tag.cas_quartile);
            obj["cas_top"] = json!(tag.cas_top);
            obj["open_access"] = json!(tag.open_access);
            obj["journal_issn"] = json!(tag.issn);
            obj["journal_eissn"] = json!(tag.eissn);
            obj["journal_publisher"] = json!(tag.publisher);
        }
    }
    obj
}

#[cfg(test)]
mod tests {
    use super::{extract_first_author, render_import_file_stem, ImportRenameMetadata};

    #[test]
    fn render_import_file_stem_uses_rule_tokens() {
        let metadata = ImportRenameMetadata {
            title: Some("Attention Is All You Need".into()),
            authors: Some("Ashish Vaswani, Noam Shazeer".into()),
            year: Some(2017),
            venue: Some("NeurIPS".into()),
            doi: Some("10.5555/demo".into()),
        };
        let rendered = render_import_file_stem(
            "{first_author} - {title} ({year})",
            &metadata,
            "fallback",
            "old-name",
        );
        assert_eq!(rendered, "Ashish Vaswani - Attention Is All You Need (2017)");
    }

    #[test]
    fn render_import_file_stem_cleans_missing_tokens() {
        let metadata = ImportRenameMetadata {
            title: Some("Paper Title".into()),
            authors: None,
            year: Some(0),
            venue: None,
            doi: None,
        };
        let rendered = render_import_file_stem(
            "{first_author} - {title} ({year})",
            &metadata,
            "fallback",
            "old-name",
        );
        assert_eq!(rendered, "Paper Title");
    }

    #[test]
    fn extract_first_author_prefers_first_comma_separated_name() {
        assert_eq!(extract_first_author("Jane Doe, John Smith"), "Jane Doe");
    }
}
