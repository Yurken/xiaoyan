use crate::assistant_prompts::specialist_system;
use crate::commands::paper_text::{extract_pdf_preview_text, extract_pdf_text_with_filtered_stderr};
use crate::ccf::{infer_from_text, match_venue};
use crate::journal_partitions::match_journal;
use crate::links::paper_reference_url;
use crate::llm::{resolve_model, resolve_temperature, LlmClient, LlmMessage};
use crate::rag::{chunk_text, serialize_embedding};
use crate::state::AppState;
use base64::{engine::general_purpose, Engine as _};
use serde::Deserialize;
use serde_json::json;
use sqlx::Row;
use std::path::{Path, PathBuf};
use std::time::Instant;
use tauri::{Emitter, Manager, State};
use tauri_plugin_opener::OpenerExt;
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
            "SELECT p.id, p.title, p.authors, p.abstract, p.year, p.venue, p.doi, p.file_path, p.tags, p.importance_color, p.notes, p.research_interest_id, p.status, p.created_at, p.updated_at,
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
            "SELECT p.id, p.title, p.authors, p.abstract, p.year, p.venue, p.doi, p.file_path, p.tags, p.importance_color, p.notes, p.research_interest_id, p.status, p.created_at, p.updated_at,
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
        "SELECT id, title, authors, abstract, year, venue, doi, file_path, tags, importance_color, notes, research_interest_id, status, created_at, updated_at
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
    importance_color: Option<String>,
    notes: Option<String>,
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

    if let Some(value) = importance_color {
        sqlx::query("UPDATE papers SET importance_color = ?, updated_at = ? WHERE id = ?")
            .bind(value.trim())
            .bind(&now)
            .bind(&id)
            .execute(&state.db)
            .await
            .map_err(|e| e.to_string())?;
    }

    if let Some(value) = notes {
        sqlx::query("UPDATE papers SET notes = ?, updated_at = ? WHERE id = ?")
            .bind(if value.trim().is_empty() { None::<String> } else { Some(value.trim().to_string()) })
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
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    // Fetch file path before deletion so we can clean up the managed file
    let file_path_str: Option<String> = sqlx::query("SELECT file_path FROM papers WHERE id = ?")
        .bind(&id)
        .fetch_optional(&state.db)
        .await
        .ok()
        .flatten()
        .and_then(|row| row.try_get::<Option<String>, _>("file_path").ok().flatten());

    sqlx::query("DELETE FROM papers WHERE id = ?")
        .bind(&id)
        .execute(&state.db)
        .await
        .map_err(|e| e.to_string())?;

    // Delete the managed copy if it lives inside the app's papers directory
    if let Some(fp) = file_path_str {
        let file_path = PathBuf::from(&fp);
        if let Ok(papers_dir) = managed_papers_dir(&app) {
            if file_path.starts_with(&papers_dir) {
                let _ = std::fs::remove_file(&file_path);
            }
        }
    }
    // Delete per-paper figures directory
    if let Ok(data_dir) = app.path().app_data_dir() {
        let figures_dir = data_dir.join("papers").join(&id);
        let _ = std::fs::remove_dir_all(&figures_dir);
    }

    Ok(())
}

// ── Open PDF ─────────────────────────────────────────────────────

