use crate::commands::memory::{
    is_long_term_memory_enabled, record_knowledge_note_created_event,
    record_knowledge_note_deleted_event, record_knowledge_note_moved_event,
    record_knowledge_note_updated_event,
};
use crate::llm::LlmClient;
use crate::rag::{combined_search, serialize_embedding};
use crate::state::AppState;
use regex::Regex;
use serde_json::json;
use sqlx::Row;
use std::path::{Path, PathBuf};
use tauri::{Manager, State};
use uuid::Uuid;

fn note_embedding_text(title: &str, content: &str) -> String {
    format!("{title} {content}")
}

fn spawn_note_embedding_refresh(
    db: sqlx::SqlitePool,
    settings: std::collections::HashMap<String, String>,
    note_id: String,
    title: String,
    content: String,
) {
    let text = note_embedding_text(&title, &content);
    tokio::spawn(async move {
        if let Ok(client) = LlmClient::embed_client_from_settings(&settings) {
            if let Ok(embeddings) = client.embed(&[text]).await {
                if let Some(embedding) = embeddings.into_iter().next() {
                    let emb_str = serialize_embedding(&embedding);
                    let _ = sqlx::query("UPDATE knowledge_notes SET embedding = ? WHERE id = ?")
                        .bind(&emb_str)
                        .bind(&note_id)
                        .execute(&db)
                        .await;
                }
            }
        }
    });
}

