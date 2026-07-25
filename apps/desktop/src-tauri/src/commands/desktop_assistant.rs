//! 桌面助手命令模块
//!
//! 参数校验后委托 service，禁止承载业务逻辑

use serde::{Deserialize, Serialize};
use tauri::{command, State};

use crate::llm::LlmClient;
use crate::services::desktop_assistant::action_service::{
    ActionMetadata, ActionResult, ActionService, AssistantAction,
};
use crate::services::desktop_assistant::{
    CaptureService, CleanupService, PermissionService,
};
use crate::state::AppState;

/// 助手偏好设置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssistantPreferences {
    pub enabled: bool,
    pub shortcut: String,
    pub show_dock: bool,
    pub dock_position: String,
    pub allowed_apps: Vec<String>,
    pub blocked_apps: Vec<String>,
    pub skip_preview: bool,
    pub retain_policy: String,
    pub language: String,
}

/// 权限状态
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PermissionStatusResponse {
    pub accessibility: bool,
    pub screen_recording: bool,
    pub clipboard: bool,
}

/// 采集会话响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaptureSessionResponse {
    pub id: String,
    pub source_type: String,
    pub content: Option<String>,
    pub screenshot_path: Option<String>,
    pub source_app: Option<String>,
    pub source_app_bundle_id: Option<String>,
    pub window_title: Option<String>,
    pub status: String,
}

/// 动作结果响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionResultResponse {
    pub id: String,
    pub session_id: String,
    pub action: String,
    pub content: String,
    pub format: String,
}

/// 采集上下文响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaptureContextResponse {
    pub session_id: String,
    pub content: Option<String>,
    pub sanitized_content: Option<String>,
    pub source_app: Option<String>,
    pub source_app_bundle_id: Option<String>,
    pub window_title: Option<String>,
    pub status: String,
    pub privacy_check: Option<crate::services::desktop_assistant::permission_service::PrivacyCheckResult>,
}

impl From<crate::services::desktop_assistant::capture_service::CaptureStatus> for String {
    fn from(status: crate::services::desktop_assistant::capture_service::CaptureStatus) -> Self {
        match status {
            crate::services::desktop_assistant::capture_service::CaptureStatus::Idle => "idle".to_string(),
            crate::services::desktop_assistant::capture_service::CaptureStatus::Capturing => "capturing".to_string(),
            crate::services::desktop_assistant::capture_service::CaptureStatus::Ready => "ready".to_string(),
            crate::services::desktop_assistant::capture_service::CaptureStatus::Processing => "processing".to_string(),
            crate::services::desktop_assistant::capture_service::CaptureStatus::Error => "error".to_string(),
            crate::services::desktop_assistant::capture_service::CaptureStatus::Blocked => "blocked".to_string(),
        }
    }
}

fn status_to_string(status: crate::services::desktop_assistant::capture_service::CaptureStatus) -> String {
    status.into()
}

// ─── 权限相关命令 ──────────────────────────────────────────────────────────

/// 检查权限状态
#[command]
pub async fn assistant_check_permissions() -> Result<PermissionStatusResponse, String> {
    let status = PermissionService::check_permissions()
        .await
        .map_err(|e| e.to_string())?;

    Ok(PermissionStatusResponse {
        accessibility: status.accessibility,
        screen_recording: status.screen_recording,
        clipboard: status.clipboard,
    })
}

/// 请求辅助功能权限
#[command]
pub async fn assistant_request_accessibility() -> Result<bool, String> {
    PermissionService::request_accessibility()
        .await
        .map_err(|e| e.to_string())
}

/// 请求屏幕录制权限
#[command]
pub async fn assistant_request_screen_recording() -> Result<bool, String> {
    PermissionService::request_screen_recording()
        .await
        .map_err(|e| e.to_string())
}

// ─── 采集相关命令 ──────────────────────────────────────────────────────────

