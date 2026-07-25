//! 采集会话服务
//!
//! 管理一次性采集会话、预览、重试、取消
//! 集成隐私检查：在获取上下文后进行隐私验证

use anyhow::{anyhow, Result};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::platform::desktop_assistant::get_platform_adapter;
use super::permission_service::{PermissionService, PrivacyCheckResult};

/// 上下文来源类型
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ContextSourceType {
    Selection,
    Clipboard,
    Screenshot,
    Paste,
}

/// 采集状态
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CaptureStatus {
    Idle,
    Capturing,
    Ready,
    Processing,
    Error,
    Blocked,
}

/// 采集会话
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaptureSession {
    pub id: String,
    pub source_type: ContextSourceType,
    pub content: Option<String>,
    pub screenshot_path: Option<String>,
    pub source_app: Option<String>,
    pub source_app_bundle_id: Option<String>,
    pub window_title: Option<String>,
    pub created_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub status: CaptureStatus,
    pub user_confirmed: bool,
    /// 隐私检查结果（如果被阻止）
    pub privacy_check: Option<PrivacyCheckResult>,
}

/// 采集结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaptureResult {
    pub session: CaptureSession,
    pub sanitized_content: Option<String>,
}

/// 采集服务
pub struct CaptureService;

impl CaptureService {
    /// 创建新的采集会话
    pub fn create_session(source_type: ContextSourceType, retain_hours: i64) -> CaptureSession {
        let now = Utc::now();
        CaptureSession {
            id: Uuid::new_v4().to_string(),
            source_type,
            content: None,
            screenshot_path: None,
            source_app: None,
            source_app_bundle_id: None,
            window_title: None,
            created_at: now,
            expires_at: now + chrono::Duration::hours(retain_hours),
            status: CaptureStatus::Capturing,
            user_confirmed: false,
            privacy_check: None,
        }
    }

    /// 获取上下文并执行隐私检查
    pub async fn get_context(
        source_type: &ContextSourceType,
        blocked_apps: &[String],
    ) -> Result<CaptureResult> {
        let adapter = get_platform_adapter();

        // 获取前台应用信息
        let frontmost_app = adapter.get_frontmost_app()?;
        let bundle_id = frontmost_app.bundle_id.clone();
        let window_title = frontmost_app.window_title.clone();

        // 根据来源类型获取内容
        let mut session = Self::create_session(source_type.clone(), 24);
        session.source_app = frontmost_app.name;
        session.source_app_bundle_id = bundle_id.clone();
        session.window_title = window_title.clone();

        let content = match source_type {
            ContextSourceType::Selection => adapter.get_selection()?,
            ContextSourceType::Clipboard => Self::get_clipboard_content().await?,
            ContextSourceType::Screenshot => {
                // 截图需要先检查屏幕录制权限
                if !adapter.check_screen_recording_permission() {
                    return Err(anyhow!("需要屏幕录制权限才能截图"));
                }
                None // 截图内容在前端处理
            }
            ContextSourceType::Paste => None, // 粘贴模式由用户提供
        };

        session.content = content.clone();

        // 执行隐私检查
        let privacy_check = PermissionService::check_privacy(
            bundle_id.as_deref(),
            window_title.as_deref(),
            content.as_deref(),
            blocked_apps,
        );

        if !privacy_check.allowed {
            session.status = CaptureStatus::Blocked;
            session.privacy_check = Some(privacy_check.clone());
            return Ok(CaptureResult {
                session,
                sanitized_content: None,
            });
        }

        // 如果通过隐私检查，对内容进行脱敏处理
        let sanitized_content = content.map(|c| PermissionService::sanitize_content(&c));
        session.status = CaptureStatus::Ready;

        Ok(CaptureResult {
            session,
            sanitized_content,
        })
    }

    /// 获取剪贴板内容
    async fn get_clipboard_content() -> Result<Option<String>> {
        // 使用 pbpaste 命令读取剪贴板
        let output = std::process::Command::new("pbpaste")
            .output()
            .map_err(|e| anyhow!("Failed to run pbpaste: {}", e))?;

        if output.status.success() {
            let text = String::from_utf8_lossy(&output.stdout).to_string();
            if !text.is_empty() {
                return Ok(Some(text));
            }
        }

        Ok(None)
    }

    /// 截取屏幕区域
    pub async fn capture_screen_region(
        x: i32,
        y: i32,
        width: u32,
        height: u32,
    ) -> Result<Vec<u8>> {
        let adapter = get_platform_adapter();
        adapter.capture_screen_region(x, y, width, height)
    }

    /// 获取前台应用信息
    pub async fn get_frontmost_app() -> Result<(Option<String>, Option<String>, Option<String>)> {
        let adapter = get_platform_adapter();
        let app = adapter.get_frontmost_app()?;
        Ok((app.name, app.bundle_id, app.window_title))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_session() {
        let session = CaptureService::create_session(ContextSourceType::Selection, 24);
        assert_eq!(session.source_type, ContextSourceType::Selection);
        assert_eq!(session.status, CaptureStatus::Capturing);
        assert!(session.content.is_none());
        assert!(session.privacy_check.is_none());
    }
}
