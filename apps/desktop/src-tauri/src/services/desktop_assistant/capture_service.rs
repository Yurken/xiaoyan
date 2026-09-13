//! 采集会话服务
//!
//! 管理一次性采集会话、预览、重试、取消
//! 集成隐私检查：在获取上下文后进行隐私验证

use anyhow::{anyhow, Result};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::content_policy::{limit_text_chars, retained_window_title, MAX_CAPTURE_TEXT_CHARS};
use super::permission_service::{PermissionService, PrivacyCheckResult};
use crate::platform::desktop_assistant::get_platform_adapter;
use crate::platform::desktop_assistant::trait_platform::FrontmostApp;
use crate::platform::desktop_assistant::trait_platform::{
    CaptureRegionRequest, CapturedScreenshot, ScreenshotRegion,
};

/// 上下文来源类型
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ContextSourceType {
    Selection,
    Clipboard,
    Screenshot,
    Paste,
}

impl ContextSourceType {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Selection => "selection",
            Self::Clipboard => "clipboard",
            Self::Screenshot => "screenshot",
            Self::Paste => "paste",
        }
    }
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

impl CaptureStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Idle => "idle",
            Self::Capturing => "capturing",
            Self::Ready => "ready",
            Self::Processing => "processing",
            Self::Error => "error",
            Self::Blocked => "blocked",
        }
    }
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
    pub capture_region: Option<ScreenshotRegion>,
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
    pub original_character_count: Option<usize>,
    pub content_truncated: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaptureConfirmationDecision {
    pub confirmed: bool,
    pub content: Option<String>,
    pub reason: Option<String>,
    pub privacy_check: PrivacyCheckResult,
}

/// 采集服务
pub struct CaptureService;

impl CaptureService {
    pub fn prepare_confirmation(content: &str) -> CaptureConfirmationDecision {
        let privacy_check = PermissionService::check_privacy(None, None, Some(content), &[], &[]);
        if !privacy_check.allowed {
            return CaptureConfirmationDecision {
                confirmed: false,
                content: None,
                reason: privacy_check.reason.clone(),
                privacy_check,
            };
        }
        let sanitized = PermissionService::sanitize_content(content);
        if privacy_check.content_redacted && sanitized != content {
            return CaptureConfirmationDecision {
                confirmed: false,
                content: Some(sanitized),
                reason: None,
                privacy_check,
            };
        }
        CaptureConfirmationDecision {
            confirmed: true,
            content: Some(content.to_string()),
            reason: None,
            privacy_check,
        }
    }

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
            capture_region: None,
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
        allowed_apps: &[String],
        blocked_apps: &[String],
        window_title_enabled: bool,
    ) -> Result<CaptureResult> {
        let adapter = get_platform_adapter();

        // 获取前台应用信息
        let frontmost_app = match adapter.get_frontmost_app() {
            Ok(app) => app,
            Err(_)
                if matches!(
                    source_type,
                    ContextSourceType::Clipboard | ContextSourceType::Paste
                ) =>
            {
                // 剪贴板和手动粘贴是用户显式提供的降级路径，不应被辅助功能权限阻断。
                FrontmostApp {
                    name: None,
                    bundle_id: None,
                    window_title: None,
                }
            }
            Err(error) => return Err(error),
        };
        let bundle_id = frontmost_app.bundle_id.clone();
        let window_title = frontmost_app.window_title.clone();

        let mut session = Self::create_session(source_type.clone(), 24);
        session.source_app = frontmost_app.name;
        session.source_app_bundle_id = bundle_id.clone();
        session.window_title = retained_window_title(window_title_enabled, window_title.as_deref());

        // 应用与窗口规则必须在读取选区或剪贴板之前执行，禁止路径不接触正文。
        let preflight = PermissionService::check_privacy(
            bundle_id.as_deref(),
            window_title.as_deref(),
            None,
            allowed_apps,
            blocked_apps,
        );
        if !preflight.allowed {
            session.status = CaptureStatus::Blocked;
            session.privacy_check = Some(preflight.clone());
            session.window_title = None;
            return Ok(CaptureResult {
                session,
                sanitized_content: None,
                original_character_count: None,
                content_truncated: false,
            });
        }

        // 根据来源类型获取内容
        let raw_content = match source_type {
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
        let (content, original_character_count, content_truncated) =
            if let Some(raw_content) = raw_content {
                let limited = limit_text_chars(&raw_content, MAX_CAPTURE_TEXT_CHARS);
                (
                    Some(limited.content),
                    Some(limited.original_chars),
                    limited.truncated,
                )
            } else {
                (None, None, false)
            };

        session.content = content.clone();

        // 执行隐私检查
        let privacy_check = PermissionService::check_privacy(
            bundle_id.as_deref(),
            window_title.as_deref(),
            content.as_deref(),
            allowed_apps,
            blocked_apps,
        );

        if !privacy_check.allowed {
            session.status = CaptureStatus::Blocked;
            session.privacy_check = Some(privacy_check.clone());
            session.content = None;
            session.window_title = None;
            return Ok(CaptureResult {
                session,
                sanitized_content: None,
                original_character_count,
                content_truncated,
            });
        }

        // 如果通过隐私检查，对内容进行脱敏处理
        let sanitized_content = content.map(|c| PermissionService::sanitize_content(&c));
        session.status = CaptureStatus::Ready;

        Ok(CaptureResult {
            session,
            sanitized_content,
            original_character_count,
            content_truncated,
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

    /// 调用系统交互式区域选择。
    pub async fn capture_screen_interactive() -> Result<CapturedScreenshot> {
        tokio::task::spawn_blocking(|| {
            let adapter = get_platform_adapter();
            if !adapter.check_screen_recording_permission() {
                return Err(anyhow!("需要屏幕录制权限才能截图"));
            }
            adapter.capture_screen_interactive()
        })
        .await
        .map_err(|error| anyhow!("截图任务失败: {}", error))?
    }

    /// 按跨显示器选区层回传的全局逻辑选区截图，坐标随结果返回。
    pub async fn capture_screen_region(region: CaptureRegionRequest) -> Result<CapturedScreenshot> {
        tokio::task::spawn_blocking(move || {
            let adapter = get_platform_adapter();
            if !adapter.check_screen_recording_permission() {
                return Err(anyhow!("需要屏幕录制权限才能截图"));
            }
            adapter.capture_screen_region(&region)
        })
        .await
        .map_err(|error| anyhow!("截图任务失败: {}", error))?
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

    #[test]
    fn confirmation_blocks_passwords_and_requires_redacted_pii_to_be_confirmed_again() {
        let blocked = CaptureService::prepare_confirmation("password: correct-horse");
        assert!(!blocked.confirmed);
        assert!(blocked.content.is_none());
        assert!(blocked.privacy_check.content_sensitive);

        let redacted = CaptureService::prepare_confirmation("联系 me@example.com");
        assert!(!redacted.confirmed);
        assert_eq!(redacted.content.as_deref(), Some("联系 [EMAIL]"));
        assert_eq!(redacted.privacy_check.redaction_kinds, vec!["邮箱"]);

        let safe = CaptureService::prepare_confirmation("联系 [EMAIL]");
        assert!(safe.confirmed);
    }
}