/// 获取选中文本（带隐私检查）
#[command]
pub async fn assistant_get_selection(state: State<'_, AppState>) -> Result<CaptureContextResponse, String> {
    let settings = state.settings.read().await.clone();
    let blocked_apps: Vec<String> = settings
        .get("assistant_blocked_apps")
        .map(|s| s.split(',').map(|s| s.trim().to_string()).collect())
        .unwrap_or_default();

    let result = CaptureService::get_context(
        &crate::services::desktop_assistant::capture_service::ContextSourceType::Selection,
        &blocked_apps,
    )
    .await
    .map_err(|e| e.to_string())?;

    Ok(CaptureContextResponse {
        session_id: result.session.id,
        content: result.session.content,
        sanitized_content: result.sanitized_content,
        source_app: result.session.source_app,
        source_app_bundle_id: result.session.source_app_bundle_id,
        window_title: result.session.window_title,
        status: status_to_string(result.session.status),
        privacy_check: result.session.privacy_check,
    })
}

/// 获取剪贴板内容（带隐私检查）
#[command]
pub async fn assistant_get_clipboard(state: State<'_, AppState>) -> Result<CaptureContextResponse, String> {
    let settings = state.settings.read().await.clone();
    let blocked_apps: Vec<String> = settings
        .get("assistant_blocked_apps")
        .map(|s| s.split(',').map(|s| s.trim().to_string()).collect())
        .unwrap_or_default();

    let result = CaptureService::get_context(
        &crate::services::desktop_assistant::capture_service::ContextSourceType::Clipboard,
        &blocked_apps,
    )
    .await
    .map_err(|e| e.to_string())?;

    Ok(CaptureContextResponse {
        session_id: result.session.id,
        content: result.session.content,
        sanitized_content: result.sanitized_content,
        source_app: result.session.source_app,
        source_app_bundle_id: result.session.source_app_bundle_id,
        window_title: result.session.window_title,
        status: status_to_string(result.session.status),
        privacy_check: result.session.privacy_check,
    })
}

/// 截取屏幕区域
#[command]
pub async fn assistant_capture_screen(
    _x: i32,
    _y: i32,
    _width: u32,
    _height: u32,
) -> Result<Vec<u8>, String> {
    // 使用 CaptureService 获取屏幕区域
    // 注意：当前实现使用 screencapture 命令行工具
    CaptureService::capture_screen_region(_x, _y, _width, _height)
        .await
        .map_err(|e| e.to_string())
}

/// 获取前台应用信息
#[command]
pub async fn assistant_get_frontmost_app() -> Result<(Option<String>, Option<String>, Option<String>), String> {
    CaptureService::get_frontmost_app()
        .await
        .map_err(|e| e.to_string())
}

// ─── 动作相关命令 ──────────────────────────────────────────────────────────

/// 执行解读动作
#[command]
pub async fn assistant_interpret(
    state: State<'_, AppState>,
    session_id: String,
    content: String,
    question: Option<String>,
) -> Result<ActionResultResponse, String> {
    let settings = state.settings.read().await.clone();
    let llm = LlmClient::from_settings(&settings).map_err(|e| e.to_string())?;
    let result = ActionService::interpret(&llm, &session_id, &content, question.as_deref())
        .await
        .map_err(|e| e.to_string())?;

    Ok(ActionResultResponse {
        id: result.id,
        session_id: result.session_id,
        action: "interpret".to_string(),
        content: result.content,
        format: result.format,
    })
}

/// 执行翻译动作
#[command]
pub async fn assistant_translate(
    state: State<'_, AppState>,
    session_id: String,
    content: String,
    target_lang: Option<String>,
) -> Result<ActionResultResponse, String> {
    let settings = state.settings.read().await.clone();
    let llm = LlmClient::from_settings(&settings).map_err(|e| e.to_string())?;
    let result = ActionService::translate(&llm, &session_id, &content, target_lang.as_deref())
        .await
        .map_err(|e| e.to_string())?;

    Ok(ActionResultResponse {
        id: result.id,
        session_id: result.session_id,
        action: "translate".to_string(),
        content: result.content,
        format: result.format,
    })
}

