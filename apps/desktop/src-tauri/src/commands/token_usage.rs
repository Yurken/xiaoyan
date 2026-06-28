use crate::state::AppState;
use crate::token_usage::{self, TokenUsageStats};
use tauri::State;

/// 返回累计 / 今日 / 本月的 token 用量统计，供设置-小妍展示。
#[tauri::command]
pub async fn token_usage_stats(state: State<'_, AppState>) -> Result<TokenUsageStats, String> {
    Ok(token_usage::compute_stats(&state.inner().db).await)
}
