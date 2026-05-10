use crate::assistant_prompts::specialist_system;
use crate::ccf::{infer_from_text, match_venue};
use crate::commands::paper_analysis_text::{build_analysis_slices, build_reproduction_context};
use crate::commands::paper_figures::ensure_figures_extracted as ensure_paper_figures_extracted;
use crate::commands::paper_text::{
    extract_pdf_preview_text, extract_pdf_text_with_filtered_stderr, preview_from_text,
};
use crate::journal_partitions::match_journal;
use crate::links::paper_reference_url;
use crate::llm::{resolve_max_tokens, resolve_model, resolve_temperature, LlmClient, LlmMessage};
use crate::rag::{chunk_text, serialize_embedding};
use crate::state::AppState;
use serde::Deserialize;
use serde_json::json;
use sqlx::Row;
use std::path::{Path, PathBuf};
use std::time::Instant;
use tauri::{Emitter, Manager, State};
use tauri_plugin_opener::OpenerExt;
use uuid::Uuid;

fn has_meaningful_text(value: Option<&str>) -> bool {
    value.is_some_and(|text| !text.trim().is_empty())
}

fn canonical_pdf_file(path: PathBuf) -> Result<PathBuf, String> {
    let canonical = path
        .canonicalize()
        .map_err(|e| format!("PDF 文件不可访问：{e}"))?;
    if !canonical.is_file() {
        return Err("请选择有效的 PDF 文件。".to_string());
    }

    let is_pdf = canonical
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.eq_ignore_ascii_case("pdf"))
        .unwrap_or(false);
    if !is_pdf {
        return Err("仅支持 PDF 文件。".to_string());
    }

    Ok(canonical)
}

fn canonical_path_within(base: &Path, path: &Path, label: &str) -> Result<PathBuf, String> {
    let canonical_base = base
        .canonicalize()
        .map_err(|e| format!("无法校验{label}目录：{e}"))?;
    let canonical_path = path
        .canonicalize()
        .map_err(|e| format!("{label}不可访问：{e}"))?;

    if canonical_path.starts_with(&canonical_base) {
        Ok(canonical_path)
    } else {
        Err(format!("{label}不在应用管理目录内。"))
    }
}

fn canonical_managed_pdf_path(app: &tauri::AppHandle, path: &Path) -> Result<PathBuf, String> {
    let papers_dir = managed_papers_dir(app)?;
    canonical_path_within(&papers_dir, path, "PDF 文件")
}