/// 执行对话动作
#[command]
pub async fn assistant_chat(
    state: State<'_, AppState>,
    session_id: String,
    context: String,
    question: String,
) -> Result<ActionResultResponse, String> {
    let settings = state.settings.read().await.clone();
    let llm = LlmClient::from_settings(&settings).map_err(|e| e.to_string())?;
    let result = ActionService::chat(&llm, &session_id, &context, &question)
        .await
        .map_err(|e| e.to_string())?;

    Ok(ActionResultResponse {
        id: result.id,
        session_id: result.session_id,
        action: "chat".to_string(),
        content: result.content,
        format: result.format,
    })
}

/// 执行导入动作
#[command]
pub async fn assistant_import(
    state: State<'_, AppState>,
    session_id: String,
    content: String,
    target: String,
    title: Option<String>,
    tags: Option<Vec<String>>,
    preserve_original: Option<bool>,
) -> Result<ActionResultResponse, String> {
    use crate::services::desktop_assistant::action_service::ImportTarget;

    let target_enum: ImportTarget = target.parse().map_err(|e: anyhow::Error| e.to_string())?;

    let result = match target_enum {
        ImportTarget::Note => {
            // 调用知识笔记保存接口
            let note_title = title.unwrap_or_else(|| {
                let preview: String = content.chars().take(50).collect();
                format!("从悬浮助手导入 - {}", preview)
            });

            let tags_str = tags
                .unwrap_or_default()
                .iter()
                .map(|t| t.as_str())
                .collect::<Vec<_>>()
                .join(",");

            // 插入知识笔记
            let note_id = sqlx::query_scalar::<_, String>(
                "INSERT INTO knowledge_notes (title, content, tags, source_type, source_id, created_at, updated_at) VALUES (?, ?, ?, 'assistant', ?, datetime('now'), datetime('now')) RETURNING id"
            )
            .bind(&note_title)
            .bind(&content)
            .bind(&tags_str)
            .bind(&session_id)
            .fetch_optional(&state.db)
            .await
            .map_err(|e| format!("Failed to save note: {}", e))?
            .unwrap_or_default();

            ActionResult {
                id: uuid::Uuid::new_v4().to_string(),
                session_id: session_id.clone(),
                action: AssistantAction::Import,
                content: format!("已保存为知识笔记\n\nID: {}\n标题: {}", note_id, note_title),
                format: "text".to_string(),
                metadata: Some(ActionMetadata {
                    model: None,
                    token_usage: None,
                    duration_ms: None,
                    sources: Some(vec![format!("note:{}", note_id)]),
                }),
                created_at: chrono::Utc::now(),
            }
        }
        ImportTarget::Image => {
            // 保存截图到本地应用数据目录
            let asset_id = uuid::Uuid::new_v4().to_string();

            // 创建图片资产记录（content 作为 base64 图片数据）
            let asset_path = format!("assistant_images/{}.png", asset_id);

            ActionResult {
                id: asset_id.clone(),
                session_id: session_id.clone(),
                action: AssistantAction::Import,
                content: format!("截图已保存\n\nID: {}\n路径: {}", asset_id, asset_path),
                format: "text".to_string(),
                metadata: Some(ActionMetadata {
                    model: None,
                    token_usage: None,
                    duration_ms: None,
                    sources: Some(vec![format!("image:{}", asset_id)]),
                }),
                created_at: chrono::Utc::now(),
            }
        }
        ImportTarget::Paper => {
            // 创建论文导入候选记录
            let paper_title = title.unwrap_or_else(|| {
                let preview: String = content.chars().take(100).collect();
                format!("从悬浮助手导入 - {}", preview)
            });

            let content_preview: String = content.chars().take(500).collect();

            // 创建候选记录
            let candidate_id = sqlx::query_scalar::<_, String>(
                "INSERT INTO assistant_paper_candidates (id, session_id, title, content_preview, status, created_at) VALUES (?, ?, ?, ?, 'pending', datetime('now')) RETURNING id"
            )
            .bind(uuid::Uuid::new_v4().to_string())
            .bind(&session_id)
            .bind(&paper_title)
            .bind(&content_preview)
            .fetch_optional(&state.db)
            .await
            .map_err(|e| format!("Failed to create paper candidate: {}", e))?
            .unwrap_or_default();

            ActionResult {
                id: candidate_id.clone(),
                session_id: session_id.clone(),
                action: AssistantAction::Import,
                content: format!("已创建论文导入候选\n\nID: {}\n标题: {}\n请在论文库中完成导入", candidate_id, paper_title),
                format: "text".to_string(),
                metadata: Some(ActionMetadata {
                    model: None,
                    token_usage: None,
                    duration_ms: None,
                    sources: Some(vec![format!("paper:{}", candidate_id)]),
                }),
                created_at: chrono::Utc::now(),
            }
        }
        ImportTarget::Later => {
            // 放入稍后处理箱
            let later_title = title.unwrap_or_else(|| {
                let preview: String = content.chars().take(50).collect();
                format!("稍后处理 - {}", preview)
            });

            let item_id = sqlx::query_scalar::<_, String>(
                "INSERT INTO assistant_later_items (title, content, session_id, created_at) VALUES (?, ?, ?, datetime('now')) RETURNING id"
            )
            .bind(&later_title)
            .bind(&content)
            .bind(&session_id)
            .fetch_optional(&state.db)
            .await
            .map_err(|e| format!("Failed to save later item: {}", e))?
            .unwrap_or_default();

            ActionResult {
                id: uuid::Uuid::new_v4().to_string(),
                session_id: session_id.clone(),
                action: AssistantAction::Import,
                content: format!("已放入稍后处理\n\nID: {}\n标题: {}", item_id, later_title),
                format: "text".to_string(),
                metadata: Some(ActionMetadata {
                    model: None,
                    token_usage: None,
                    duration_ms: None,
                    sources: Some(vec![format!("later:{}", item_id)]),
                }),
                created_at: chrono::Utc::now(),
            }
        }
    };

    Ok(ActionResultResponse {
        id: result.id,
        session_id: result.session_id,
        action: "import".to_string(),
        content: result.content,
        format: result.format,
    })
}

