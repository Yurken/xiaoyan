use crate::services::active_researcher_service;
use crate::state::AppState;
use tauri::{Emitter, State};

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