#[tauri::command]
pub async fn papers_open_pdf(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    let file_path_str: Option<String> = sqlx::query("SELECT file_path FROM papers WHERE id = ?")
        .bind(&id)
        .fetch_optional(&state.db)
        .await
        .ok()
        .flatten()
        .and_then(|row| row.try_get::<Option<String>, _>("file_path").ok().flatten());

    let path = file_path_str
        .filter(|s| !s.trim().is_empty())
        .ok_or_else(|| "该论文没有关联的本地文件".to_string())?;

    app.opener()
        .open_path(&path, None::<&str>)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn papers_extract_pdf_text(
    app: tauri::AppHandle,
    file_path: tauri_plugin_fs::FilePath,
    max_chars: Option<usize>,
) -> Result<String, String> {
    let path = file_path.into_path().map_err(|e| e.to_string())?;
    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("该文件")
        .to_string();
    let max_chars = max_chars.unwrap_or(32_000).clamp(1_000, 100_000);

    let extract_started_at = Instant::now();
    eprintln!("[pdf-extract] start: path={}", path.display());
    let path_for_extract = path.clone();
    let app_for_extract = app.clone();
    let text = tokio::task::spawn_blocking(move || {
        extract_pdf_text_with_filtered_stderr(&app_for_extract, &path_for_extract)
    })
        .await
        .map_err(|error| format!("PDF 解析任务失败：{error}"))?
        .map_err(|error| format!("PDF 解析失败：{error}"))?;
    eprintln!(
        "[pdf-extract] done: path={} chars={} elapsed_ms={}",
        path.display(),
        text.chars().count(),
        extract_started_at.elapsed().as_millis()
    );

    let preview = safe_text_preview(&text, max_chars).trim().to_string();
    if preview.is_empty() {
        return Err(format!("{file_name} 未解析到可用正文，请确认文件内容可复制。"));
    }
    Ok(preview)
}

// ── Upload ───────────────────────────────────────────────────────

#[derive(Debug, Clone, Deserialize, Default)]
struct ImportRenameMetadata {
    title: Option<String>,
    authors: Option<String>,
    year: Option<i64>,
    venue: Option<String>,
    doi: Option<String>,
    keywords: Option<String>,
}

const IMPORT_RECOGNIZE_PROMPT: &str = r#"请根据用户提供的 PDF 文件名和正文前段识别论文元数据，仅返回合法 JSON：
{"title":"...","authors":"作者1, 作者2","year":2024,"venue":"期刊或会议名称","doi":"10.1234/abcd","keywords":"关键词1, 关键词2, 关键词3"}

要求：
1. title 尽量使用论文首页中的正式标题，不要保留文件名噪声。
2. authors 返回单行作者列表，使用英文逗号分隔。
3. year 无法确认时返回 0。
4. venue 无法确认时返回空字符串。
5. doi 仅返回 DOI 本身；没有就返回空字符串。
6. keywords 提取 3-8 个核心学术关键词，英文逗号分隔；无法确认时返回空字符串。
7. 不要输出 markdown、解释或额外文本。

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

    let settings = state.settings.read().await.clone();
    let recognize_title = settings
        .get("paper_import_recognize_title")
        .map(|v| v.trim().eq_ignore_ascii_case("true"))
        .unwrap_or(true);
    let recognize_authors = settings
        .get("paper_import_recognize_authors")
        .map(|v| v.trim().eq_ignore_ascii_case("true"))
        .unwrap_or(true);
    let recognize_year = settings
        .get("paper_import_recognize_year")
        .map(|v| v.trim().eq_ignore_ascii_case("true"))
        .unwrap_or(true);
    let recognize_venue = settings
        .get("paper_import_recognize_venue")
        .map(|v| v.trim().eq_ignore_ascii_case("true"))
        .unwrap_or(true);
    let recognize_keywords = settings
        .get("paper_import_recognize_keywords")
        .map(|v| v.trim().eq_ignore_ascii_case("true"))
        .unwrap_or(true);

    // 前台不再解析 PDF，只用文件名作为暂定标题，后台识别后更新
    let detected_title = title_guess.clone();
    let detected_authors: Option<String> = None;
    let detected_year: Option<i64> = None;
    let detected_venue: Option<String> = None;
    let detected_doi: Option<String> = None;
    let tags_json = "[]".to_string();
    let any_recognition = recognize_title || recognize_authors || recognize_year || recognize_venue || recognize_keywords;
    let file_name_owned = file_name.to_string();

    // Always copy into the app-managed papers directory so the file survives
    // even if the user deletes or moves the original in Finder.
    let copy_started_at = Instant::now();
    let final_path = copy_to_managed_papers_dir(&app, &path, &original_stem)
        .unwrap_or_else(|_| path.clone());
    eprintln!(
        "[paper-import] copy_pdf done: source={} target={} elapsed_ms={}",
        path.display(),
        final_path.display(),
        copy_started_at.elapsed().as_millis()
    );
    let file_path_str = final_path.to_string_lossy().to_string();

    let paper_id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    eprintln!(
        "[paper-import][{}] upload start: file={} any_recognition={} chunk_size={} chunk_overlap={}",
        paper_id,
        file_name_owned,
        any_recognition,
        settings.get("chunk_size").cloned().unwrap_or_else(|| "800".to_string()),
        settings.get("chunk_overlap").cloned().unwrap_or_else(|| "150".to_string())
    );

    sqlx::query(
        "INSERT INTO papers (id, title, authors, year, venue, doi, file_path, full_text, research_interest_id, tags, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'uploaded', ?, ?)",
    )
    .bind(&paper_id)
    .bind(&detected_title)
    .bind(&detected_authors)
    .bind(detected_year)
    .bind(&detected_venue)
    .bind(&detected_doi)
    .bind(&file_path_str)
    .bind(Option::<String>::None)
    .bind(&research_interest_id)
    .bind(&tags_json)
    .bind(&now)
    .bind(&now)
    .execute(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    // Background: chunk + embed
    let db = state.db.clone();
    let pid = paper_id.clone();
    let path_for_parse = final_path.clone();
    let chunk_size: usize = settings.get("chunk_size").and_then(|v| v.parse().ok()).unwrap_or(800);
    let chunk_overlap: usize = settings.get("chunk_overlap").and_then(|v| v.parse().ok()).unwrap_or(150);

    tokio::spawn(async move {
        let pipeline_started_at = Instant::now();
        eprintln!("[paper-import][{}] background pipeline start", pid);
        let parsing_now = chrono::Utc::now().to_rfc3339();
        let _ = sqlx::query("UPDATE papers SET status = 'parsing', updated_at = ? WHERE id = ?")
            .bind(&parsing_now)
            .bind(&pid)
            .execute(&db)
            .await;
        let _ = app.emit("paper:status", json!({ "paper_id": pid, "status": "parsing" }));
        eprintln!("[paper-import][{}] status=parsing emitted", pid);

        // ① 尽早启动全文提取（慢，CPU 密集，先开始但不等待）
        let preview_path = path_for_parse.clone();
        let full_text_started_at = Instant::now();
        eprintln!("[paper-import][{}] full_text extraction start", pid);
        let app_for_full_text = app.clone();
        let full_text_handle = tokio::task::spawn_blocking(move || {
            extract_pdf_text_with_filtered_stderr(&app_for_full_text, &path_for_parse)
        });

        // ② 提取前3页预览文本（相对快），与①并发进行
        let preview_started_at = Instant::now();
        let preview_text = tokio::task::spawn_blocking(move || {
            extract_pdf_preview_text(&preview_path, 3, 12_000)
        }).await.ok().flatten().unwrap_or_default();
        eprintln!(
            "[paper-import][{}] preview extracted: chars={} elapsed_ms={}",
            pid,
            preview_text.chars().count(),
            preview_started_at.elapsed().as_millis()
        );

        // ③ 基于预览文本做本地快速识别并更新初始字段
        let venue_and_kw_started_at = Instant::now();
        let inferred_venue = infer_from_text(&preview_text).map(|tag| tag.full_name);
        let preview_keywords = extract_keywords_from_text(&preview_text);
        let preview_tags = serde_json::to_string(&preview_keywords).unwrap_or_else(|_| "[]".to_string());
        if inferred_venue.is_some() || !preview_keywords.is_empty() {
            let now = chrono::Utc::now().to_rfc3339();
            let _ = sqlx::query(
                "UPDATE papers SET venue = COALESCE(?, venue), tags = ?, updated_at = ? WHERE id = ?"
            )
            .bind(&inferred_venue)
            .bind(&preview_tags)
            .bind(&now)
            .bind(&pid)
            .execute(&db)
            .await;
        }
        eprintln!(
            "[paper-import][{}] preview infer done: venue={} keywords={} elapsed_ms={}",
            pid,
            inferred_venue.is_some(),
            preview_keywords.len(),
            venue_and_kw_started_at.elapsed().as_millis()
        );

        // ④ LLM 元数据识别（与①的全文提取并发进行）
        let metadata_started_at = Instant::now();
        let metadata_opt = if any_recognition && !preview_text.is_empty() {
            extract_import_metadata(&settings, &file_name_owned, &title_guess, &preview_text).await
        } else {
            None
        };
        eprintln!(
            "[paper-import][{}] metadata step done: recognized={} elapsed_ms={}",
            pid,
            metadata_opt.is_some(),
            metadata_started_at.elapsed().as_millis()
        );

        // 元数据到位后立即写库并通知前端
        if let Some(ref metadata) = metadata_opt {
            let meta_title = if recognize_title { clean_optional_text(metadata.title.clone()) } else { None };
            let meta_authors = if recognize_authors { clean_optional_text(metadata.authors.clone()) } else { None };
            let meta_year: Option<i64> = if recognize_year { metadata.year.filter(|v| *v > 0) } else { None };
            let meta_venue = if recognize_venue {
                clean_optional_text(metadata.venue.clone()).or(inferred_venue)
            } else {
                None
            };
            let meta_doi = clean_optional_text(metadata.doi.clone());
            let meta_now = chrono::Utc::now().to_rfc3339();
            let _ = sqlx::query(
                "UPDATE papers SET title = COALESCE(?, title), authors = COALESCE(?, authors), year = COALESCE(?, year), venue = COALESCE(?, venue), doi = COALESCE(?, doi), updated_at = ? WHERE id = ?"
            )
            .bind(meta_title)
            .bind(meta_authors)
            .bind(meta_year)
            .bind(meta_venue)
            .bind(meta_doi)
            .bind(&meta_now)
            .bind(&pid)
            .execute(&db)
            .await;
            let _ = app.emit("paper:status", json!({ "paper_id": pid, "status": "metadata" }));
            eprintln!("[paper-import][{}] status=metadata emitted", pid);
        }

        // ⑤ 等待全文提取完成（此时①可能已基本完成）
        let text = match full_text_handle.await {
            Ok(Ok(value)) => value,
            Ok(Err(error)) => {
                let now = chrono::Utc::now().to_rfc3339();
                let _ = sqlx::query("UPDATE papers SET status = 'failed', updated_at = ? WHERE id = ?")
                    .bind(&now)
                    .bind(&pid)
                    .execute(&db)
                    .await;
                let _ = app.emit("paper:status", json!({ "paper_id": pid, "status": "failed", "error": format!("PDF 解析失败：{error}") }));
                eprintln!("[paper-import][{}] full_text extraction failed: {}", pid, error);
                return;
            }
            Err(join_error) => {
                let now = chrono::Utc::now().to_rfc3339();
                let _ = sqlx::query("UPDATE papers SET status = 'failed', updated_at = ? WHERE id = ?")
                    .bind(&now)
                    .bind(&pid)
                    .execute(&db)
                    .await;
                let _ = app.emit("paper:status", json!({ "paper_id": pid, "status": "failed", "error": format!("PDF 后台解析任务失败：{join_error}") }));
                eprintln!("[paper-import][{}] full_text extraction join failed: {}", pid, join_error);
                return;
            }
        };
        eprintln!(
            "[paper-import][{}] full_text extracted: chars={} elapsed_ms={}",
            pid,
            text.chars().count(),
            full_text_started_at.elapsed().as_millis()
        );

        if text.trim().is_empty() {
            let now = chrono::Utc::now().to_rfc3339();
            let _ = sqlx::query("UPDATE papers SET status = 'failed', updated_at = ? WHERE id = ?")
                .bind(&now)
                .bind(&pid)
                .execute(&db)
                .await;
            let _ = app.emit(
                "paper:status",
                json!({
                    "paper_id": pid,
                    "status": "failed",
                    "error": "PDF 未解析到可用正文，请重新导入或更换可复制文本的 PDF。"
                }),
            );
            eprintln!("[paper-import][{}] full_text empty after extraction", pid);
            return;
        }

        let refreshed_keywords = extract_keywords_from_text(&text);
        let refreshed_tags = serde_json::to_string(&refreshed_keywords).unwrap_or_else(|_| "[]".to_string());
        let parsed_now = chrono::Utc::now().to_rfc3339();
        let _ = sqlx::query("UPDATE papers SET full_text = ?, tags = ?, status = 'parsed', updated_at = ? WHERE id = ?")
            .bind(&text)
            .bind(&refreshed_tags)
            .bind(&parsed_now)
            .bind(&pid)
            .execute(&db)
            .await;
        // 全文已写入，立即通知前端 parsed，后续 embedding 在后台静默完成
        let _ = app.emit("paper:status", json!({ "paper_id": pid, "status": "parsed" }));
        eprintln!(
            "[paper-import][{}] status=parsed emitted (full_text ready) elapsed_ms={}",
            pid,
            pipeline_started_at.elapsed().as_millis()
        );

        let chunk_started_at = Instant::now();
        let chunks = chunk_text(&text, chunk_size, chunk_overlap);
        eprintln!(
            "[paper-import][{}] chunking done: chunks={} elapsed_ms={}",
            pid,
            chunks.len(),
            chunk_started_at.elapsed().as_millis()
        );
        let contents: Vec<String> = chunks.iter().map(|c| c.content.clone()).collect();
        let embedding_batch_size = settings
            .get("embedding_batch_size")
            .and_then(|v| v.parse::<usize>().ok())
            .unwrap_or(48)
            .clamp(8, 128);
        let embedding_batches = if contents.is_empty() {
            0
        } else {
            (contents.len() + embedding_batch_size - 1) / embedding_batch_size
        };
        let embedding_started_at = Instant::now();
        eprintln!(
            "[paper-import][{}] embedding start: chunks={} batch_size={} batches={}",
            pid,
            contents.len(),
            embedding_batch_size,
            embedding_batches
        );
        let embeddings: Option<Vec<Vec<f32>>> = if let Ok(client) = LlmClient::embed_client_from_settings(&settings) {
            embed_in_batches(&client, &contents, embedding_batch_size).await
        } else {
            None
        };
        match embeddings.as_ref() {
            Some(values) => {
                eprintln!(
                    "[paper-import][{}] embedding done: vectors={} elapsed_ms={}",
                    pid,
                    values.len(),
                    embedding_started_at.elapsed().as_millis()
                );
            }
            None => {
                eprintln!(
                    "[paper-import][{}] embedding unavailable_or_failed elapsed_ms={}",
                    pid,
                    embedding_started_at.elapsed().as_millis()
                );
            }
        }

        let chunk_now = chrono::Utc::now().to_rfc3339();
        let insert_started_at = Instant::now();
        let mut inserted_with_tx = false;
        if let Ok(mut tx) = db.begin().await {
            let mut tx_failed = false;
            for (i, chunk) in chunks.iter().enumerate() {
                let chunk_id = Uuid::new_v4().to_string();
                let emb_str: Option<String> = embeddings.as_ref().and_then(|v| v.get(i)).map(|e| serialize_embedding(e));
                let idx = chunk.chunk_index as i64;
                if sqlx::query(
                    "INSERT INTO paper_chunks (id, paper_id, chunk_index, content, embedding, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                )
                .bind(&chunk_id)
                .bind(&pid)
                .bind(idx)
                .bind(&chunk.content)
                .bind(&emb_str)
                .bind(&chunk_now)
                .execute(&mut *tx)
                .await
                .is_err()
                {
                    tx_failed = true;
                    break;
                }
            }

            if tx_failed {
                let _ = tx.rollback().await;
            } else if tx.commit().await.is_ok() {
                inserted_with_tx = true;
            }
        }

        if !inserted_with_tx {
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
        }

        eprintln!(
            "[paper-import][{}] chunk insert done: used_tx={} elapsed_ms={}",
            pid,
            inserted_with_tx,
            insert_started_at.elapsed().as_millis()
        );
        eprintln!(
            "[paper-import][{}] pipeline complete total_elapsed_ms={}",
            pid,
            pipeline_started_at.elapsed().as_millis()
        );
    });

    Ok(json!({ "paper_id": paper_id, "title": detected_title }))
}

// ── Analyze (Multi-Agent Deep Analysis) ─────────────────────────

// Agent 1 — 研究问题与背景深度分析（读引言区段）
const AGENT1_PROMPT: &str = r#"请对以下论文内容进行深度问题背景分析，仅返回严格合法的 JSON，不输出任何其他内容。

论文文本（引言/相关工作区段）：
{text}

输出要求：
- research_question 字段值使用中文富文本，段落间用 \n\n 分隔，段内换行用 \n
- 每个分析维度必须结合论文实际内容，严禁空泛或复制摘要，每维度至少 3-5 句实质性分析
- 字段值以加粗标题（**标题**）组织，标题单独成段，标题行与内容之间必须用空行隔开（即 \\n\\n）
- 所有数学公式必须使用 LaTeX 格式：行内公式用 $...$，独立公式用 $$...$$，不得用纯文本写公式
- 【重要】凡涉及论文中的图或表，必须在行文中明确引用其编号，例如"如 Figure 1 所示"、"Fig. 2 展示了"、"见 Table 1"、"如图1所示"，以便读者对照图表理解

返回格式（严格 JSON，不得有多余字符）：
{"research_question": "**一、核心研究问题**\n\n（精确描述：本文究竟要解决什么技术/科学问题？给出精确定义而非模糊表述）\n\n**二、问题重要性与动机**\n\n（为什么这个问题重要？有什么实际应用价值或科学意义？是否有现实中已知的失败场景？）\n\n**三、现有方法的具体不足**\n\n（引用文中提到的具体方法或工作，分别说明它们失败在哪里：计算代价？泛化性？准确性？理论缺陷？）\n\n**四、本文填补的研究空白**\n\n（在整个领域坐标系里，这篇文章填补了哪个具体位置？是方法突破、理论建立、还是系统工程上的创新？）\n\n**五、核心假设与适用边界**\n\n（本文依赖的前提假设是什么？方法在什么场景下成立，在什么场景下可能失效或不适用？）"}"#;

// Agent 2 — 方法深度解析（读方法区段 + A1 上下文）
const AGENT2_PROMPT: &str = r#"请对以下论文内容进行深度方法分析，仅返回严格合法的 JSON，不输出任何其他内容。

前置分析（研究问题概述，供参考）：
{problem_summary}

论文文本（方法核心区段）：
{text}

输出要求：
- core_method 字段值使用中文富文本，公式名称/变量名保持英文
- 必须解释"为什么这样做有效"，而不只是描述"做了什么"
- 每个维度至少 3-5 句实质性内容，以加粗标题组织，标题单独成段（标题行与内容之间用 \\n\\n 隔开）
- 所有数学公式必须使用 LaTeX 格式：行内公式用 $...$，独立公式用 $$...$$，不得用纯文本写公式
- 【重要】凡涉及论文中的架构图、流程图、模块示意图或表格，必须在行文中明确引用其编号，例如"如 Figure 2 所示的整体架构"、"Fig. 3 中的模块设计"，让分析图文并茂

返回格式：
{"core_method": "**一、核心技术思路与直觉**\n\n（最关键的洞察是什么？为什么这个思路能解决前述问题？背后的数学直觉或工程洞见是什么？）\n\n**二、关键技术细节**\n\n（算法步骤、网络结构、损失函数、关键公式——尽可能具体，引用公式编号或名称，说明各模块的作用）\n\n**三、与现有方法的本质区别**\n\n（与最相关基线相比，本文方法的核心差异在哪一步？为什么这个差异是关键的？）\n\n**四、关键设计选择与权衡**\n\n（作者做了哪些重要设计决策？这些选择带来了什么好处，又付出了什么代价或限制？）\n\n**五、理论保证**\n\n（是否有收敛性证明、复杂度分析、误差界？若无理论保证，说明方法在何种意义上属于启发式，以及作者如何用实验弥补）"}"#;

// Agent 3 — 实验证据深度分析（读实验区段 + A2 上下文）
const AGENT3_PROMPT: &str = r#"请对以下论文实验部分进行深度分析，仅返回严格合法的 JSON，不输出任何其他内容。

前置分析（方法概述，供参考）：
{method_summary}

论文文本（实验/结果区段）：
{text}

输出要求：
- 两个字段均使用中文富文本，以加粗标题组织，标题单独成段（标题行与内容之间用 \\n\\n 隔开）
- 要有批判性视角，不只是复述数字
- 每个维度至少 2-4 句实质性分析
- 所有数学公式必须使用 LaTeX 格式：行内公式用 $...$，独立公式用 $$...$$，不得用纯文本写公式
- 【重要】凡提及实验结果表格、对比图、消融曲线图等，必须在行文中明确引用其编号，例如"Table 2 中的结果表明"、"如 Figure 4 的消融曲线所示"，确保分析图文对应

返回格式：
{"experiment_design": "**一、数据集与评估协议**\n\n（用了哪些数据集？选择理由是什么？评估指标是否合理覆盖了论文声称的贡献？是否存在数据选择偏差风险？）\n\n**二、基线方法选择与公平性**\n\n（与哪些方法对比？这些基线是否代表当时最强水平？比较是否公平（相同计算预算/数据量/预训练资源）？有无刻意回避某些强基线？）\n\n**三、核心实验设置**\n\n（关键超参数、训练细节、随机种子处理——对可复现性重要的细节是否充分披露？）\n\n**四、消融实验设计**\n\n（消融了哪些组件？实验设计是否充分验证了作者声称的每个贡献？是否存在遗漏的重要消融组合？）", "experiment_results": "**一、主要定量结果**\n\n（核心指标上的具体数字，提升幅度，是否报告了标准差或置信区间？）\n\n**二、消融实验揭示了什么**\n\n（哪个组件贡献最大？去掉哪个组件性能下降最多？这与作者的贡献声称是否一致，是否有意外发现？）\n\n**三、定性分析与案例**\n\n（如果有可视化或案例分析，说明其支持了什么结论，或是否暴露了方法的边界）\n\n**四、结果的边界与例外**\n\n（在哪些情况下方法表现不佳？有没有失败案例被报告？作者是否回避了某些不利结果？）\n\n**五、结果与贡献声称的一致性**\n\n（实验结果是否充分支持引言中的全部贡献声称？有无夸大或未完全验证的部分？）"}"#;

// Agent 4 — 综合评审（基于 A1+A2+A3 摘要，无原始论文文本）
const AGENT4_PROMPT: &str = r#"基于对一篇论文多阶段精读的结果，请从资深同行评审员视角做最终综合评价，仅返回严格合法的 JSON，不输出任何其他内容。

研究问题分析：
{problem_summary}

方法分析：
{method_summary}

实验分析：
{experiment_summary}

输出要求：
- 三个字段均使用中文富文本，以加粗标题组织，标题单独成段（标题行与内容之间用 \\n\\n 隔开）
- 区分"作者自我宣称的贡献"与"真正有价值的贡献"，保持独立判断
- 局限性不只复述作者承认的，还要从评审视角独立识别
- 所有数学公式必须使用 LaTeX 格式：行内公式用 $...$，独立公式用 $$...$$，不得用纯文本写公式
- 【重要】在综合评价中，凡涉及论文中的关键图表（如对比图、结果表、架构图），必须明确引用其编号以支撑论据

返回格式：
{"innovations": "**真正新颖的技术贡献**\n\n（逐条列出，区分「真正新颖」「工程改进」「组合式创新」，说明每个贡献在领域中的位置，避免简单照搬摘要）\n\n**核心洞察的价值**\n\n（这篇文章最核心的一个 insight 是什么？为什么这个 insight 有独立的学术或工程价值？）\n\n**对后续工作的影响预测**\n\n（这个贡献可能打开哪些新方向？还是会很快被更强的方法取代？影响力可能主要在哪个社区？）", "limitations": "**方法层面的实质性局限**\n\n（独立分析：假设是否过强？适用场景是否受限？有没有作者未承认但显而易见的瓶颈？）\n\n**实验层面的潜在问题**\n\n（数据集多样性是否足够？有无可能对特定 benchmark 过拟合？有无重要缺失对比或不公平比较？）\n\n**可复现性与工程可行性**\n\n（复现难度评估：开源情况、计算资源要求、工程实现复杂度、对超参数的敏感度）", "key_conclusions": "**最值得记住的核心结论**\n\n（用 1-2 句话说清楚：读完这篇文章，你最应该记住什么？）\n\n**适合哪类读者优先阅读**\n\n（从事该方向的研究者？工程实践者？想了解该领域的外部研究者？各自应重点关注什么章节？）\n\n**三个最直接的后续研究切入点**\n\n（如果基于这篇文章做后续工作，最自然的三个延伸方向是什么？各自的技术难点在哪里？）\n\n**综合评分（供参考）**\n技术新颖性 X/5 · 实验充分性 X/5 · 实用性 X/5 · 论文清晰度 X/5\n（一句话说明评分依据，尤其是最低分项的理由）"}"#;

fn agent1_system() -> String {
    specialist_system(
        "论文精读 · 问题背景分析专家",
        "基于论文开头部分，深度解析研究问题的本质、动机与现有方法的具体不足。",
        Some("不得编造，不得空泛，每个方面必须结合论文原文给出具体信息。"),
    )
}

fn agent2_system() -> String {
    specialist_system(
        "论文精读 · 方法深度解析专家",
        "基于论文方法部分，深度解析技术贡献的核心思路、关键设计决策与技术细节。",
        Some("必须说清楚为什么这个方法有效，而不只是描述它做了什么。"),
    )
}

fn agent3_system() -> String {
    specialist_system(
        "论文精读 · 实验证据分析专家",
        "基于论文实验部分，深度分析实验设计的合理性、结果的可信度与边界。",
        Some("要有批判性视角，不只是复述结果数字。"),
    )
}

fn agent4_system() -> String {
    specialist_system(
        "论文精读 · 综合评审专家",
        "基于对论文的多阶段精读，从同行评审视角综合评价真正的创新点、实质性局限和核心结论。",
        Some("区分作者自我宣称的贡献与真正有价值的贡献，保持独立判断。"),
    )
}

fn missing_full_text_message(status: &str) -> &'static str {
    match status {
        "uploaded" | "parsing" => "论文仍在解析中，请稍后再试。",
        "failed" | "error" => "论文解析失败，请重新导入 PDF 后再试。",
        _ => "论文正文为空，请重新导入或更换可复制文本的 PDF。",
    }
}

#[tauri::command]
pub async fn papers_analyze(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    let row = sqlx::query("SELECT file_path, full_text, status FROM papers WHERE id = ?")
        .bind(&id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("未找到对应论文。")?;
    let full_text: String = row.get::<Option<String>, _>("full_text").unwrap_or_default();
    let file_path_for_spawn: Option<String> = row.get("file_path");
    let status = row.get::<Option<String>, _>("status").unwrap_or_default();
    if full_text.trim().is_empty() {
        return Err(missing_full_text_message(&status).to_string());
    }
    let settings = state.settings.read().await.clone();
    let db = state.db.clone();
    let pid = id.clone();
    let app_for_spawn = app.clone();

    // Slice the paper into three overlapping windows for different agents.
    // Each window covers a different region so together they span the full paper.
    const CHUNK: usize = 18_000;
    let text_len = full_text.len();
    let intro_text    = safe_text_slice(&full_text, 0,                           CHUNK).to_string();
    let method_text   = safe_text_slice(&full_text, text_len / 4,                CHUNK).to_string();
    let experiment_text = safe_text_slice(&full_text, text_len.saturating_sub(CHUNK), CHUNK).to_string();

    let now_pre = chrono::Utc::now().to_rfc3339();
    let _ = sqlx::query("UPDATE papers SET status = 'analyzing', updated_at = ? WHERE id = ?")
        .bind(&now_pre)
        .bind(&id)
        .execute(&state.db)
        .await;

    tokio::spawn(async move {
        let app = app_for_spawn;
        let client = match LlmClient::from_settings(&settings) {
            Ok(c) => c,
            Err(e) => {
                let _ = app.emit("paper:status", json!({ "paper_id": pid, "status": "error", "error": e.to_string() }));
                return;
            }
        };
        let model = resolve_model(&settings, &["paper_analysis_model", "multi_agent_paper_analyst_model", "multi_agent_worker_model"]);
        let temperature = resolve_temperature(&settings, "paper_analysis_temperature", 0.3);

        // ── Phase 0: Figure extraction ────────────────────────────
        let _ = app.emit("paper:status", json!({ "paper_id": pid, "status": "analyzing", "step": "图表提取中…" }));
        // Prefer the dedicated "视界" vision model; fall back to the main analysis model
        let (vision_ref, vision_model_owned);
        let (vision_client_opt, vision_model_opt): (Option<&LlmClient>, Option<&str>) =
            if let Some((vc, vm)) = LlmClient::vision_client_from_settings(&settings) {
                vision_ref = vc;
                vision_model_owned = vm;
                (Some(&vision_ref), vision_model_owned.as_deref())
            } else {
                (Some(&client), model.as_deref())
            };

        let figure_timeout_secs = settings
            .get("paper_figure_extract_timeout_secs")
            .and_then(|v| v.trim().parse::<u64>().ok())
            .unwrap_or(45)
            .clamp(15, 180);

        let extracted_figures = match tokio::time::timeout(
            std::time::Duration::from_secs(figure_timeout_secs),
            ensure_figures_extracted(
                &app,
                &db,
                &pid,
                file_path_for_spawn.as_deref(),
                &full_text,
                vision_client_opt,
                vision_model_opt,
            ),
        )
        .await
        {
            Ok(figures) => figures,
            Err(_) => {
                eprintln!(
                    "[paper-analyze][{}] figure extraction timed out after {}s; continue without figure context",
                    pid, figure_timeout_secs
                );
                let _ = app.emit(
                    "paper:status",
                    json!({
                        "paper_id": pid,
                        "status": "analyzing",
                        "step": "图表提取超时，已跳过并继续分析…"
                    }),
                );
                Vec::new()
            }
        };

        // Build figure context to inject into every agent prompt
        let figure_context = if extracted_figures.is_empty() {
            String::new()
        } else {
            let list = extracted_figures.iter().map(|(idx, cap)| {
                if let Some(c) = cap { format!("  • Figure {idx}: {c}") } else { format!("  • Figure {idx}") }
            }).collect::<Vec<_>>().join("\n");
            format!("【论文图表（共 {} 个，已成功提取，请在分析中积极用编号引用，如: Figure 1 所示、Table 2 中）】\n{}\n\n", extracted_figures.len(), list)
        };

        // ── Agent 1: Problem & Background ────────────────────────
        let _ = app.emit("paper:status", json!({ "paper_id": pid, "status": "analyzing", "step": "问题背景分析中（1/4）…" }));
        let prompt1 = AGENT1_PROMPT.replace("{text}", &format!("{figure_context}{intro_text}"));
        let msgs1 = vec![LlmMessage::system(agent1_system()), LlmMessage::user(&prompt1)];
        let research_question = match client.chat(&msgs1, model.as_deref(), temperature).await {
            Ok(resp) => {
                let v: serde_json::Value = serde_json::from_str(&extract_json(&resp)).unwrap_or_default();
                v["research_question"].as_str().unwrap_or("").to_string()
            }
            Err(_) => String::new(),
        };

        // ── Agent 2: Method Deep-Dive ─────────────────────────────
        let _ = app.emit("paper:status", json!({ "paper_id": pid, "status": "analyzing", "step": "方法深度解析中（2/4）…" }));
        let prompt2 = AGENT2_PROMPT
            .replace("{problem_summary}", &research_question)
            .replace("{text}", &format!("{figure_context}{method_text}"));
        let msgs2 = vec![LlmMessage::system(agent2_system()), LlmMessage::user(&prompt2)];
        let core_method = match client.chat(&msgs2, model.as_deref(), temperature).await {
            Ok(resp) => {
                let v: serde_json::Value = serde_json::from_str(&extract_json(&resp)).unwrap_or_default();
                v["core_method"].as_str().unwrap_or("").to_string()
            }
            Err(_) => String::new(),
        };

        // ── Agent 3: Experiment Analysis ──────────────────────────
        let _ = app.emit("paper:status", json!({ "paper_id": pid, "status": "analyzing", "step": "实验结果分析中（3/4）…" }));
        let prompt3 = AGENT3_PROMPT
            .replace("{method_summary}", &core_method)
            .replace("{text}", &format!("{figure_context}{experiment_text}"));
        let msgs3 = vec![LlmMessage::system(agent3_system()), LlmMessage::user(&prompt3)];
        let (experiment_design, experiment_results) = match client.chat(&msgs3, model.as_deref(), temperature).await {
            Ok(resp) => {
                let v: serde_json::Value = serde_json::from_str(&extract_json(&resp)).unwrap_or_default();
                (
                    v["experiment_design"].as_str().unwrap_or("").to_string(),
                    v["experiment_results"].as_str().unwrap_or("").to_string(),
                )
            }
            Err(_) => (String::new(), String::new()),
        };

        // ── Agent 4: Synthesis & Critique ─────────────────────────
        let _ = app.emit("paper:status", json!({ "paper_id": pid, "status": "analyzing", "step": "综合评审中（4/4）…" }));
        let experiment_summary = format!("{}\n\n{}", experiment_design, experiment_results);
        let prompt4 = AGENT4_PROMPT
            .replace("{problem_summary}", &format!("{figure_context}{research_question}"))
            .replace("{method_summary}", &core_method)
            .replace("{experiment_summary}", &experiment_summary);
        let msgs4 = vec![LlmMessage::system(agent4_system()), LlmMessage::user(&prompt4)];
        let (innovations, limitations, key_conclusions) = match client.chat(&msgs4, model.as_deref(), temperature).await {
            Ok(resp) => {
                let v: serde_json::Value = serde_json::from_str(&extract_json(&resp)).unwrap_or_default();
                (
                    v["innovations"].as_str().unwrap_or("").to_string(),
                    v["limitations"].as_str().unwrap_or("").to_string(),
                    v["key_conclusions"].as_str().unwrap_or("").to_string(),
                )
            }
            Err(_) => (String::new(), String::new(), String::new()),
        };

        // ── Persist ───────────────────────────────────────────────
        let analysis_id = Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();
        let raw = serde_json::to_string(&json!({
            "research_question": research_question,
            "core_method": core_method,
            "experiment_design": experiment_design,
            "experiment_results": experiment_results,
            "innovations": innovations,
            "limitations": limitations,
            "key_conclusions": key_conclusions,
        })).unwrap_or_default();

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
        .bind(&research_question).bind(&core_method)
        .bind(&experiment_design).bind(&experiment_results)
        .bind(&innovations).bind(&limitations)
        .bind(&key_conclusions).bind(&raw).bind(&now)
        .execute(&db).await;

        let _ = sqlx::query("UPDATE papers SET status = 'analyzed', updated_at = ? WHERE id = ?")
            .bind(&now).bind(&pid).execute(&db).await;
        let _ = app.emit("paper:status", json!({ "paper_id": pid, "status": "analyzed" }));
    });
    Ok(())
}

// ── Reproduce ────────────────────────────────────────────────────

const REPRODUCE_PROMPT: &str = r#"请根据以下论文内容生成详尽的复现指南，仅返回严格合法的 JSON，不要输出 JSON 以外的内容。

核心原则：
- 所有字段内容使用中文，URL 除外
- 字段值使用 Markdown 格式：有序列表用 `1. 2. 3.`，子项用缩进，重点用 **加粗**，代码/命令/库名用 `反引号`
- 不限制字数，宁可详尽也不要省略关键步骤
- **若论文未开源代码**：不要填"暂无"，而是主动给出替代复现方案（可参考的社区实现、相似开源项目链接等）

各字段要求：

code_repository：
- 若论文提供了官方代码，填写仓库链接
- 若未开源，搜索 GitHub/HuggingFace/Papers With Code 上已知的社区复现仓库，提供链接
- 若完全无可参考实现，说明方法类别并给出同类开源项目（如"同类 GNN 框架可参考 PyG: https://github.com/pyg-team/pytorch_geometric"）
- 多个链接用 \n 分隔

environment_setup：
- 具体到操作系统要求、Python/CUDA/框架版本
- 给出推荐安装方式（conda / pip / docker），提供实际可用的命令示例
- 若论文未说明，根据使用的方法合理推断并标注"（推断）"

dependencies：
- 逐项列出核心依赖库及推荐版本号
- 附上官方文档或下载链接（尤其是冷门库）
- 给出一键安装命令示例

dataset_preparation：
- 论文使用的数据集：名称、规模、获取链接（官方下载页、Kaggle、HuggingFace Datasets 等）
- 若数据集不公开，提供相似的替代公开数据集及下载链接
- 给出数据预处理步骤（格式转换、划分方式、关键参数）

training_process：
- 分阶段描述完整训练流程
- 列出关键超参数及论文给出的值（或合理推荐值）
- 给出参考训练命令结构（如 `python train.py --lr 1e-4 --epochs 100`）
- 说明预期训练时长和资源需求（GPU 显存、内存）

inference_process：
- 模型加载与推理步骤
- 输入格式要求和输出解读方式
- 给出推理命令示例

evaluation_metrics：
- 列出所有评估指标及计算方式
- 说明复现时可参考的基准数值（论文报告值）
- 若有现成的评估工具库，给出使用方式

risks_and_notes：
- 复现难点与潜在坑点（数据获取限制、版本兼容问题、随机性来源等）
- 对资源受限用户的降级方案（小规模数据、轻量版模型）
- 若论文存在可复现性疑问，给出客观说明

{text}

返回格式：
{{"code_repository":"...","environment_setup":"...","dependencies":"...","dataset_preparation":"...","training_process":"...","inference_process":"...","evaluation_metrics":"...","risks_and_notes":"..."}}"#;

fn reproduce_system() -> String {
    specialist_system(
        "论文复现工程师",
        "将论文的方法转化为其他研究者可实际执行的完整复现方案，包括代码、数据、环境、训练和评估的全链路指导。",
        Some("即使论文未开源，也必须给出可行的替代方案和参考资源，绝不以「暂无」敷衍。字段内容使用 Markdown 格式，确保步骤清晰可操作。"),
    )
}

#[tauri::command]
pub async fn papers_reproduce(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    let row = sqlx::query("SELECT full_text, status FROM papers WHERE id = ?")
        .bind(&id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("未找到对应论文。")?;
    let full_text: String = row.get::<Option<String>, _>("full_text").unwrap_or_default();
    let status = row.get::<Option<String>, _>("status").unwrap_or_default();
    if full_text.trim().is_empty() {
        return Err(missing_full_text_message(&status).to_string());
    }
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

/// Return a slice of `text` starting at `start_bytes`, up to `max_bytes` long.
/// Always returns a valid UTF-8 slice by snapping to char boundaries.
fn safe_text_slice(text: &str, start_bytes: usize, max_bytes: usize) -> &str {
    let len = text.len();
    if start_bytes >= len {
        return safe_text_preview(text, max_bytes);
    }
    let mut start = start_bytes;
    while start > 0 && !text.is_char_boundary(start) {
        start -= 1;
    }
    let raw_end = (start + max_bytes).min(len);
    let mut end = raw_end;
    while end > start && !text.is_char_boundary(end) {
        end -= 1;
    }
    &text[start..end]
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

async fn extract_import_metadata(
    settings: &std::collections::HashMap<String, String>,
    file_name: &str,
    title_guess: &str,
    full_text: &str,
) -> Option<ImportRenameMetadata> {
    let client = LlmClient::from_settings(settings).ok()?;
    let text_preview = safe_text_preview(full_text, 12000);
    let prompt = IMPORT_RECOGNIZE_PROMPT
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

// ── Keyword extraction ────────────────────────────────────────────

/// Scan the first ~4000 chars of extracted PDF text for a "Keywords:" section.
/// Returns up to 10 cleaned keyword strings, or an empty vec if not found.
pub(crate) fn extract_keywords_from_text(full_text: &str) -> Vec<String> {
    let search_area = safe_text_preview(full_text, 4000);
    let lower = search_area.to_ascii_lowercase();

    let markers = [
        "keywords—", "keywords:", "key words:", "key words—",
        "index terms—", "index terms:", "index terms\n",
        "keywords\n",
    ];

    let kw_start = markers.iter().find_map(|m| lower.find(m).map(|p| p + m.len()));
    let start = match kw_start {
        Some(s) => s,
        None => return Vec::new(),
    };

    let rest = &search_area[start..];
    // Stop at blank line or 500 chars (UTF-8 safe), whichever comes first
    let limited_rest = safe_text_preview(rest, 500);
    let end = limited_rest.find("\n\n").unwrap_or(limited_rest.len());
    let kw_text = &limited_rest[..end];

    kw_text
        .split([',', ';'])
        .map(|k| {
            k.lines()
                .next()
                .unwrap_or("")
                .trim()
                .trim_matches('.')
                .trim()
                .to_string()
        })
        .filter(|k| !k.is_empty() && k.len() > 1 && k.len() < 80)
        .take(10)
        .collect()
}

// ── Figure extraction pipeline ────────────────────────────────────

/// Ensure figures are extracted and stored for a paper.
/// Phase 1: extract embedded bitmap images via lopdf.
/// Phase 2 (if vision_client supplied): render PDF pages and ask vision LLM to
///          identify figures/tables that were missed by lopdf (e.g. vector graphics).
/// Returns (fig_index, caption) for all stored figures.
async fn ensure_figures_extracted(
    app: &tauri::AppHandle,
    db: &sqlx::SqlitePool,
    paper_id: &str,
    file_path: Option<&str>,
    full_text: &str,
    vision_client: Option<&LlmClient>,
    vision_model: Option<&str>,
) -> Vec<(u32, Option<String>)> {
    // Skip if already extracted (e.g. from a previous analysis run)
    let existing: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM paper_figures WHERE paper_id = ?")
        .bind(paper_id)
        .fetch_one(db)
        .await
        .unwrap_or(0);
    if existing > 0 {
        return sqlx::query("SELECT fig_index, caption FROM paper_figures WHERE paper_id = ? ORDER BY fig_index")
            .bind(paper_id)
            .fetch_all(db)
            .await
            .unwrap_or_default()
            .iter()
            .map(|r| (r.get::<i64, _>("fig_index") as u32, r.get("caption")))
            .collect();
    }

    let fp = match file_path.filter(|f| !f.trim().is_empty()) {
        Some(f) => f,
        None => return Vec::new(),
    };
    let pdf_path = PathBuf::from(fp);
    if !pdf_path.exists() { return Vec::new(); }

    let data_dir = match app.path().app_data_dir() {
        Ok(d) => d,
        Err(_) => return Vec::new(),
    };
    let figures_dir = data_dir.join("papers").join(paper_id).join("figures");
    if std::fs::create_dir_all(&figures_dir).is_err() { return Vec::new(); }

    // Phase 1: lopdf bitmap extraction (CPU-bound → spawn_blocking)
    let captions = extract_figure_captions(full_text);
    let lopdf_figs = {
        let pdf_p = pdf_path.clone();
        let fig_d = figures_dir.clone();
        let caps = captions.clone();
        tokio::task::spawn_blocking(move || extract_pdf_images(&pdf_p, &fig_d, &caps))
            .await
            .unwrap_or_default()
    };

    let now = chrono::Utc::now().to_rfc3339();
    let mut extracted: std::collections::HashSet<u32> = std::collections::HashSet::new();

    for (idx, caption, fp_img) in &lopdf_figs {
        let fig_id = format!("{paper_id}-{idx}");
        let _ = sqlx::query(
            "INSERT OR IGNORE INTO paper_figures (id, paper_id, fig_index, caption, file_path, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(&fig_id).bind(paper_id).bind(*idx as i64)
        .bind(caption).bind(fp_img.to_string_lossy().as_ref()).bind(&now)
        .execute(db).await;
        extracted.insert(*idx);
    }

    // Phase 2: vision LLM scan for non-extractable figures (vector graphics, tables)
    if let Some(client) = vision_client {
        let pages_dir = figures_dir.join("_pages");
        let _ = std::fs::create_dir_all(&pages_dir);

        let page_images = {
            let pdf_p = pdf_path.clone();
            let pg_d = pages_dir.clone();
            tokio::task::spawn_blocking(move || render_pdf_pages(&pdf_p, &pg_d, 8))
                .await
                .unwrap_or_default()
        };

        for (page_no, page_path) in page_images.iter().enumerate() {
            let identified = match tokio::time::timeout(
                std::time::Duration::from_secs(12),
                vision_scan_page(client, vision_model, page_path),
            )
            .await
            {
                Ok(result) => result,
                Err(_) => Vec::new(),
            };
            for (fig_idx, _) in identified {
                if extracted.contains(&fig_idx) { continue; }
                // Use the rendered page image as the figure file
                let dest = figures_dir.join(format!("fig_{fig_idx}_p{}.png", page_no + 1));
                if std::fs::copy(page_path, &dest).is_ok() {
                    let fig_id = format!("{paper_id}-v{fig_idx}");
                    let caption = captions.get(&fig_idx).cloned();
                    let _ = sqlx::query(
                        "INSERT OR IGNORE INTO paper_figures (id, paper_id, fig_index, caption, file_path, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                    )
                    .bind(&fig_id).bind(paper_id).bind(fig_idx as i64)
                    .bind(&caption).bind(dest.to_string_lossy().as_ref()).bind(&now)
                    .execute(db).await;
                    extracted.insert(fig_idx);
                }
            }
        }

        // Clean up temporary page renders
        let _ = std::fs::remove_dir_all(&pages_dir);
    }

    sqlx::query("SELECT fig_index, caption FROM paper_figures WHERE paper_id = ? ORDER BY fig_index")
        .bind(paper_id)
        .fetch_all(db)
        .await
        .unwrap_or_default()
        .iter()
        .map(|r| (r.get::<i64, _>("fig_index") as u32, r.get("caption")))
        .collect()
}

/// Render up to `max_pages` pages of a PDF to PNG images in `output_dir`.
/// Tries pdftoppm (Poppler) first for per-page quality; falls back to qlmanage (macOS built-in).
fn render_pdf_pages(pdf_path: &Path, output_dir: &Path, max_pages: usize) -> Vec<PathBuf> {
    let stem = pdf_path.file_stem().unwrap_or_default().to_string_lossy().to_string();
    let page_prefix = output_dir.join(format!("{stem}_pg"));

    // Try pdftoppm (Poppler) — produces per-page PNG files
    let pdftoppm_ok = std::process::Command::new("pdftoppm")
        .args([
            "-r", "120", "-png",
            "-l", &max_pages.to_string(),
            pdf_path.to_str().unwrap_or(""),
            page_prefix.to_str().unwrap_or(""),
        ])
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false);

    if pdftoppm_ok {
        let mut pages: Vec<PathBuf> = std::fs::read_dir(output_dir)
            .ok().into_iter().flatten()
            .filter_map(|e| {
                let p = e.ok()?.path();
                let name = p.file_name()?.to_string_lossy().to_string();
                if name.starts_with(&format!("{stem}_pg")) && name.ends_with(".png") { Some(p) } else { None }
            })
            .collect();
        pages.sort();
        if !pages.is_empty() { return pages; }
    }

    // Fall back to qlmanage (macOS built-in) — produces a single preview image
    let ql_ok = std::process::Command::new("qlmanage")
        .args(["-t", "-s", "1200", "-o", output_dir.to_str().unwrap_or(""), pdf_path.to_str().unwrap_or("")])
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false);

    if ql_ok {
        // qlmanage outputs <filename>.pdf.png (appends .png to the full input filename)
        let ql_out = output_dir.join(format!("{}.png", pdf_path.file_name().unwrap_or_default().to_string_lossy()));
        if ql_out.exists() { return vec![ql_out]; }
    }

    Vec::new()
}

/// Ask a vision LLM to identify figure/table numbers in a rendered PDF page image.
/// Returns list of (fig_index, type) pairs. Errors are silently ignored.
async fn vision_scan_page(
    client: &LlmClient,
    model: Option<&str>,
    page_path: &Path,
) -> Vec<(u32, String)> {
    let image_data = match std::fs::read(page_path) {
        Ok(d) => d,
        Err(_) => return Vec::new(),
    };
    let b64 = general_purpose::STANDARD.encode(&image_data);

    const PROMPT: &str = "请分析这份学术论文的页面图片，识别其中所有的图（Figure/Fig）和表（Table）。\
对每个识别到的图或表，提取其编号（仅阿拉伯数字）和类型（figure 或 table）。\
图/表的标题通常出现在其正下方或正上方，格式如 \"Figure 1\"、\"Fig. 2\"、\"Table 3\"。\
只返回严格合法的 JSON，格式：{\"items\": [{\"index\": 1, \"type\": \"figure\"}, {\"index\": 2, \"type\": \"table\"}]}\
如果该页面没有图或表，返回：{\"items\": []}";

    let resp = match client.chat_with_image(&b64, "image/png", PROMPT, model, 0.1).await {
        Ok(r) => r,
        Err(_) => return Vec::new(),
    };

    let json_str = extract_json(&resp);
    let v: serde_json::Value = serde_json::from_str(&json_str).unwrap_or_default();
    v["items"].as_array()
        .map(|arr| {
            arr.iter().filter_map(|item| {
                let idx = item["index"].as_u64()? as u32;
                let t = item["type"].as_str().unwrap_or("figure").to_string();
                if idx > 0 && idx <= 100 { Some((idx, t)) } else { None }
            }).collect()
        })
        .unwrap_or_default()
}

/// Scan full text for figure/table captions, mapping figure number → caption line.
fn extract_figure_captions(full_text: &str) -> std::collections::HashMap<u32, String> {
    let mut captions = std::collections::HashMap::new();
    for line in full_text.lines() {
        let t = line.trim();
        if t.len() < 5 || t.len() > 400 {
            continue;
        }
        let lower = t.to_lowercase();
        let num_start = if lower.starts_with("figure ") { Some(7) }
            else if lower.starts_with("fig. ") { Some(5) }
            else if lower.starts_with("fig ") { Some(4) }
            else if lower.starts_with("table ") { Some(6) }
            else { None };
        if let Some(start) = num_start {
            if start >= t.len() { continue; }
            let digits: String = t[start..].chars().take_while(|c| c.is_ascii_digit()).collect();
            if let Ok(n) = digits.parse::<u32>() {
                if n > 0 && n <= 100 {
                    captions.entry(n).or_insert_with(|| t.to_string());
                }
            }
        }
    }
    captions
}

/// Check whether a stream's Filter chain includes the given filter name.
fn stream_has_filter(stream: &lopdf::Stream, filter_name: &[u8]) -> bool {
    use lopdf::Object;
    match stream.dict.get(b"Filter") {
        Ok(Object::Name(n)) => n.as_slice() == filter_name,
        Ok(Object::Array(arr)) => arr.iter().any(|o| {
            matches!(o, Object::Name(n) if n.as_slice() == filter_name)
        }),
        _ => false,
    }
}

/// Determine the number of color channels from a stream's ColorSpace entry.
/// Returns 0 if the colorspace is unsupported.
fn colorspace_channels(stream: &lopdf::Stream, doc: &lopdf::Document) -> u32 {
    use lopdf::Object;
    match stream.dict.get(b"ColorSpace") {
        Ok(Object::Name(n)) => match n.as_slice() {
            b"DeviceRGB" | b"CalRGB" => 3,
            b"DeviceGray" | b"CalGray" => 1,
            _ => 0,
        },
        Ok(Object::Array(arr)) => {
            match arr.first() {
                Some(Object::Name(n)) if n.as_slice() == b"ICCBased" => {
                    // Read N (number of components) from the ICC profile stream
                    let n = arr.get(1)
                        .and_then(|o| if let Object::Reference(r) = o { Some(*r) } else { None })
                        .and_then(|r| doc.get_object(r).ok())
                        .and_then(|o| if let Object::Stream(s) = o { Some(s.dict.clone()) } else { None })
                        .and_then(|d| d.get(b"N").ok().cloned())
                        .and_then(|o| if let Object::Integer(n) = o { Some(n as u32) } else { None })
                        .unwrap_or(3);
                    if n == 1 || n == 3 { n } else { 0 }
                },
                Some(Object::Name(n)) if n.as_slice() == b"CalRGB" => 3,
                Some(Object::Name(n)) if n.as_slice() == b"CalGray" => 1,
                _ => 0,
            }
        },
        _ => 0,
    }
}

/// Paeth predictor function used for PNG row de-filtering.
fn paeth_predictor(a: u8, b: u8, c: u8) -> u8 {
    let (a, b, c) = (a as i32, b as i32, c as i32);
    let p = a + b - c;
    let pa = (p - a).abs();
    let pb = (p - b).abs();
    let pc = (p - c).abs();
    if pa <= pb && pa <= pc { a as u8 } else if pb <= pc { b as u8 } else { c as u8 }
}

/// Apply PNG row de-prediction to raw decompressed FlateDecode data.
fn apply_png_predictor(data: &[u8], width: u32, channels: u32) -> Vec<u8> {
    let stride = (width * channels) as usize;
    let row_bytes = stride + 1; // +1 for the filter-type byte
    let num_rows = data.len() / row_bytes;
    let mut out = Vec::with_capacity(num_rows * stride);
    let mut prev = vec![0u8; stride];

    for r in 0..num_rows {
        let base = r * row_bytes;
        if base + row_bytes > data.len() { break; }
        let filter = data[base];
        let src = &data[base + 1..base + row_bytes];
        let mut row = vec![0u8; stride];

        for i in 0..stride {
            let left  = if i >= channels as usize { row[i - channels as usize] } else { 0 };
            let up    = prev[i];
            let upleft = if i >= channels as usize { prev[i - channels as usize] } else { 0 };
            row[i] = match filter {
                0 => src[i],
                1 => src[i].wrapping_add(left),
                2 => src[i].wrapping_add(up),
                3 => src[i].wrapping_add(((left as u16 + up as u16) / 2) as u8),
                4 => src[i].wrapping_add(paeth_predictor(left, up, upleft)),
                _ => src[i],
            };
        }
        out.extend_from_slice(&row);
        prev = row;
    }
    out
}

/// Decompress a FlateDecode (zlib/deflate) byte slice.
fn zlib_decompress(data: &[u8]) -> Option<Vec<u8>> {
    use flate2::read::ZlibDecoder;
    use std::io::Read;
    let mut dec = ZlibDecoder::new(data);
    let mut out = Vec::new();
    dec.read_to_end(&mut out).ok()?;
    Some(out)
}

/// Extract image XObjects from a PDF file into `output_dir`.
/// Supports JPEG (DCTDecode) and flat/PNG (FlateDecode) images.
/// Returns a list of (sequential_index, caption, file_path).
fn extract_pdf_images(
    pdf_path: &Path,
    output_dir: &Path,
    captions: &std::collections::HashMap<u32, String>,
) -> Vec<(u32, Option<String>, PathBuf)> {
    use lopdf::Object;
    let doc = match lopdf::Document::load(pdf_path) {
        Ok(d) => d,
        Err(_) => return Vec::new(),
    };

    // Collect image object IDs and sort for deterministic ordering
    let mut image_oids: Vec<lopdf::ObjectId> = doc.objects.iter()
        .filter_map(|(oid, obj)| {
            if let Object::Stream(s) = obj {
                let is_img = s.dict.get(b"Subtype")
                    .map(|o| matches!(o, Object::Name(n) if n.as_slice() == b"Image"))
                    .unwrap_or(false);
                if is_img { Some(*oid) } else { None }
            } else { None }
        })
        .collect();
    image_oids.sort();

    let mut results = Vec::new();
    let mut idx: u32 = 1;

    for (scanned, &oid) in image_oids.iter().enumerate() {
        if scanned >= 400 || idx > 30 { break; }

        let stream = match doc.objects.get(&oid) {
            Some(Object::Stream(s)) => s,
            _ => continue,
        };

        let width = match stream.dict.get(b"Width") {
            Ok(Object::Integer(n)) => *n as u32,
            _ => 0,
        };
        let height = match stream.dict.get(b"Height") {
            Ok(Object::Integer(n)) => *n as u32,
            _ => 0,
        };
        if width < 80 || height < 80 { continue; }

        if stream_has_filter(stream, b"DCTDecode") {
            // JPEG: raw stream bytes are valid JPEG data
            let fp = output_dir.join(format!("fig_{idx}.jpg"));
            if std::fs::write(&fp, &stream.content).is_ok() {
                results.push((idx, captions.get(&idx).cloned(), fp));
                idx += 1;
            }
        } else if stream_has_filter(stream, b"FlateDecode") {
            // Only handle 8-bit images
            let bits = match stream.dict.get(b"BitsPerComponent") {
                Ok(Object::Integer(n)) => *n as u32,
                _ => 8,
            };
            if bits != 8 { continue; }

            let channels = colorspace_channels(stream, &doc);
            if channels != 1 && channels != 3 { continue; }

            let raw = match zlib_decompress(&stream.content) {
                Some(d) => d,
                None => continue,
            };

            // Check for PNG predictor (Predictor >= 10 means PNG row filters)
            let predictor = match stream.dict.get(b"DecodeParms") {
                Ok(Object::Dictionary(d)) => match d.get(b"Predictor") {
                    Ok(Object::Integer(n)) => *n,
                    _ => 1,
                },
                _ => 1,
            };

            let pixels = if predictor >= 10 {
                apply_png_predictor(&raw, width, channels)
            } else {
                raw
            };

            let expected = (width * height * channels) as usize;
            if pixels.len() < expected { continue; }
            let pixel_data = pixels[..expected].to_vec();

            let fp = output_dir.join(format!("fig_{idx}.png"));
            let saved = if channels == 1 {
                image::GrayImage::from_raw(width, height, pixel_data)
                    .map(|img| img.save(&fp).is_ok())
                    .unwrap_or(false)
            } else {
                image::RgbImage::from_raw(width, height, pixel_data)
                    .map(|img| img.save(&fp).is_ok())
                    .unwrap_or(false)
            };

            if saved {
                results.push((idx, captions.get(&idx).cloned(), fp));
                idx += 1;
            }
        }
    }
    results
}

// ── List figures ──────────────────────────────────────────────────

#[tauri::command]
pub async fn papers_list_figures(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    paper_id: String,
) -> Result<serde_json::Value, String> {
    let paper_row = sqlx::query("SELECT file_path, full_text FROM papers WHERE id = ?")
        .bind(&paper_id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| e.to_string())?;

    let (paper_file_path, paper_full_text) = if let Some(row) = paper_row {
        (
            row.try_get::<Option<String>, _>("file_path").ok().flatten(),
            row.get::<Option<String>, _>("full_text").unwrap_or_default(),
        )
    } else {
        (None, String::new())
    };

    let mut rows = sqlx::query(
        "SELECT id, paper_id, fig_index, caption, file_path FROM paper_figures WHERE paper_id = ? ORDER BY fig_index",
    )
    .bind(&paper_id)
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    if rows.is_empty() {
        // Lazy fallback extraction (no vision LLM — used for papers analyzed before this change)
        ensure_figures_extracted(
            &app, &state.db, &paper_id,
            paper_file_path.as_deref(),
            &paper_full_text,
            None,  // no vision client in lazy path
            None,
        ).await;

        rows = sqlx::query(
            "SELECT id, paper_id, fig_index, caption, file_path FROM paper_figures WHERE paper_id = ? ORDER BY fig_index",
        )
        .bind(&paper_id)
        .fetch_all(&state.db)
        .await
        .map_err(|e| e.to_string())?;
    }

    if !rows.is_empty() && !paper_full_text.trim().is_empty() {
        let captions = extract_figure_captions(&paper_full_text);
        let mut caption_updated = false;
        for row in &rows {
            let current_caption: Option<String> = row.get("caption");
            if current_caption.as_deref().map(|value| value.trim().is_empty()).unwrap_or(true) {
                let fig_index: i64 = row.get("fig_index");
                if let Some(next_caption) = captions.get(&(fig_index as u32)) {
                    let figure_id: String = row.get("id");
                    let updated = sqlx::query(
                        "UPDATE paper_figures
                         SET caption = ?
                         WHERE id = ? AND (caption IS NULL OR TRIM(caption) = '')",
                    )
                    .bind(next_caption)
                    .bind(&figure_id)
                    .execute(&state.db)
                    .await
                    .map(|result| result.rows_affected() > 0)
                    .unwrap_or(false);
                    caption_updated = caption_updated || updated;
                }
            }
        }

        if caption_updated {
            rows = sqlx::query(
                "SELECT id, paper_id, fig_index, caption, file_path FROM paper_figures WHERE paper_id = ? ORDER BY fig_index",
            )
            .bind(&paper_id)
            .fetch_all(&state.db)
            .await
            .map_err(|e| e.to_string())?;
        }
    }

    // Collect metadata first (sync), then read all files concurrently (async)
    let row_meta: Vec<(String, String, i64, Option<String>, String)> = rows
        .iter()
        .map(|r| (
            r.get::<String, _>("id"),
            r.get::<String, _>("paper_id"),
            r.get::<i64, _>("fig_index"),
            r.get::<Option<String>, _>("caption"),
            r.get::<String, _>("file_path"),
        ))
        .collect();

    use futures_util::StreamExt as _;
    const READ_CONCURRENCY: usize = 8;

    let figures: Vec<serde_json::Value> = futures_util::stream::iter(row_meta)
        .map(|(id, paper_id, fig_index, caption, file_path)| async move {
            match tokio::fs::read(&file_path).await {
                Ok(data) => {
                    let b64 = general_purpose::STANDARD.encode(&data);
                    let ext = Path::new(&file_path).extension().and_then(|e| e.to_str()).unwrap_or("jpg");
                    let mime = if ext == "png" { "image/png" } else { "image/jpeg" };
                    Some(json!({
                        "id": id,
                        "paper_id": paper_id,
                        "fig_index": fig_index,
                        "caption": caption,
                        "data_url": format!("data:{mime};base64,{b64}"),
                    }))
                }
                Err(e) => {
                    eprintln!("[list_figures] failed to read figure file {file_path}: {e}");
                    None
                }
            }
        })
        .buffer_unordered(READ_CONCURRENCY)
        .filter_map(|x| async move { x })
        .collect()
        .await;

    Ok(json!(figures))
}

fn managed_papers_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let papers_dir = data_dir.join("papers");
    std::fs::create_dir_all(&papers_dir).map_err(|e| format!("无法创建 PDF 存储目录：{e}"))?;
    Ok(papers_dir)
}

fn copy_to_managed_papers_dir(app: &tauri::AppHandle, src: &Path, desired_stem: &str) -> Result<PathBuf, String> {
    let papers_dir = managed_papers_dir(app)?;
    let stem = sanitize_file_stem(desired_stem);
    let extension = src.extension().and_then(|v| v.to_str()).unwrap_or("pdf");
    let mut candidate = papers_dir.join(format!("{stem}.{extension}"));
    if candidate.exists() {
        let mut found = false;
        for index in 2..1000 {
            let maybe = papers_dir.join(format!("{stem} ({index}).{extension}"));
            if !maybe.exists() {
                candidate = maybe;
                found = true;
                break;
            }
        }
        if !found {
            return Err("目标目录中存在过多同名文件，无法完成复制。".to_string());
        }
    }
    std::fs::copy(src, &candidate).map_err(|e| format!("复制 PDF 到工作目录失败：{e}"))?;
    Ok(candidate)
}

async fn embed_in_batches(
    client: &LlmClient,
    texts: &[String],
    batch_size: usize,
) -> Option<Vec<Vec<f32>>> {
    if texts.is_empty() {
        return Some(Vec::new());
    }

    let mut all_embeddings = Vec::with_capacity(texts.len());
    for batch in texts.chunks(batch_size.max(1)) {
        match client.embed(batch).await {
            Ok(mut embeddings) => all_embeddings.append(&mut embeddings),
            Err(_) => return None,
        }
    }
    Some(all_embeddings)
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
        "importance_color": r.get::<Option<String>, _>("importance_color").unwrap_or_default(),
        "notes": r.get::<Option<String>, _>("notes"),
        "file_path": paper_file_path,
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
        let is_conference = if let Some(tag) = match_venue(venue) {
            let conference = tag.kind == "conference";
            obj["ccf_rating"] = json!(tag.rating);
            obj["ccf_area"] = json!(tag.area);
            obj["ccf_type"] = json!(tag.kind);
            obj["ccf_label"] = json!(tag.label);
            obj["ccf_publisher"] = json!(tag.publisher);
            obj["venue_url"] = json!(tag.url);
            conference
        } else {
            false
        };

        if !is_conference {
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
            keywords: None,
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
            keywords: None,
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
