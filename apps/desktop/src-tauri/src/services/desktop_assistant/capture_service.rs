//! 采集会话服务
//!
//! 管理一次性采集会话、预览、重试、取消

use anyhow::Result;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::platform::desktop_assistant::{get_platform_adapter, PlatformAdapter};

/// 上下文来源类型
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ContextSourceType {
    Selection,
    Clipboard,
    Screenshot,
    Paste,
}

/// 采集状态
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CaptureStatus {
    Idle,
    Capturing,
    Ready,
    Processing,
    Error,
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
        }
    }

    /// 获取选中文本
    pub async fn get_selection() -> Result<Option<String>> {
        let adapter = get_platform_adapter();
        adapter.get_selection()
    }

    /// 获取剪贴板内容
    pub async fn get_clipboard() -> Result<Option<String>> {
        // TODO: 实现剪贴板读取
        // 可以使用 arboard crate 或 Tauri 的 clipboard 插件
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