pub fn note_row_to_json(r: &sqlx::sqlite::SqliteRow) -> serde_json::Value {
    let tags_str: String = r
        .get::<Option<String>, _>("tags")
        .unwrap_or_else(|| "[]".into());
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

#[tauri::command]
pub async fn knowledge_list_notes(
    state: State<'_, AppState>,
    search: Option<String>,
) -> Result<serde_json::Value, String> {
    if let Some(q) = search.filter(|value| !value.is_empty()) {
        let settings = state.settings.read().await.clone();
        if let Ok(client) = LlmClient::embed_client_from_settings(&settings) {
            if let Ok(embeddings) = client.embed(&[q.clone()]).await {
                if let Some(embedding) = embeddings.into_iter().next() {
                    let top_k: usize = settings
                        .get("rag_top_k")
                        .and_then(|value| value.parse().ok())
                        .unwrap_or(10);
                    let results = crate::rag::search_knowledge_notes(&state.db, &embedding, top_k)
                        .await
                        .map_err(|e| e.to_string())?;
                    let mut notes = Vec::new();
                    for result in results {
                        if let Ok(Some(row)) = sqlx::query(
                            "SELECT id, title, content, source_type, source_id, tags, research_interest_id, created_at, updated_at FROM knowledge_notes WHERE id = ?",
                        )
                        .bind(&result.id)
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

        let like = format!("%{q}%");
        let rows = sqlx::query(
            "SELECT id, title, content, source_type, source_id, tags, research_interest_id, created_at, updated_at
             FROM knowledge_notes WHERE title LIKE ? OR content LIKE ? ORDER BY created_at DESC LIMIT 20",
        )
        .bind(&like)
        .bind(&like)
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
pub async fn create_note_core(
    db: &sqlx::SqlitePool,
    settings: &std::collections::HashMap<String, String>,
    title: String,
    content: String,
    tags: Option<Vec<String>>,
    research_interest_id: Option<String>,
    source_type: &str,
    source_id: Option<String>,
) -> Result<serde_json::Value, String> {
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let next_tags = tags.unwrap_or_default();
    let tags_json = serde_json::to_string(&next_tags).unwrap_or_else(|_| "[]".into());
    let next_source_type = if source_type.is_empty() {
        "manual"
    } else {
        source_type
    };

    sqlx::query(
        "INSERT INTO knowledge_notes (id, title, content, tags, source_type, source_id, research_interest_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&title)
    .bind(&content)
    .bind(&tags_json)
    .bind(next_source_type)
    .bind(&source_id)
    .bind(&research_interest_id)
    .bind(&now)
    .bind(&now)
    .execute(db)
    .await
    .map_err(|e| e.to_string())?;

    spawn_note_embedding_refresh(
        db.clone(),
        settings.clone(),
        id.clone(),
        title.clone(),
        content.clone(),
    );

    if is_long_term_memory_enabled(settings) {
        let _ = record_knowledge_note_created_event(
            db,
            &id,
            &title,
            &content,
            research_interest_id.as_deref(),
            next_source_type,
        )
        .await;
    }

    Ok(json!({
        "id": id,
        "title": title,
        "content": content,
        "source_type": next_source_type,
        "source_id": source_id,
        "tags": next_tags,
        "research_interest_id": research_interest_id,
        "created_at": now,
        "updated_at": now
    }))
}

#[tauri::command]
pub async fn knowledge_create_note(
    state: State<'_, AppState>,
    title: String,
    content: String,
    tags: Option<Vec<String>>,
    research_interest_id: Option<String>,
    source_type: Option<String>,
    source_id: Option<String>,
) -> Result<serde_json::Value, String> {
    let settings = state.settings.read().await.clone();
    create_note_core(
        &state.db,
        &settings,
        title,
        content,
        tags,
        research_interest_id,
        source_type.as_deref().unwrap_or("manual"),
        source_id,
    )
    .await
}

#[tauri::command]
pub async fn knowledge_list_notes_by_source(
    state: State<'_, AppState>,
    source_type: String,
    source_id: String,
) -> Result<serde_json::Value, String> {
    let rows = if source_id.trim().is_empty() || source_id == "*" {
        sqlx::query(
            "SELECT id, title, content, source_type, source_id, tags, research_interest_id, created_at, updated_at
             FROM knowledge_notes
             WHERE source_type = ?
             ORDER BY created_at DESC",
        )
        .bind(&source_type)
        .fetch_all(&state.db)
        .await
        .map_err(|e| e.to_string())?
    } else {
        sqlx::query(
            "SELECT id, title, content, source_type, source_id, tags, research_interest_id, created_at, updated_at
             FROM knowledge_notes
             WHERE source_type = ? AND source_id = ?
             ORDER BY created_at DESC",
        )
        .bind(&source_type)
        .bind(&source_id)
        .fetch_all(&state.db)
        .await
        .map_err(|e| e.to_string())?
    };
    Ok(json!(rows.iter().map(note_row_to_json).collect::<Vec<_>>()))
}
#[tauri::command]
pub async fn knowledge_update_note(
    state: State<'_, AppState>,
    id: String,
    title: Option<String>,
    content: Option<String>,
    tags: Option<Vec<String>>,
) -> Result<serde_json::Value, String> {
    let existing = sqlx::query(
        "SELECT id, title, content, source_type, source_id, tags, research_interest_id, created_at, updated_at FROM knowledge_notes WHERE id = ?",
    )
    .bind(&id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| e.to_string())?
    .ok_or("未找到对应笔记。")?;

    let now = chrono::Utc::now().to_rfc3339();
    if let Some(next_title) = &title {
        sqlx::query("UPDATE knowledge_notes SET title = ?, updated_at = ? WHERE id = ?")
            .bind(next_title)
            .bind(&now)
            .bind(&id)
            .execute(&state.db)
            .await
            .map_err(|e| e.to_string())?;
    }
    if let Some(next_content) = &content {
        sqlx::query("UPDATE knowledge_notes SET content = ?, updated_at = ? WHERE id = ?")
            .bind(next_content)
            .bind(&now)
            .bind(&id)
            .execute(&state.db)
            .await
            .map_err(|e| e.to_string())?;
    }
    if let Some(next_tags) = &tags {
        let tags_json = serde_json::to_string(next_tags).unwrap_or_else(|_| "[]".into());
        sqlx::query("UPDATE knowledge_notes SET tags = ?, updated_at = ? WHERE id = ?")
            .bind(&tags_json)
            .bind(&now)
            .bind(&id)
            .execute(&state.db)
            .await
            .map_err(|e| e.to_string())?;
    }

    let row = sqlx::query(
        "SELECT id, title, content, source_type, source_id, tags, research_interest_id, created_at, updated_at FROM knowledge_notes WHERE id = ?",
    )
    .bind(&id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| e.to_string())?
    .ok_or("未找到对应笔记。")?;

    let final_title = row.get::<String, _>("title");
    let final_content = row.get::<String, _>("content");
    let final_interest_id = row.get::<Option<String>, _>("research_interest_id");
    let settings = state.settings.read().await.clone();

    let title_changed = title.is_some() && final_title != existing.get::<String, _>("title");
    let content_changed =
        content.is_some() && final_content != existing.get::<String, _>("content");
    if title_changed || content_changed {
        spawn_note_embedding_refresh(
            state.db.clone(),
            settings.clone(),
            id.clone(),
            final_title.clone(),
            final_content.clone(),
        );
    }

    if is_long_term_memory_enabled(&settings) {
        let _ = record_knowledge_note_updated_event(
            &state.db,
            &id,
            &final_title,
            &final_content,
            final_interest_id.as_deref(),
        )
        .await;
    }

    Ok(note_row_to_json(&row))
}

#[tauri::command]
pub async fn knowledge_move_note(
    state: State<'_, AppState>,
    id: String,
    research_interest_id: Option<String>,
) -> Result<serde_json::Value, String> {
    let existing = sqlx::query(
        "SELECT id, title, content, source_type, source_id, tags, research_interest_id, created_at, updated_at FROM knowledge_notes WHERE id = ?",
    )
    .bind(&id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| e.to_string())?
    .ok_or("未找到对应笔记。")?;

    let now = chrono::Utc::now().to_rfc3339();
    let normalized_interest_id = research_interest_id.and_then(|value| {
        let trimmed = value.trim().to_string();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
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

    let settings = state.settings.read().await.clone();
    if is_long_term_memory_enabled(&settings) {
        let _ = record_knowledge_note_moved_event(
            &state.db,
            &id,
            &row.get::<String, _>("title"),
            existing
                .get::<Option<String>, _>("research_interest_id")
                .as_deref(),
            normalized_interest_id.as_deref(),
        )
        .await;
    }

    Ok(note_row_to_json(&row))
}

#[tauri::command]
pub async fn knowledge_delete_note(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let existing = sqlx::query("SELECT title FROM knowledge_notes WHERE id = ?")
        .bind(&id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("未找到对应笔记。")?;

    let title = existing.get::<String, _>("title");
    sqlx::query("DELETE FROM knowledge_notes WHERE id = ?")
        .bind(&id)
        .execute(&state.db)
        .await
        .map_err(|e| e.to_string())?;

    let settings = state.settings.read().await.clone();
    if is_long_term_memory_enabled(&settings) {
        let _ = record_knowledge_note_deleted_event(&state.db, &id, &title).await;
    }

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
        Ok(client) => client,
        Err(_) => return Ok(json!([])),
    };
    let embeddings = match client.embed(&[q]).await {
        Ok(value) => value,
        Err(_) => return Ok(json!([])),
    };
    let embedding = match embeddings.into_iter().next() {
        Some(value) => value,
        None => return Ok(json!([])),
    };
    let results = combined_search(&state.db, &embedding, top_k)
        .await
        .map_err(|e| e.to_string())?;
    Ok(json!(results
        .into_iter()
        .map(|result| json!({
            "id": result.id,
            "content": result.content,
            "source": result.source,
            "score": result.score
        }))
        .collect::<Vec<_>>()))
}

// ── Markdown/Zip import helpers ──────────────────────────────────

#[derive(Debug, Default, serde::Deserialize)]
struct NoteFrontmatter {
    title: Option<String>,
    tags: Option<Vec<String>>,
}

fn parse_frontmatter(content: &str) -> (NoteFrontmatter, &str) {
    let trimmed = content.trim_start();
    if !trimmed.starts_with("---") {
        return (NoteFrontmatter::default(), content);
    }
    let after_first = &trimmed[3..];
    let Some(pos) = after_first.find("\n---") else {
        return (NoteFrontmatter::default(), content);
    };
    let yaml_text = &after_first[..pos];
    let rest = &after_first[pos + 4..];
    let body = rest.strip_prefix('\n').unwrap_or(rest);
    let frontmatter: NoteFrontmatter =
        serde_yaml::from_str(yaml_text).unwrap_or_else(|_| NoteFrontmatter::default());
    (frontmatter, body)
}

fn is_markdown_file_name(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    lower.ends_with(".md") || lower.ends_with(".markdown")
}

fn file_stem_from_path(path: &str) -> String {
    Path::new(path)
        .file_stem()
        .and_then(|s| s.to_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| "imported-note".to_string())
}

fn sanitize_asset_file_name(name: &str) -> String {
    let mut out = String::new();
    for ch in name.chars() {
        if ch.is_ascii_alphanumeric() || ch == '.' || ch == '_' || ch == '-' {
            out.push(ch);
        } else {
            out.push('_');
        }
    }
    out
}

fn extract_zip_archive(zip_path: &Path, dest_dir: &Path) -> Result<Vec<PathBuf>, String> {
    let file = std::fs::File::open(zip_path).map_err(|e| format!("无法打开压缩包：{e}"))?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| format!("无法解析压缩包：{e}"))?;

    let mut md_files = Vec::new();

    for i in 0..archive.len() {
        let mut entry = archive
            .by_index(i)
            .map_err(|e| format!("读取压缩包条目失败：{e}"))?;
        let raw_name = entry.name().replace("\\", "/");
        if raw_name.contains("..") || raw_name.starts_with('/') {
            continue;
        }
        let out_path = dest_dir.join(&raw_name);
        if entry.is_dir() {
            std::fs::create_dir_all(&out_path).map_err(|e| format!("创建解压目录失败：{e}"))?;
            continue;
        }
        if let Some(parent) = out_path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| format!("创建解压目录失败：{e}"))?;
        }
        let mut out_file =
            std::fs::File::create(&out_path).map_err(|e| format!("创建解压文件失败：{e}"))?;
        std::io::copy(&mut entry, &mut out_file).map_err(|e| format!("解压文件失败：{e}"))?;

        if is_markdown_file_name(&raw_name) {
            md_files.push(out_path);
        }
    }

    Ok(md_files)
}

fn collect_image_refs(content: &str) -> Vec<(String, usize, usize)> {
    let mut refs = Vec::new();
    let md_re = Regex::new(r#"!\[[^\]]*\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)"#).unwrap();
    let html_re = Regex::new(r#"<img[^>]+src=["']([^"']+)["'][^>]*>"#).unwrap();
    for cap in md_re.captures_iter(content) {
        let m = cap.get(1).unwrap();
        refs.push((m.as_str().to_string(), m.start(), m.end()));
    }
    for cap in html_re.captures_iter(content) {
        let m = cap.get(1).unwrap();
        refs.push((m.as_str().to_string(), m.start(), m.end()));
    }
    refs.sort_by_key(|r| r.1);
    refs
}

fn is_remote_or_absolute_path(src: &str) -> bool {
    src.starts_with("http://")
        || src.starts_with("https://")
        || src.starts_with("file://")
        || src.starts_with('/')
        || src.starts_with('\\')
        || src.starts_with("xynoteasset://")
}

fn rewrite_image_refs(
    content: &str,
    md_dir: &Path,
    note_assets_dir: &Path,
    note_id: &str,
    extracted_root: &Path,
) -> Result<(String, Vec<(String, String)>), String> {
    let refs = collect_image_refs(content);
    if refs.is_empty() {
        return Ok((content.to_string(), Vec::new()));
    }

    std::fs::create_dir_all(note_assets_dir).map_err(|e| format!("无法创建笔记资源目录：{e}"))?;

    let mut assets: Vec<(String, String)> = Vec::new();
    let mut rewritten = String::with_capacity(content.len());
    let mut last_end = 0;

    for (src, start, end) in refs {
        rewritten.push_str(&content[last_end..start]);
        if is_remote_or_absolute_path(&src) {
            rewritten.push_str(&src);
            last_end = end;
            continue;
        }

        let resolved_path = match md_dir.join(&src).canonicalize() {
            Ok(p) if p.is_file() && p.starts_with(extracted_root) => p,
            _ => match extracted_root.join(&src).canonicalize() {
                Ok(p) if p.is_file() && p.starts_with(extracted_root) => p,
                _ => {
                    rewritten.push_str(&src);
                    last_end = end;
                    continue;
                }
            },
        };

        let file_name = resolved_path
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("asset");
        let safe_name = sanitize_asset_file_name(file_name);
        let unique_name = if assets.iter().any(|(name, _)| name == &safe_name) {
            let short = &Uuid::new_v4().to_string()[..8];
            format!("{short}-{safe_name}")
        } else {
            safe_name
        };

        let dest = note_assets_dir.join(&unique_name);
        std::fs::copy(&resolved_path, &dest).map_err(|e| format!("复制图片资源失败：{e}"))?;

        let token = format!("xynoteasset://{note_id}/{unique_name}");
        assets.push((token.clone(), dest.to_string_lossy().to_string()));
        rewritten.push_str(&token);
        last_end = end;
    }
    rewritten.push_str(&content[last_end..]);

    Ok((rewritten, assets))
}

#[tauri::command]
pub async fn knowledge_import_zip(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    file_path: tauri_plugin_fs::FilePath,
    research_interest_id: Option<String>,
) -> Result<serde_json::Value, String> {
    let source = file_path
        .into_path()
        .map_err(|e| e.to_string())?
        .canonicalize()
        .map_err(|e| format!("压缩包路径不可访问：{e}"))?;
    if !source.is_file() {
        return Err("请选择一个压缩包文件。".to_string());
    }

    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let assets_root = app_data_dir.join("notes_assets");
    std::fs::create_dir_all(&assets_root).map_err(|e| format!("无法创建笔记资源目录：{e}"))?;

    let temp_dir = app_data_dir.join(format!("import_zip_temp_{}", Uuid::new_v4()));
    std::fs::create_dir_all(&temp_dir).map_err(|e| format!("无法创建临时解压目录：{e}"))?;

    let extracted_root = temp_dir.clone();
    let md_files =
        tauri::async_runtime::spawn_blocking(move || extract_zip_archive(&source, &extracted_root))
            .await
            .map_err(|e| format!("解压任务异常：{e}"))??;

    if md_files.is_empty() {
        let _ = std::fs::remove_dir_all(&temp_dir);
        return Err("压缩包内未找到 Markdown 文件。".to_string());
    }

    let normalized_interest_id = research_interest_id.and_then(|value| {
        let trimmed = value.trim().to_string();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    });

    let settings = state.settings.read().await.clone();
    let mut imported_notes = Vec::new();
    let mut errors = Vec::new();

    for md_path in md_files {
        let text = match tokio::fs::read_to_string(&md_path).await {
            Ok(t) => t,
            Err(e) => {
                errors.push(format!("{}：读取失败：{e}", md_path.display()));
                continue;
            }
        };
        let (frontmatter, body) = parse_frontmatter(&text);
        let title = frontmatter
            .title
            .unwrap_or_else(|| file_stem_from_path(md_path.to_string_lossy().as_ref()));
        let note_id = Uuid::new_v4().to_string();
        let note_assets_dir = assets_root.join(&note_id);
        let md_dir = md_path.parent().unwrap_or(Path::new(&temp_dir));
        let (content, assets) =
            match rewrite_image_refs(body, md_dir, &note_assets_dir, &note_id, &temp_dir) {
                Ok(c) => c,
                Err(e) => {
                    errors.push(format!("{}：处理图片失败：{e}", md_path.display()));
                    continue;
                }
            };

        match create_note_core(
            &state.db,
            &settings,
            title,
            content,
            frontmatter.tags,
            normalized_interest_id.clone(),
            "import_zip",
            None,
        )
        .await
        {
            Ok(note) => imported_notes.push(json!({ "note": note, "assets": assets })),
            Err(e) => errors.push(format!("{}：创建笔记失败：{e}", md_path.display())),
        }
    }

    let _ = std::fs::remove_dir_all(&temp_dir);

    Ok(json!({
        "imported": imported_notes.len(),
        "errors": errors,
        "notes": imported_notes,
    }))
}