fn analysis_json_from_row(row: &sqlx::sqlite::SqliteRow) -> Option<serde_json::Value> {
    let research_question = row.get::<Option<String>, _>("research_question");
    let core_method = row.get::<Option<String>, _>("core_method");
    let experiment_design = row.get::<Option<String>, _>("experiment_design");
    let experiment_results = row.get::<Option<String>, _>("experiment_results");
    let innovations = row.get::<Option<String>, _>("innovations");
    let limitations = row.get::<Option<String>, _>("limitations");
    let key_conclusions = row.get::<Option<String>, _>("key_conclusions");

    if ![
        research_question.as_deref(),
        core_method.as_deref(),
        experiment_design.as_deref(),
        experiment_results.as_deref(),
        innovations.as_deref(),
        limitations.as_deref(),
        key_conclusions.as_deref(),
    ]
    .into_iter()
    .any(has_meaningful_text)
    {
        return None;
    }

    Some(json!({
        "research_question": research_question,
        "core_method": core_method,
        "experiment_design": experiment_design,
        "experiment_results": experiment_results,
        "innovations": innovations,
        "limitations": limitations,
        "key_conclusions": key_conclusions,
    }))
}

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
    let rows = if let Some(interest_id) =
        research_interest_id.filter(|value| !value.trim().is_empty())
    {
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
            if let Some(analysis) = analysis_json_from_row(r) {
                v["analysis"] = analysis;
            }
            let env: Option<String> = r.try_get("environment_setup").ok().flatten();
            if env.as_deref().is_some_and(|value| !value.trim().is_empty()) {
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
    .and_then(|a: sqlx::sqlite::SqliteRow| {
        analysis_json_from_row(&a).map(|value| {
            let mut object = value.as_object().cloned().unwrap_or_default();
            object.insert("id".into(), json!(a.get::<String, _>("id")));
            object.insert("created_at".into(), json!(a.get::<String, _>("created_at")));
            serde_json::Value::Object(object)
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
    .and_then(|g: sqlx::sqlite::SqliteRow| {
        let environment_setup = g.get::<Option<String>, _>("environment_setup");
        if environment_setup
            .as_deref()
            .is_none_or(|value| value.trim().is_empty())
        {
            return None;
        }
        Some(json!({
            "id": g.get::<String, _>("id"),
            "code_repository": g.get::<Option<String>, _>("code_repository"),
            "environment_setup": environment_setup,
            "dependencies": g.get::<Option<String>, _>("dependencies"),
            "dataset_preparation": g.get::<Option<String>, _>("dataset_preparation"),
            "training_process": g.get::<Option<String>, _>("training_process"),
            "inference_process": g.get::<Option<String>, _>("inference_process"),
            "evaluation_metrics": g.get::<Option<String>, _>("evaluation_metrics"),
            "risks_and_notes": g.get::<Option<String>, _>("risks_and_notes"),
            "created_at": g.get::<String, _>("created_at"),
        }))
    });

    let mut paper = paper_row_to_json(&row, true);
    if let Some(obj) = paper.as_object_mut() {
        obj.insert(
            "analysis".into(),
            analysis.unwrap_or(serde_json::Value::Null),
        );
        obj.insert(
            "reproduction_guide".into(),
            guide.unwrap_or(serde_json::Value::Null),
        );
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
            .bind(if next.is_empty() {
                None::<String>
            } else {
                Some(next.to_string())
            })
            .bind(&now)
            .bind(&id)
            .execute(&state.db)
            .await
            .map_err(|e| e.to_string())?;
    }

    if let Some(value) = venue {
        let next = value.trim();
        sqlx::query("UPDATE papers SET venue = ?, updated_at = ? WHERE id = ?")
            .bind(if next.is_empty() {
                None::<String>
            } else {
                Some(next.to_string())
            })
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
            .bind(if next.is_empty() {
                None::<String>
            } else {
                Some(next.to_string())
            })
            .bind(&now)
            .bind(&id)
            .execute(&state.db)
            .await
            .map_err(|e| e.to_string())?;
    }

    if let Some(value) = research_interest_id {
        let next = value.trim();
        sqlx::query("UPDATE papers SET research_interest_id = ?, updated_at = ? WHERE id = ?")
            .bind(if next.is_empty() {
                None::<String>
            } else {
                Some(next.to_string())
            })
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
            .bind(if value.trim().is_empty() {
                None::<String>
            } else {
                Some(value.trim().to_string())
            })
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
            if let Ok(managed_path) = canonical_path_within(&papers_dir, &file_path, "PDF 文件") {
                let _ = std::fs::remove_file(managed_path);
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
    let path = canonical_managed_pdf_path(&app, Path::new(&path))?;
    let path = path.to_string_lossy().to_string();

    app.opener()
        .open_path(path, None::<&str>)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn papers_extract_pdf_text(
    file_path: tauri_plugin_fs::FilePath,
    max_chars: Option<usize>,
) -> Result<String, String> {
    let path = canonical_pdf_file(file_path.into_path().map_err(|e| e.to_string())?)?;
    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("该文件")
        .to_string();
    let max_chars = max_chars.unwrap_or(32_000).clamp(1_000, 100_000);

    let extract_started_at = Instant::now();
    eprintln!("[pdf-extract] start: path={}", path.display());
    let path_for_extract = path.clone();
    let text = tokio::task::spawn_blocking(move || {
        extract_pdf_text_with_filtered_stderr(&path_for_extract)
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
        return Err(format!(
            "{file_name} 未解析到可用正文，请确认文件内容可复制。"
        ));
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
    let path = canonical_pdf_file(file_path.into_path().map_err(|e| e.to_string())?)?;
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
    let any_recognition = recognize_title
        || recognize_authors
        || recognize_year
        || recognize_venue
        || recognize_keywords;
    let file_name_owned = file_name.to_string();

    // Always copy into the app-managed papers directory so the file survives
    // even if the user deletes or moves the original in Finder.
    let copy_started_at = Instant::now();
    let final_path = copy_to_managed_papers_dir(&app, &path, &original_stem)?;
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
    let chunk_size: usize = settings
        .get("chunk_size")
        .and_then(|v| v.parse().ok())
        .unwrap_or(800);
    let chunk_overlap: usize = settings
        .get("chunk_overlap")
        .and_then(|v| v.parse().ok())
        .unwrap_or(150);

    tokio::spawn(async move {
        let pipeline_started_at = Instant::now();
        eprintln!("[paper-import][{}] background pipeline start", pid);
        let parsing_now = chrono::Utc::now().to_rfc3339();
        let _ = sqlx::query("UPDATE papers SET status = 'parsing', updated_at = ? WHERE id = ?")
            .bind(&parsing_now)
            .bind(&pid)
            .execute(&db)
            .await;
        let _ = app.emit(
            "paper:status",
            json!({ "paper_id": pid, "status": "parsing" }),
        );
        eprintln!("[paper-import][{}] status=parsing emitted", pid);

        // ① 尽早启动全文提取（慢，CPU 密集，先开始但不等待）
        let preview_path = path_for_parse.clone();
        let full_text_started_at = Instant::now();
        eprintln!("[paper-import][{}] full_text extraction start", pid);
        let full_text_handle = tokio::task::spawn_blocking(move || {
            extract_pdf_text_with_filtered_stderr(&path_for_parse)
        });

        // ② 提取前3页预览文本（相对快），与①并发进行
        let preview_started_at = Instant::now();
        let mut preview_text =
            tokio::task::spawn_blocking(move || extract_pdf_preview_text(&preview_path, 3, 12_000))
                .await
                .ok()
                .flatten()
                .unwrap_or_default();
        eprintln!(
            "[paper-import][{}] preview extracted: chars={} elapsed_ms={}",
            pid,
            preview_text.chars().count(),
            preview_started_at.elapsed().as_millis()
        );
        if preview_text.is_empty() {
            eprintln!(
                "[paper-import][{}] preview unavailable: lopdf preview extraction returned empty",
                pid
            );
        }

        let text = match full_text_handle.await {
            Ok(Ok(value)) => value,
            Ok(Err(error)) => {
                let now = chrono::Utc::now().to_rfc3339();
                let _ =
                    sqlx::query("UPDATE papers SET status = 'failed', updated_at = ? WHERE id = ?")
                        .bind(&now)
                        .bind(&pid)
                        .execute(&db)
                        .await;
                let _ = app.emit("paper:status", json!({ "paper_id": pid, "status": "failed", "error": format!("PDF 解析失败：{error}") }));
                eprintln!(
                    "[paper-import][{}] full_text extraction failed: {}",
                    pid, error
                );
                return;
            }
            Err(join_error) => {
                let now = chrono::Utc::now().to_rfc3339();
                let _ =
                    sqlx::query("UPDATE papers SET status = 'failed', updated_at = ? WHERE id = ?")
                        .bind(&now)
                        .bind(&pid)
                        .execute(&db)
                        .await;
                let _ = app.emit("paper:status", json!({ "paper_id": pid, "status": "failed", "error": format!("PDF 后台解析任务失败：{join_error}") }));
                eprintln!(
                    "[paper-import][{}] full_text extraction join failed: {}",
                    pid, join_error
                );
                return;
            }
        };
        eprintln!(
            "[paper-import][{}] full_text extracted: chars={} elapsed_ms={}",
            pid,
            text.chars().count(),
            full_text_started_at.elapsed().as_millis()
        );

        if preview_text.is_empty() {
            preview_text = preview_from_text(&text, 12_000).unwrap_or_default();
            eprintln!(
                "[paper-import][{}] preview fallback from full_text: chars={}",
                pid,
                preview_text.chars().count()
            );
        }

        // ④ 基于有效预览文本做本地快速识别并更新初始字段
        let venue_and_kw_started_at = Instant::now();
        let inferred_venue = infer_from_text(&preview_text).map(|tag| tag.full_name);
        let preview_keywords =
            crate::commands::paper_analysis_text::extract_keywords_from_text(&preview_text);
        let preview_tags =
            serde_json::to_string(&preview_keywords).unwrap_or_else(|_| "[]".to_string());
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

        // ⑤ LLM 元数据识别
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

        if let Some(ref metadata) = metadata_opt {
            let meta_title = if recognize_title {
                clean_optional_text(metadata.title.clone())
            } else {
                None
            };
            let meta_authors = if recognize_authors {
                clean_optional_text(metadata.authors.clone())
            } else {
                None
            };
            let meta_year: Option<i64> = if recognize_year {
                metadata.year.filter(|v| *v > 0)
            } else {
                None
            };
            let meta_venue = if recognize_venue {
                clean_optional_text(metadata.venue.clone()).or(inferred_venue.clone())
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
            let _ = app.emit(
                "paper:status",
                json!({ "paper_id": pid, "status": "metadata" }),
            );
            eprintln!("[paper-import][{}] status=metadata emitted", pid);
        }

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

        let refreshed_keywords =
            crate::commands::paper_analysis_text::extract_keywords_from_text(&text);
        let refreshed_tags =
            serde_json::to_string(&refreshed_keywords).unwrap_or_else(|_| "[]".to_string());
        let parsed_now = chrono::Utc::now().to_rfc3339();
        let _ = sqlx::query("UPDATE papers SET full_text = ?, tags = ?, status = 'parsed', updated_at = ? WHERE id = ?")
            .bind(&text)
            .bind(&refreshed_tags)
            .bind(&parsed_now)
            .bind(&pid)
            .execute(&db)
            .await;
        // 全文已写入，立即通知前端 parsed，后续 embedding 在后台静默完成
        let _ = app.emit(
            "paper:status",
            json!({ "paper_id": pid, "status": "parsed" }),
        );
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
        let embeddings: Option<Vec<Vec<f32>>> =
            if let Ok(client) = LlmClient::embed_client_from_settings(&settings) {
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
                let emb_str: Option<String> = embeddings
                    .as_ref()
                    .and_then(|v| v.get(i))
                    .map(|e| serialize_embedding(e));
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
                let emb_str: Option<String> = embeddings
                    .as_ref()
                    .and_then(|v| v.get(i))
                    .map(|e| serialize_embedding(e));
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
    let full_text: String = row
        .get::<Option<String>, _>("full_text")
        .unwrap_or_default();
    let file_path_for_spawn: Option<String> = row.get("file_path");
    let status = row.get::<Option<String>, _>("status").unwrap_or_default();
    if full_text.trim().is_empty() {
        return Err(missing_full_text_message(&status).to_string());
    }
    let settings = state.settings.read().await.clone();
    let refreshed_keywords =
        crate::commands::paper_analysis_text::extract_keywords_from_text(&full_text);
    if !refreshed_keywords.is_empty() {
        let tags_json =
            serde_json::to_string(&refreshed_keywords).unwrap_or_else(|_| "[]".to_string());
        let now = chrono::Utc::now().to_rfc3339();
        let _ = sqlx::query("UPDATE papers SET tags = ?, updated_at = ? WHERE id = ?")
            .bind(&tags_json)
            .bind(&now)
            .bind(&id)
            .execute(&state.db)
            .await;
    }
    let db = state.db.clone();
    let pid = id.clone();
    let app_for_spawn = app.clone();
    let previous_status = status.clone();

    let analysis_slices = build_analysis_slices(&full_text);
    let intro_text = analysis_slices.intro_text;
    let method_text = analysis_slices.method_text;
    let experiment_text = analysis_slices.experiment_text;

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
                restore_paper_status(&db, &pid, &previous_status).await;
                let _ = app.emit(
                    "paper:status",
                    json!({ "paper_id": pid, "status": "error", "error": e.to_string() }),
                );
                return;
            }
        };
        let model = resolve_model(
            &settings,
            &[
                "paper_analysis_model",
                "multi_agent_paper_analyst_model",
                "multi_agent_worker_model",
            ],
        );
        let temperature = resolve_temperature(&settings, "paper_analysis_temperature", 0.3);
        let max_tokens = resolve_max_tokens(
            &settings,
            &[
                "paper_analysis_max_tokens",
                "multi_agent_paper_analyst_max_tokens",
                "multi_agent_worker_max_tokens",
            ],
            16_384,
        );
        let mut agent_errors: Vec<String> = Vec::new();

        // ── Phase 0: Figure extraction ────────────────────────────
        let _ = app.emit(
            "paper:status",
            json!({ "paper_id": pid, "status": "analyzing", "step": "图表提取中…" }),
        );
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
            ensure_paper_figures_extracted(
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
            let list = extracted_figures
                .iter()
                .map(|figure| {
                    let label = figure.reference_label();
                    if let Some(caption) = figure.caption.as_deref() {
                        format!("  • {label}: {caption}")
                    } else {
                        format!("  • {label}")
                    }
                })
                .collect::<Vec<_>>()
                .join("\n");
            format!("【论文图表（共 {} 个，已成功提取，请在分析中按类型和编号引用，如 Figure 1、Table 2）】\n{}\n\n", extracted_figures.len(), list)
        };

        // ── Agent 1: Problem & Background ────────────────────────
        let _ = app.emit(
            "paper:status",
            json!({ "paper_id": pid, "status": "analyzing", "step": "问题背景分析中（1/4）…" }),
        );
        let prompt1 = AGENT1_PROMPT.replace("{text}", &format!("{figure_context}{intro_text}"));
        let msgs1 = vec![
            LlmMessage::system(agent1_system()),
            LlmMessage::user(&prompt1),
        ];
        log_llm_request(
            "paper-analyze",
            &pid,
            "agent1",
            model.as_deref(),
            temperature,
            max_tokens,
            &msgs1,
        );
        let research_question = match client
            .chat_with_max_tokens(&msgs1, model.as_deref(), temperature, max_tokens)
            .await
        {
            Ok(resp) => {
                log_llm_response("paper-analyze", &pid, "agent1", &resp);
                match parse_llm_json_value(&resp) {
                    Ok(value) => value["research_question"].as_str().unwrap_or("").to_string(),
                    Err(error) => {
                        eprintln!("[paper-analyze][{}] agent1 parse failed: {}", pid, error);
                        agent_errors.push(format!("问题背景分析返回格式错误：{error}"));
                        String::new()
                    }
                }
            }
            Err(error) => {
                eprintln!("[paper-analyze][{}] agent1 failed: {}", pid, error);
                agent_errors.push(format!("问题背景分析失败：{error}"));
                String::new()
            }
        };

        // ── Agent 2: Method Deep-Dive ─────────────────────────────
        let _ = app.emit(
            "paper:status",
            json!({ "paper_id": pid, "status": "analyzing", "step": "方法深度解析中（2/4）…" }),
        );
        let prompt2 = AGENT2_PROMPT
            .replace("{problem_summary}", &research_question)
            .replace("{text}", &format!("{figure_context}{method_text}"));
        let msgs2 = vec![
            LlmMessage::system(agent2_system()),
            LlmMessage::user(&prompt2),
        ];
        log_llm_request(
            "paper-analyze",
            &pid,
            "agent2",
            model.as_deref(),
            temperature,
            max_tokens,
            &msgs2,
        );
        let core_method = match client
            .chat_with_max_tokens(&msgs2, model.as_deref(), temperature, max_tokens)
            .await
        {
            Ok(resp) => {
                log_llm_response("paper-analyze", &pid, "agent2", &resp);
                match parse_llm_json_value(&resp) {
                    Ok(value) => value["core_method"].as_str().unwrap_or("").to_string(),
                    Err(error) => {
                        eprintln!("[paper-analyze][{}] agent2 parse failed: {}", pid, error);
                        agent_errors.push(format!("方法解析返回格式错误：{error}"));
                        String::new()
                    }
                }
            }
            Err(error) => {
                eprintln!("[paper-analyze][{}] agent2 failed: {}", pid, error);
                agent_errors.push(format!("方法解析失败：{error}"));
                String::new()
            }
        };

        // ── Agent 3: Experiment Analysis ──────────────────────────
        let _ = app.emit(
            "paper:status",
            json!({ "paper_id": pid, "status": "analyzing", "step": "实验结果分析中（3/4）…" }),
        );
        let prompt3 = AGENT3_PROMPT
            .replace("{method_summary}", &core_method)
            .replace("{text}", &format!("{figure_context}{experiment_text}"));
        let msgs3 = vec![
            LlmMessage::system(agent3_system()),
            LlmMessage::user(&prompt3),
        ];
        log_llm_request(
            "paper-analyze",
            &pid,
            "agent3",
            model.as_deref(),
            temperature,
            max_tokens,
            &msgs3,
        );
        let (experiment_design, experiment_results) =
            match client
                .chat_with_max_tokens(&msgs3, model.as_deref(), temperature, max_tokens)
                .await
            {
                Ok(resp) => {
                    log_llm_response("paper-analyze", &pid, "agent3", &resp);
                    match parse_llm_json_value(&resp) {
                        Ok(value) => (
                            value["experiment_design"].as_str().unwrap_or("").to_string(),
                            value["experiment_results"].as_str().unwrap_or("").to_string(),
                        ),
                        Err(error) => {
                            eprintln!("[paper-analyze][{}] agent3 parse failed: {}", pid, error);
                            agent_errors.push(format!("实验分析返回格式错误：{error}"));
                            (String::new(), String::new())
                        }
                    }
                }
                Err(error) => {
                    eprintln!("[paper-analyze][{}] agent3 failed: {}", pid, error);
                    agent_errors.push(format!("实验分析失败：{error}"));
                    (String::new(), String::new())
                }
            };

        // ── Agent 4: Synthesis & Critique ─────────────────────────
        let _ = app.emit(
            "paper:status",
            json!({ "paper_id": pid, "status": "analyzing", "step": "综合评审中（4/4）…" }),
        );
        let experiment_summary = format!("{}\n\n{}", experiment_design, experiment_results);
        let prompt4 = AGENT4_PROMPT
            .replace(
                "{problem_summary}",
                &format!("{figure_context}{research_question}"),
            )
            .replace("{method_summary}", &core_method)
            .replace("{experiment_summary}", &experiment_summary);
        let msgs4 = vec![
            LlmMessage::system(agent4_system()),
            LlmMessage::user(&prompt4),
        ];
        log_llm_request(
            "paper-analyze",
            &pid,
            "agent4",
            model.as_deref(),
            temperature,
            max_tokens,
            &msgs4,
        );
        let (innovations, limitations, key_conclusions) =
            match client
                .chat_with_max_tokens(&msgs4, model.as_deref(), temperature, max_tokens)
                .await
            {
                Ok(resp) => {
                    log_llm_response("paper-analyze", &pid, "agent4", &resp);
                    match parse_llm_json_value(&resp) {
                        Ok(value) => (
                            value["innovations"].as_str().unwrap_or("").to_string(),
                            value["limitations"].as_str().unwrap_or("").to_string(),
                            value["key_conclusions"].as_str().unwrap_or("").to_string(),
                        ),
                        Err(error) => {
                            eprintln!("[paper-analyze][{}] agent4 parse failed: {}", pid, error);
                            agent_errors.push(format!("综合评审返回格式错误：{error}"));
                            (String::new(), String::new(), String::new())
                        }
                    }
                }
                Err(error) => {
                    eprintln!("[paper-analyze][{}] agent4 failed: {}", pid, error);
                    agent_errors.push(format!("综合评审失败：{error}"));
                    (String::new(), String::new(), String::new())
                }
            };

        if [
            research_question.trim(),
            core_method.trim(),
            experiment_design.trim(),
            experiment_results.trim(),
            innovations.trim(),
            limitations.trim(),
            key_conclusions.trim(),
        ]
        .iter()
        .all(|value| value.is_empty())
        {
            restore_paper_status(&db, &pid, &previous_status).await;
            let error_message = agent_errors
                .into_iter()
                .find(|value| !value.trim().is_empty())
                .unwrap_or_else(|| "论文解读未生成有效内容，请检查模型配置或稍后重试。".to_string());
            let _ = app.emit(
                "paper:status",
                json!({
                    "paper_id": pid,
                    "status": "error",
                    "error": error_message
                }),
            );
            eprintln!(
                "[paper-analyze][{}] all agent outputs empty; skip persist",
                pid
            );
            return;
        }

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
        }))
        .unwrap_or_default();

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
            .bind(&now)
            .bind(&pid)
            .execute(&db)
            .await;
        let _ = app.emit(
            "paper:status",
            json!({ "paper_id": pid, "status": "analyzed" }),
        );
    });
    Ok(())
}

// ── Reproduce ────────────────────────────────────────────────────

const REPRODUCE_PROMPT: &str = r#"请根据以下论文内容生成详尽的复现指南，仅返回严格合法的 JSON，不要输出 JSON 以外的内容。

核心原则：
- 所有字段内容使用中文，URL 除外
- 字段值使用 Markdown 格式：有序列表用 `1. 2. 3.`，子项用缩进，重点用 **加粗**，代码/命令/库名用 `反引号`
- 内容要完整但克制，优先给最小可执行步骤，不要写成长篇背景综述
- 单个字段尽量控制在 300-800 中文字；确需更长时，优先保留步骤、版本、命令和链接，删去解释性赘述
- 不要使用 Markdown 表格
- 不要输出超过 10 行的长代码块，不要给大段 Python 脚本；如需示例，只给最小命令骨架或 3-6 行伪代码
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
- 优先用项目列表，不要输出表格

dataset_preparation：
- 论文使用的数据集：名称、规模、获取链接（官方下载页、Kaggle、HuggingFace Datasets 等）
- 若数据集不公开，提供相似的替代公开数据集及下载链接
- 给出数据预处理步骤（格式转换、划分方式、关键参数）
- 不要提供长篇数据处理脚本，必要时只给命令骨架或极短伪代码

training_process：
- 分阶段描述完整训练流程
- 列出关键超参数及论文给出的值（或合理推荐值）
- 给出参考训练命令结构（如 `python train.py --lr 1e-4 --epochs 100`）
- 说明预期训练时长和资源需求（GPU 显存、内存）
- 不要贴完整训练脚本

inference_process：
- 模型加载与推理步骤
- 输入格式要求和输出解读方式
- 给出推理命令示例
- 不要贴完整推理脚本

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
    let full_text: String = row
        .get::<Option<String>, _>("full_text")
        .unwrap_or_default();
    let status = row.get::<Option<String>, _>("status").unwrap_or_default();
    if full_text.trim().is_empty() {
        return Err(missing_full_text_message(&status).to_string());
    }
    let reproduction_context = build_reproduction_context(&full_text, 24_000);
    let settings = state.settings.read().await.clone();
    let db = state.db.clone();
    let pid = id.clone();
    let prompt = REPRODUCE_PROMPT.replace("{text}", &reproduction_context);
    let previous_status = status.clone();

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
                restore_paper_status(&db, &pid, &previous_status).await;
                let _ = app.emit(
                    "paper:status",
                    json!({ "paper_id": pid, "status": "error", "error": e.to_string() }),
                );
                return;
            }
        };
        let model = resolve_model(
            &settings,
            &[
                "paper_reproduction_model",
                "multi_agent_reproduction_model",
                "multi_agent_worker_model",
            ],
        );
        let temperature = resolve_temperature(&settings, "paper_reproduction_temperature", 0.25);
        let max_tokens = resolve_max_tokens(
            &settings,
            &[
                "paper_reproduction_max_tokens",
                "multi_agent_reproduction_max_tokens",
                "multi_agent_worker_max_tokens",
            ],
            16_384,
        );
        let msgs = vec![
            LlmMessage::system(reproduce_system()),
            LlmMessage::user(&prompt),
        ];
        log_llm_request(
            "paper-reproduce",
            &pid,
            "guide",
            model.as_deref(),
            temperature,
            max_tokens,
            &msgs,
        );

        match client
            .chat_with_max_tokens(&msgs, model.as_deref(), temperature, max_tokens)
            .await
        {
            Ok(response) => {
                log_llm_response("paper-reproduce", &pid, "guide", &response);
                let v = match parse_llm_json_value(&response) {
                    Ok(value) => value,
                    Err(error) => {
                        restore_paper_status(&db, &pid, &previous_status).await;
                        let _ = app.emit(
                            "paper:status",
                            json!({ "paper_id": pid, "status": "error", "error": error }),
                        );
                        return;
                    }
                };
                let fields = reproduction_guide_fields_from_value(&v);
                if !fields.has_meaningful_content() {
                    restore_paper_status(&db, &pid, &previous_status).await;
                    let _ = app.emit(
                        "paper:status",
                        json!({
                            "paper_id": pid,
                            "status": "error",
                            "error": "复现指南生成结果为空，请检查模型配置或稍后重试。"
                        }),
                    );
                    eprintln!(
                        "[paper-reproduce][{}] empty guide after parsing: {}",
                        pid,
                        extract_json(&response)
                    );
                    return;
                }
                let guide_id = Uuid::new_v4().to_string();
                let now = chrono::Utc::now().to_rfc3339();
                let raw = response.clone();
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
                .bind(fields.code_repository.as_deref()).bind(fields.environment_setup.as_deref())
                .bind(fields.dependencies.as_deref()).bind(fields.dataset_preparation.as_deref())
                .bind(fields.training_process.as_deref()).bind(fields.inference_process.as_deref())
                .bind(fields.evaluation_metrics.as_deref()).bind(fields.risks_and_notes.as_deref())
                .bind(&raw).bind(&now)
                .execute(&db).await;
                let _ = sqlx::query(
                    "UPDATE papers SET status = 'reproduced', updated_at = ? WHERE id = ?",
                )
                .bind(&now)
                .bind(&pid)
                .execute(&db)
                .await;
                let _ = app.emit(
                    "paper:status",
                    json!({ "paper_id": pid, "status": "reproduced" }),
                );
            }
            Err(e) => {
                restore_paper_status(&db, &pid, &previous_status).await;
                let _ = app.emit(
                    "paper:status",
                    json!({ "paper_id": pid, "status": "error", "error": e.to_string() }),
                );
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
        let mut lines = s.lines();
        let _opening_fence = lines.next();
        let body_lines: Vec<&str> = lines.collect();
        let has_closing_fence = body_lines
            .last()
            .is_some_and(|line| line.trim_start().starts_with("```"));
        if has_closing_fence {
            body_lines[..body_lines.len().saturating_sub(1)].join("\n")
        } else {
            body_lines.join("\n")
        }
    } else {
        s.to_string()
    };
    let start = s.find('{').unwrap_or(0);
    let end = s.rfind('}').map(|i| i + 1).unwrap_or(s.len());
    s[start..end].to_string()
}

async fn restore_paper_status(db: &sqlx::SqlitePool, paper_id: &str, fallback_status: &str) {
    let next_status = if fallback_status.trim().is_empty() {
        "parsed"
    } else {
        fallback_status
    };
    let now = chrono::Utc::now().to_rfc3339();
    let _ = sqlx::query("UPDATE papers SET status = ?, updated_at = ? WHERE id = ?")
        .bind(next_status)
        .bind(&now)
        .bind(paper_id)
        .execute(db)
        .await;
}

fn parse_llm_json_value(response: &str) -> Result<serde_json::Value, String> {
    let clean = extract_json(response);
    serde_json::from_str::<serde_json::Value>(&clean).map_err(|error| {
        if error.is_eof() {
            "模型输出在 JSON 中途被截断，通常是 max_tokens 不足或回复过长。请提高当前功能对应的 max_tokens，或缩短模型输出。".to_string()
        } else {
            format!("模型返回的 JSON 解析失败：{error}")
        }
    })
}

fn log_llm_request(
    scope: &str,
    paper_id: &str,
    stage: &str,
    model: Option<&str>,
    temperature: f32,
    max_tokens: u32,
    messages: &[LlmMessage],
) {
    let rendered = messages
        .iter()
        .enumerate()
        .map(|(index, message)| {
            format!(
                "----- message {} ({}) -----\n{}",
                index + 1,
                message.role,
                message.content
            )
        })
        .collect::<Vec<_>>()
        .join("\n");

    eprintln!(
        "[{}][{}] {} request model={} temperature={} max_tokens={}\n===== BEGIN REQUEST =====\n{}\n===== END REQUEST =====",
        scope,
        paper_id,
        stage,
        model.unwrap_or("<default>"),
        temperature,
        max_tokens,
        rendered
    );
}

fn log_llm_response(scope: &str, paper_id: &str, stage: &str, response: &str) {
    eprintln!(
        "[{}][{}] {} response chars={}\n===== BEGIN RESPONSE =====\n{}\n===== END RESPONSE =====",
        scope,
        paper_id,
        stage,
        response.chars().count(),
        response
    );
}

#[derive(Default)]
struct ReproductionGuideFields {
    code_repository: Option<String>,
    environment_setup: Option<String>,
    dependencies: Option<String>,
    dataset_preparation: Option<String>,
    training_process: Option<String>,
    inference_process: Option<String>,
    evaluation_metrics: Option<String>,
    risks_and_notes: Option<String>,
}

impl ReproductionGuideFields {
    fn has_meaningful_content(&self) -> bool {
        [
            self.code_repository.as_deref(),
            self.environment_setup.as_deref(),
            self.dependencies.as_deref(),
            self.dataset_preparation.as_deref(),
            self.training_process.as_deref(),
            self.inference_process.as_deref(),
            self.evaluation_metrics.as_deref(),
            self.risks_and_notes.as_deref(),
        ]
        .into_iter()
        .flatten()
        .any(|value| !value.trim().is_empty())
    }
}

fn reproduction_guide_fields_from_value(value: &serde_json::Value) -> ReproductionGuideFields {
    ReproductionGuideFields {
        code_repository: json_text_field(value, "code_repository"),
        environment_setup: json_text_field(value, "environment_setup"),
        dependencies: json_text_field(value, "dependencies"),
        dataset_preparation: json_text_field(value, "dataset_preparation"),
        training_process: json_text_field(value, "training_process"),
        inference_process: json_text_field(value, "inference_process"),
        evaluation_metrics: json_text_field(value, "evaluation_metrics"),
        risks_and_notes: json_text_field(value, "risks_and_notes"),
    }
}

fn json_text_field(value: &serde_json::Value, key: &str) -> Option<String> {
    value
        .get(key)
        .and_then(|item| item.as_str())
        .map(|item| item.trim().to_string())
        .filter(|item| !item.is_empty() && item != "暂无")
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
    let response = client
        .chat(&messages, model.as_deref(), temperature)
        .await
        .ok()?;
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

    let title = clean_optional_text(metadata.title.clone())
        .unwrap_or_else(|| fallback_title.trim().to_string());
    let authors = clean_optional_text(metadata.authors.clone()).unwrap_or_default();
    let first_author = extract_first_author(&authors);
    let year = metadata
        .year
        .filter(|value| *value > 0)
        .map(|value| value.to_string())
        .unwrap_or_default();
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
        "keywords—",
        "keywords:",
        "key words:",
        "key words—",
        "index terms—",
        "index terms:",
        "index terms\n",
        "keywords\n",
    ];

    let kw_start = markers
        .iter()
        .find_map(|m| lower.find(m).map(|p| p + m.len()));
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

fn managed_papers_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let papers_dir = data_dir.join("papers");
    std::fs::create_dir_all(&papers_dir).map_err(|e| format!("无法创建 PDF 存储目录：{e}"))?;
    Ok(papers_dir)
}

fn copy_to_managed_papers_dir(
    app: &tauri::AppHandle,
    src: &Path,
    desired_stem: &str,
) -> Result<PathBuf, String> {
    let src = canonical_pdf_file(src.to_path_buf())?;
    let papers_dir = managed_papers_dir(app)?;
    let stem = sanitize_file_stem(desired_stem);
    let mut candidate = papers_dir.join(format!("{stem}.pdf"));
    if candidate.exists() {
        let mut found = false;
        for index in 2..1000 {
            let maybe = papers_dir.join(format!("{stem} ({index}).pdf"));
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
    std::fs::copy(&src, &candidate).map_err(|e| format!("复制 PDF 到工作目录失败：{e}"))?;
    canonical_path_within(&papers_dir, &candidate, "PDF 文件")
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
    let tags_str: String = r
        .get::<Option<String>, _>("tags")
        .unwrap_or_else(|| "[]".into());
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
        assert_eq!(
            rendered,
            "Ashish Vaswani - Attention Is All You Need (2017)"
        );
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
