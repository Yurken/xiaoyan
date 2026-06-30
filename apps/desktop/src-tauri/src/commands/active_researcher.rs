use crate::services::active_researcher_service;
use crate::state::AppState;
use serde_json::json;
use sqlx::Row;
use std::{fs, path::PathBuf};
use tauri::{Emitter, State};
use tauri_plugin_fs::FilePath;
use uuid::Uuid;

use super::papers::papers_upload;

const ACTIVE_RESEARCHER_IMPORT_USER_AGENT: &str =
    "XiaoYanDesktop/0.4.3 (+https://github.com/openai)";

fn resolve_arxiv_pdf_url(raw_pdf_url: &str, arxiv_id: &str) -> String {
    let pdf_url = raw_pdf_url.trim();
    if !pdf_url.is_empty() {
        return pdf_url.to_string();
    }

    let normalized_id = arxiv_id.trim();
    if normalized_id.is_empty() {
        return String::new();
    }

    format!("https://arxiv.org/pdf/{normalized_id}.pdf")
}

async fn download_finding_pdf(pdf_url: &str) -> Result<PathBuf, String> {
    let response = reqwest::Client::new()
        .get(pdf_url)
        .header("User-Agent", ACTIVE_RESEARCHER_IMPORT_USER_AGENT)
        .send()
        .await
        .map_err(|error| format!("下载 arXiv 论文失败：{error}"))?;

    let status = response.status();
    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        return Err(format!("arXiv 下载失败（{status}）：{body}"));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|error| format!("读取 arXiv PDF 失败：{error}"))?;
    if !bytes.starts_with(b"%PDF-") {
        return Err("下载结果不是有效的 PDF 文件。".to_string());
    }

    let temp_path =
        std::env::temp_dir().join(format!("xiaoyan-arxiv-import-{}.pdf", Uuid::new_v4()));
    fs::write(&temp_path, bytes).map_err(|error| format!("保存临时 PDF 失败：{error}"))?;
    Ok(temp_path)
}

#[tauri::command]
pub async fn active_researcher_scan(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    days: Option<i64>,
    max_per_interest: Option<usize>,
) -> Result<serde_json::Value, String> {
    let days = days.unwrap_or(7);
    let max_per = max_per_interest.unwrap_or(10);
    let settings = state.settings.read().await.clone();

    active_researcher_service::ensure_table(&state.db).await?;
    let findings =
        active_researcher_service::scan_interests(&state.db, &settings, days, max_per).await?;
    let unread = active_researcher_service::count_unread(&state.db)
        .await
        .unwrap_or(0);

    let result = serde_json::json!({
        "findings": findings,
        "unread_count": unread,
        "scanned_interests": findings.iter().map(|f| f.interest_topic.clone()).collect::<std::collections::HashSet<_>>().len(),
    });

    let _ = app.emit("active-researcher:scan-complete", result.clone());
    Ok(result)
}

#[tauri::command]
pub async fn active_researcher_findings(
    state: State<'_, AppState>,
    limit: Option<i64>,
) -> Result<serde_json::Value, String> {
    active_researcher_service::ensure_table(&state.db).await?;
    let findings =
        active_researcher_service::get_recent_findings(&state.db, limit.unwrap_or(50)).await?;
    let unread = active_researcher_service::count_unread(&state.db)
        .await
        .unwrap_or(0);

    Ok(serde_json::json!({
        "findings": findings,
        "unread_count": unread,
    }))
}

#[tauri::command]
pub async fn active_researcher_import_finding(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<serde_json::Value, String> {
    active_researcher_service::ensure_table(&state.db).await?;

    let row = sqlx::query(
        "SELECT id, interest_id, arxiv_id, title, pdf_url
         FROM active_researcher_findings
         WHERE id = ?",
    )
    .bind(&id)
    .fetch_optional(&state.db)
    .await
    .map_err(|error| error.to_string())?
    .ok_or_else(|| "未找到对应的 arXiv 推荐记录。".to_string())?;

    let finding_id = row.get::<String, _>("id");
    let interest_id = row.get::<String, _>("interest_id");
    let arxiv_id = row.get::<String, _>("arxiv_id");
    let title = row.get::<String, _>("title");
    let pdf_url = resolve_arxiv_pdf_url(&row.get::<String, _>("pdf_url"), &arxiv_id);
    if pdf_url.is_empty() {
        return Err("这条 arXiv 推荐缺少可下载的 PDF 地址。".to_string());
    }

    let temp_path = download_finding_pdf(&pdf_url).await?;
    let db = state.db.clone();
    let upload_result = papers_upload(
        app,
        state,
        FilePath::Path(temp_path.clone()),
        Some(interest_id),
        Some(title.clone()),
    )
    .await;
    let _ = fs::remove_file(&temp_path);

    let mut payload = upload_result?;
    if let Some(object) = payload.as_object_mut() {
        object.insert("finding_id".into(), json!(finding_id.clone()));
    }

    if let Err(error) = active_researcher_service::mark_finding_read(&db, &finding_id).await {
        eprintln!(
            "[active-researcher] mark finding read after import failed: {}",
            error
        );
    }

    Ok(payload)
}

#[tauri::command]
pub async fn active_researcher_mark_read(
    state: State<'_, AppState>,
    id: Option<String>,
) -> Result<(), String> {
    if let Some(finding_id) = id {
        active_researcher_service::mark_finding_read(&state.db, &finding_id).await
    } else {
        active_researcher_service::mark_all_read(&state.db).await
    }
}

pub async fn auto_researcher_scan_on_startup(
    state: &crate::state::AppState,
    app: &tauri::AppHandle,
) {
    use crate::services::active_researcher_service;

    let settings = state.settings.read().await;
    let enabled = settings
        .get("xiaoyan_active_researcher_enabled")
        .map(|v| v == "true")
        .unwrap_or(true);
    drop(settings);
    if !enabled {
        return;
    }

    if active_researcher_service::ensure_table(&state.db)
        .await
        .is_err()
    {
        return;
    }

    let settings = state.settings.read().await.clone();
    let days = 7i64;
    let max_per = 8usize;

    match active_researcher_service::scan_interests(&state.db, &settings, days, max_per).await {
        Ok(findings) => {
            if findings.is_empty() {
                return;
            }
            let unread = active_researcher_service::count_unread(&state.db)
                .await
                .unwrap_or(0);
            let _ = app.emit(
                "active-researcher:scan-complete",
                serde_json::json!({
                    "count": findings.len(),
                    "unread": unread,
                }),
            );
        }
        Err(e) => {
            crate::append_diagnostic_log(&format!("active-researcher startup scan failed: {e}"));
        }
    }
}
