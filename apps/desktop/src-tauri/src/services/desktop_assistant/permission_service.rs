//! 权限检查服务
//!
//! 管理辅助功能、屏幕录制等系统权限

use anyhow::Result;
use serde::{Deserialize, Serialize};

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
        // TODO: 实现 macOS 权限检查
        // - Accessibility: AXIsProcessTrusted()
        // - Screen Recording: CGPreflightScreenCaptureAccess()

        Ok(PermissionStatus {
            accessibility: false,
            screen_recording: false,
            clipboard: true, // 剪贴板始终可用
        })
    }

    /// 请求辅助功能权限
    pub async fn request_accessibility() -> Result<bool> {
        // TODO: 实现 macOS 辅助功能权限请求
        // AXIsProcessTrustedWithOptions(kAXTrustedCheckOptionPrompt: true)
        Ok(false)
    }

    /// 请求屏幕录制权限
    pub async fn request_screen_recording() -> Result<bool> {
        // TODO: 实现 macOS 屏幕录制权限请求
        // CGRequestScreenCaptureAccess()
        Ok(false)
    }

    /// 检查应用是否在禁止列表中
    pub fn is_app_blocked(bundle_id: &str, blocked_apps: &[String]) -> bool {
        blocked_apps
            .iter()
            .any(|blocked| bundle_id.to_lowercase().contains(&blocked.to_lowercase()))
    }
}
