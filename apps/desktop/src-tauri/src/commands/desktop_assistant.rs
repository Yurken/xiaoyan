//! 桌面助手命令模块
//!
//! 参数校验后委托 service，禁止承载业务逻辑

use base64::Engine;
use serde::{Deserialize, Serialize};
use tauri::{command, State};

use crate::llm::LlmClient;
use crate::services::desktop_assistant::action_service::ActionService;
use crate::services::desktop_assistant::import_service::ImportService;
use crate::services::desktop_assistant::{CaptureService, CleanupService, PermissionService};
use crate::state::AppState;

/// 权限状态
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PermissionStatusResponse {
    pub accessibility: bool,
    pub screen_recording: bool,
    pub clipboard: bool,
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
    pub privacy_check:
        Option<crate::services::desktop_assistant::permission_service::PrivacyCheckResult>,
}

impl From<crate::services::desktop_assistant::capture_service::CaptureStatus> for String {
    fn from(status: crate::services::desktop_assistant::capture_service::CaptureStatus) -> Self {
        match status {
            crate::services::desktop_assistant::capture_service::CaptureStatus::Idle => {
                "idle".to_string()
            }
            crate::services::desktop_assistant::capture_service::CaptureStatus::Capturing => {
                "capturing".to_string()
            }
            crate::services::desktop_assistant::capture_service::CaptureStatus::Ready => {
                "ready".to_string()
            }
            crate::services::desktop_assistant::capture_service::CaptureStatus::Processing => {
                "processing".to_string()
            }
            crate::services::desktop_assistant::capture_service::CaptureStatus::Error => {
                "error".to_string()
            }
            crate::services::desktop_assistant::capture_service::CaptureStatus::Blocked => {
                "blocked".to_string()
            }
        }
    }
}

fn status_to_string(
    status: crate::services::desktop_assistant::capture_service::CaptureStatus,
) -> String {
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
pub async fn assistant_get_selection(
    state: State<'_, AppState>,
) -> Result<CaptureContextResponse, String> {
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
pub async fn assistant_get_clipboard(
    state: State<'_, AppState>,
) -> Result<CaptureContextResponse, String> {
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
    state: State<'_, AppState>,
    app: tauri::AppHandle,
) -> Result<CaptureContextResponse, String> {
    let settings = state.settings.read().await.clone();
    let blocked_apps: Vec<String> = settings
        .get("assistant_blocked_apps")
        .map(|value| {
            value
                .split(',')
                .map(|item| item.trim().to_string())
                .collect()
        })
        .unwrap_or_default();
    let (source_app, source_app_bundle_id, window_title) = CaptureService::get_frontmost_app()
        .await
        .map_err(|e| e.to_string())?;
    let privacy_check = PermissionService::check_privacy(
        source_app_bundle_id.as_deref(),
        window_title.as_deref(),
        None,
        &blocked_apps,
    );

    if !privacy_check.allowed {
        return Ok(CaptureContextResponse {
            session_id: uuid::Uuid::new_v4().to_string(),
            content: None,
            sanitized_content: None,
            source_app,
            source_app_bundle_id,
            window_title,
            status: "blocked".to_string(),
            privacy_check: Some(privacy_check),
        });
    }

    if let Some(panel) = app.get_webview_window("assistant-panel") {
        let _ = panel.hide();
    }
    let capture = CaptureService::capture_screen_interactive().await;
    let _ = crate::desktop_shell::show_assistant_panel(&app, false);
    let bytes = capture.map_err(|e| e.to_string())?;
    if bytes.len() > 20 * 1024 * 1024 {
        return Err("截图超过 20 MB，请缩小选择区域后重试".to_string());
    }
    let data_url = format!(
        "data:image/png;base64,{}",
        base64::engine::general_purpose::STANDARD.encode(bytes)
    );

    Ok(CaptureContextResponse {
        session_id: uuid::Uuid::new_v4().to_string(),
        content: Some(data_url),
        sanitized_content: None,
        source_app,
        source_app_bundle_id,
        window_title,
        status: "ready".to_string(),
        privacy_check: Some(privacy_check),
    })
}

/// 获取前台应用信息
#[command]
pub async fn assistant_get_frontmost_app(
) -> Result<(Option<String>, Option<String>, Option<String>), String> {
    CaptureService::get_frontmost_app()
        .await
        .map_err(|e| e.to_string())
}

// ─── 动作相关命令 ──────────────────────────────────────────────────────────

fn assistant_action_client(
    settings: &std::collections::HashMap<String, String>,
    content: &str,
) -> Result<(LlmClient, Option<String>), String> {
    if content.starts_with("data:image/") {
        return LlmClient::vision_client_from_settings(settings).ok_or_else(|| {
            "截图操作需要视觉模型，请先在「设置 → 模型角色 → 视界·视觉」中完成配置。".to_string()
        });
    }
    LlmClient::from_settings(settings)
        .map(|client| (client, None))
        .map_err(|e| e.to_string())
}

/// 执行解读动作
#[command]
pub async fn assistant_interpret(
    state: State<'_, AppState>,
    session_id: String,
    content: String,
    question: Option<String>,
) -> Result<ActionResultResponse, String> {
    let settings = state.settings.read().await.clone();
    let (llm, model) = assistant_action_client(&settings, &content)?;
    let result = ActionService::interpret(
        &llm,
        model.as_deref(),
        &session_id,
        &content,
        question.as_deref(),
    )
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
    let (llm, model) = assistant_action_client(&settings, &content)?;
    let result = ActionService::translate(
        &llm,
        model.as_deref(),
        &session_id,
        &content,
        target_lang.as_deref(),
    )
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
    let (llm, model) = assistant_action_client(&settings, &context)?;
    let result = ActionService::chat(&llm, model.as_deref(), &session_id, &context, &question)
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
    app: tauri::AppHandle,
    session_id: String,
    content: String,
    target: String,
    title: Option<String>,
    tags: Option<Vec<String>>,
) -> Result<ActionResultResponse, String> {
    // 获取应用数据目录
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;

    let result = ImportService::import(
        &state.db,
        &app_data_dir,
        &session_id,
        &content,
        &target,
        title.as_deref(),
        tags.as_deref(),
    )
    .await
    .map_err(|e| e.to_string())?;

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
    crate::desktop_shell::set_assistant_dock_visible(&app, true)
}

/// 隐藏悬浮球窗口
#[command]
pub async fn assistant_hide_dock(app: tauri::AppHandle) -> Result<(), String> {
    crate::desktop_shell::set_assistant_dock_visible(&app, false)
}

/// 显示动作面板窗口
#[command]
pub async fn assistant_show_panel(app: tauri::AppHandle) -> Result<(), String> {
    crate::desktop_shell::show_assistant_panel(&app, true)
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
    crate::desktop_shell::toggle_assistant_panel(&app)
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

/// 获取悬浮小妍可见状态
#[command]
pub async fn assistant_is_dock_visible(app: tauri::AppHandle) -> Result<bool, String> {
    if let Some(window) = app.get_webview_window("assistant-dock") {
        window.is_visible().map_err(|e| e.to_string())
    } else {
        Ok(false)
    }
}
