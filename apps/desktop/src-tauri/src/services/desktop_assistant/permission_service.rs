//! 权限检查服务
//!
//! 管理辅助功能、屏幕录制等系统权限

use anyhow::Result;
use serde::{Deserialize, Serialize};

use crate::platform::desktop_assistant::{get_platform_adapter, PlatformAdapter};

/// 权限状态
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PermissionStatus {
    /// 辅助功能权限
    pub accessibility: bool,
    /// 屏幕录制权限
    pub screen_recording: bool,
    /// 剪贴板权限（始终可用）
    pub clipboard: bool,
}

/// 权限服务
pub struct PermissionService;

impl PermissionService {
    /// 检查所有权限状态
    pub async fn check_permissions() -> Result<PermissionStatus> {
        let adapter = get_platform_adapter();

        Ok(PermissionStatus {
            accessibility: adapter.check_accessibility_permission(),
            screen_recording: adapter.check_screen_recording_permission(),
            clipboard: true, // 剪贴板始终可用
        })
    }

    /// 请求辅助功能权限
    pub async fn request_accessibility() -> Result<bool> {
        let adapter = get_platform_adapter();
        Ok(adapter.request_accessibility_permission())
    }

    /// 请求屏幕录制权限
    pub async fn request_screen_recording() -> Result<bool> {
        let adapter = get_platform_adapter();
        Ok(adapter.request_screen_recording_permission())
    }

    /// 检查应用是否在禁止列表中
    pub fn is_app_blocked(bundle_id: &str, blocked_apps: &[String]) -> bool {
        blocked_apps
            .iter()
            .any(|blocked| bundle_id.to_lowercase().contains(&blocked.to_lowercase()))
    }
}
