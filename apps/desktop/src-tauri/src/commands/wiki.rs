use crate::{
    services::wiki::{
        compiler::{refresh_embeddings_for_pages, WikiCompileSummary},
        lint::WikiLintSummary,
        repository::{WikiCompileRun, WikiIssue, WikiPage, WikiPageDetail},
        WikiPageUpdate,
    },
    state::AppState,
};
use tauri::State;

#[tauri::command]
pub async fn wiki_list_pages(
    state: State<'_, AppState>,
    interest_id: String,
    query: Option<String>,
    status: Option<String>,
) -> Result<Vec<WikiPage>, String> {
    crate::services::wiki::list_pages(&state.db, &interest_id, query.as_deref(), status.as_deref())
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn wiki_get_page(
    state: State<'_, AppState>,
    page_id: String,
) -> Result<Option<WikiPageDetail>, String> {
    crate::services::wiki::get_page(&state.db, &page_id)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn wiki_compile_interest(
    state: State<'_, AppState>,
    interest_id: String,
    force: Option<bool>,
) -> Result<WikiCompileSummary, String> {
    let settings = state.settings.read().await.clone();
    crate::services::wiki::compile_interest(
        &state.db,
        &settings,
        &interest_id,
        force.unwrap_or(false),
    )
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn wiki_update_page(
    state: State<'_, AppState>,
    page_id: String,
    update: WikiPageUpdate,
) -> Result<WikiPageDetail, String> {
    let before = crate::services::wiki::get_page(&state.db, &page_id)
        .await
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "Wiki page not found".to_string())?;
    crate::services::wiki::update_page(&state.db, &page_id, update)
        .await
        .map_err(|error| error.to_string())?;
    let settings = state.settings.read().await.clone();
    refresh_embeddings_for_pages(&state.db, &settings, std::slice::from_ref(&page_id)).await;
    crate::services::wiki::lint_interest(&state.db, &before.page.research_interest_id)
        .await
        .map_err(|error| error.to_string())?;
    crate::services::wiki::get_page(&state.db, &page_id)
        .await
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "Wiki page not found".to_string())
}

#[tauri::command]
pub async fn wiki_lint_interest(
    state: State<'_, AppState>,
    interest_id: String,
) -> Result<WikiLintSummary, String> {
    crate::services::wiki::lint_interest(&state.db, &interest_id)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn wiki_list_issues(
    state: State<'_, AppState>,
    interest_id: String,
) -> Result<Vec<WikiIssue>, String> {
    crate::services::wiki::list_issues(&state.db, &interest_id)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn wiki_list_compile_runs(
    state: State<'_, AppState>,
    interest_id: String,
) -> Result<Vec<WikiCompileRun>, String> {
    crate::services::wiki::list_compile_runs(&state.db, &interest_id)
        .await
        .map_err(|error| error.to_string())
}
