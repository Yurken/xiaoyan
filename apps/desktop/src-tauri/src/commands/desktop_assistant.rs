//! 桌面助手命令模块
//!
//! 参数校验后委托 service，禁止承载业务逻辑

use serde::{Deserialize, Serialize};
use tauri::command;

use crate::services::desktop_assistant::{
    ActionService, CaptureService, CleanupService, PermissionService,
};

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

/// 获取选中文本
#[command]
pub async fn assistant_get_selection() -> Result<Option<String>, String> {
    CaptureService::get_selection()
        .await
        .map_err(|e| e.to_string())
}

/// 获取剪贴板内容
#[command]
pub async fn assistant_get_clipboard() -> Result<Option<String>, String> {
    CaptureService::get_clipboard()
        .await
        .map_err(|e| e.to_string())
}

/// 截取屏幕区域
#[command]
pub async fn assistant_capture_screen(
    x: i32,
    y: i32,
    width: u32,
    height: u32,
) -> Result<Vec<u8>, String> {
    // TODO: 实现截图
    Ok(Vec::new())
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
    content: String,
    question: Option<String>,
) -> Result<ActionResultResponse, String> {
    // TODO: 实现解读
    Ok(ActionResultResponse {
        id: "placeholder".to_string(),
        session_id: "placeholder".to_string(),
        action: "interpret".to_string(),
        content: "解读结果占位符".to_string(),
        format: "text".to_string(),
    })
}

/// 执行翻译动作
#[command]
pub async fn assistant_translate(
    content: String,
    target_lang: Option<String>,
) -> Result<ActionResultResponse, String> {
    // TODO: 实现翻译
    Ok(ActionResultResponse {
        id: "placeholder".to_string(),
        session_id: "placeholder".to_string(),
        action: "translate".to_string(),
        content: "翻译结果占位符".to_string(),
        format: "text".to_string(),
    })
}

/// 执行对话动作
#[command]
pub async fn assistant_chat(
    content: String,
    question: String,
) -> Result<ActionResultResponse, String> {
    // TODO: 实现对话
    Ok(ActionResultResponse {
        id: "placeholder".to_string(),
        session_id: "placeholder".to_string(),
        action: "chat".to_string(),
        content: "对话结果占位符".to_string(),
        format: "text".to_string(),
    })
}

/// 执行导入动作
#[command]
pub async fn assistant_import(
    content: String,
    target: String,
    metadata: Option<String>,
) -> Result<ActionResultResponse, String> {
    // TODO: 实现导入
    Ok(ActionResultResponse {
        id: "placeholder".to_string(),
        session_id: "placeholder".to_string(),
        action: "import".to_string(),
        content: "导入成功".to_string(),
        format: "text".to_string(),
    })
}

// ─── 清理相关命令 ──────────────────────────────────────────────────────────

/// 清理过期数据
#[command]
pub async fn assistant_cleanup() -> Result<(u32, u32), String> {
    CleanupService::cleanup_all()
        .await
        .map_err(|e| e.to_string())
}
