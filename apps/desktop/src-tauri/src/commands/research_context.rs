use tauri::{command, State};
use crate::services::research_context_service::{ResearchContextService, ResearchTheme, ResearchThemeContext};
use crate::state::AppState;

#[command]
pub async fn research_context_get_recent_themes(
    state: State<'_, AppState>,
    limit: usize,
) -> Result<Vec<ResearchTheme>, String> {
    ResearchContextService::get_recent_themes(&state.db, limit).await
}

#[command]
pub async fn research_context_get_theme_context(
    state: State<'_, AppState>,
    theme_id: String,
) -> Result<ResearchThemeContext, String> {
    ResearchContextService::get_theme_context(&state.db, &theme_id).await
}
