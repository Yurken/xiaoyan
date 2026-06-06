use tauri::command;
use crate::services::research_context_service::{ResearchContextService, ResearchTheme, ResearchThemeContext};

#[command]
pub fn research_context_get_recent_themes(limit: usize) -> Result<Vec<ResearchTheme>, String> {
    ResearchContextService::get_recent_themes(limit)
}

#[command]
pub fn research_context_get_theme_context(theme_id: String) -> Result<ResearchThemeContext, String> {
    ResearchContextService::get_theme_context(&theme_id)
}
