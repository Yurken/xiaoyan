//! 采集会话服务
//!
//! 管理一次性采集会话、预览、重试、取消

use anyhow::Result;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

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
        // TODO: 实现 macOS 辅助功能选区读取
        // - 获取前台应用
        // - 通过 AXUIElement 读取选中文本
        Ok(None)
    }

    /// 获取剪贴板内容
    pub async fn get_clipboard() -> Result<Option<String>> {
        // TODO: 实现剪贴板读取
        Ok(None)
    }

    /// 截取屏幕区域
    pub async fn capture_screen_region(
        _x: i32,
        _y: i32,
        _width: u32,
        _height: u32,
    ) -> Result<Option<String>> {
        // TODO: 实现 ScreenCaptureKit 区域截图
        Ok(None)
    }

    /// 获取前台应用信息
    pub async fn get_frontmost_app() -> Result<(Option<String>, Option<String>, Option<String>)> {
        // TODO: 实现前台应用信息获取
        // 返回 (app_name, bundle_id, window_title)
        Ok((None, None, None))
    }
}