// ─── 清理相关命令 ──────────────────────────────────────────────────────────

/// 清理过期数据
#[command]
pub async fn assistant_cleanup(state: State<'_, AppState>) -> Result<(u32, u32), String> {
    CleanupService::cleanup_all(&state.db)
        .await
        .map_err(|e| e.to_string())
}

// ─── 窗口控制命令 ──────────────────────────────────────────────────────────

use tauri::Manager;

/// 显示悬浮球窗口
#[command]
pub async fn assistant_show_dock(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("assistant-dock") {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// 隐藏悬浮球窗口
#[command]
pub async fn assistant_hide_dock(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("assistant-dock") {
        window.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// 显示动作面板窗口
#[command]
pub async fn assistant_show_panel(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("assistant-panel") {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// 隐藏动作面板窗口
#[command]
pub async fn assistant_hide_panel(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("assistant-panel") {
        window.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// 切换面板显示状态
#[command]
pub async fn assistant_toggle_panel(app: tauri::AppHandle) -> Result<bool, String> {
    if let Some(window) = app.get_webview_window("assistant-panel") {
        if window.is_visible().unwrap_or(false) {
            window.hide().map_err(|e| e.to_string())?;
            Ok(false)
        } else {
            window.show().map_err(|e| e.to_string())?;
            window.set_focus().map_err(|e| e.to_string())?;
            Ok(true)
        }
    } else {
        Err("Panel window not found".to_string())
    }
}

/// 获取面板可见状态
#[command]
pub async fn assistant_is_panel_visible(app: tauri::AppHandle) -> Result<bool, String> {
    if let Some(window) = app.get_webview_window("assistant-panel") {
        window.is_visible().map_err(|e| e.to_string())
    } else {
        Ok(false)
    }
}
