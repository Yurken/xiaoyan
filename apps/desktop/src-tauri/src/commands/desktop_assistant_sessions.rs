//! 桌面助手临时会话保存与主窗口接续命令。

use sqlx::SqlitePool;
use tauri::{command, Emitter, Manager, State};

use crate::services::desktop_assistant::session_service::{
    AssistantSessionPromotionInput, AssistantSessionPromotionResult, AssistantSessionService,
};
use crate::state::AppState;

use super::desktop_assistant::ensure_assistant_enabled;

#[command]
pub async fn assistant_promote_session(
    state: State<'_, AppState>,
    input: AssistantSessionPromotionInput,
) -> Result<AssistantSessionPromotionResult, String> {
    ensure_assistant_enabled()?;
    AssistantSessionService::promote(&state.db, input)
        .await
        .map_err(|error| error.to_string())
}

#[command]
pub async fn assistant_open_conversation(
    state: State<'_, AppState>,
    app: tauri::AppHandle,
    conversation_id: String,
) -> Result<(), String> {
    let conversation_id = validated_conversation_id(&state.db, &conversation_id).await?;
    let main = app
        .get_webview_window("main")
        .ok_or_else(|| "主窗口尚未创建".to_string())?;
    main.show().map_err(|error| error.to_string())?;
    let _ = main.unminimize();
    main.set_focus().map_err(|error| error.to_string())?;
    app.emit_to(
        "main",
        "assistant:open-conversation",
        serde_json::json!({ "conversation_id": conversation_id }),
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

async fn validated_conversation_id(db: &SqlitePool, value: &str) -> Result<String, String> {
    let value = value.trim();
    if value.is_empty()
        || value.len() > 128
        || value
            .chars()
            .any(|character| character.is_control() || character.is_whitespace())
    {
        return Err("正式会话标识无效".to_string());
    }
    let exists = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM chat_sessions WHERE id = ?")
        .bind(value)
        .fetch_one(db)
        .await
        .map_err(|error| error.to_string())?;
    if exists == 0 {
        return Err("未找到对应的正式会话".to_string());
    }
    Ok(value.to_string())
}
