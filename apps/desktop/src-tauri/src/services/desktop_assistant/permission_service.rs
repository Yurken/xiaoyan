//! 权限检查服务
//!
//! 管理辅助功能、屏幕录制等系统权限
//! 实现隐私安全策略：禁止应用、敏感字段检测

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

/// 隐私检查结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrivacyCheckResult {
    /// 是否允许采集
    pub allowed: bool,
    /// 原因（不允许时）
    pub reason: Option<String>,
    /// 应用是否在禁止列表
    pub app_blocked: bool,
    /// 窗口标题是否包含敏感关键词
    pub window_blocked: bool,
    /// 内容是否包含敏感字段
    pub content_sensitive: bool,
}

/// 默认禁止采集的应用
const DEFAULT_BLOCKED_APPS: &[&str] = &[
    // 密码管理器
    "com.1password.1password",
    "com.agilebits.onepassword7",
    "com.agilebits.onepassword",
    "com.bitwarden.desktop",
    "com.keepersecurity.keeper",
    // 系统安全
    "com.apple.Keychain",
    "com.apple.securityagent",
    "com.apple.loginwindow",
    // 金融应用
    "com.alipay.mac",
    "com.tencent.macWeChat",
    // DRM
    "com.apple.TV",
    "com.apple.iTunes",
];

/// 禁止采集的窗口标题关键词
const BLOCKED_WINDOW_KEYWORDS: &[&str] = &[
    "密码", "password", "登录", "login", "sign in",
    "认证", "auth", "支付", "payment", "银行", "bank",
];

/// 敏感字段检测模式
const SENSITIVE_FIELD_PATTERNS: &[&str] = &[
    "password", "passwd", "secret", "token",
    "api_key", "apikey", "access_key", "private_key",
];

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
    pub fn is_app_blocked(bundle_id: &str, custom_blocked: &[String]) -> bool {
        // 检查默认禁止列表
        let default_blocked = DEFAULT_BLOCKED_APPS.iter().any(|blocked| {
            bundle_id.to_lowercase().contains(&blocked.to_lowercase())
        });

        // 检查用户自定义禁止列表
        let custom_blocked = custom_blocked.iter().any(|blocked| {
            bundle_id.to_lowercase().contains(&blocked.to_lowercase())
        });

        default_blocked || custom_blocked
    }

    /// 检查窗口标题是否包含敏感关键词
    pub fn is_window_blocked(window_title: &str) -> bool {
        let lower_title = window_title.to_lowercase();
        BLOCKED_WINDOW_KEYWORDS.iter().any(|keyword| {
            lower_title.contains(&keyword.to_lowercase())
        })
    }

    /// 检测内容是否包含敏感字段
    pub fn contains_sensitive_fields(content: &str) -> bool {
        let lower_content = content.to_lowercase();
        SENSITIVE_FIELD_PATTERNS.iter().any(|pattern| {
            lower_content.contains(&pattern.to_lowercase())
        })
    }

    /// 隐私检查：综合判断是否允许采集
    pub fn check_privacy(
        bundle_id: Option<&str>,
        window_title: Option<&str>,
        content: Option<&str>,
        blocked_apps: &[String],
    ) -> PrivacyCheckResult {
        // 检查应用
        let app_blocked = match bundle_id {
            Some(id) => Self::is_app_blocked(id, blocked_apps),
            None => false,
        };

        // 检查窗口标题
        let window_blocked = match window_title {
            Some(title) => Self::is_window_blocked(title),
            None => false,
        };

        // 检查内容
        let content_sensitive = match content {
            Some(c) => Self::contains_sensitive_fields(c),
            None => false,
        };

        // 确定是否允许
        let allowed = !app_blocked && !window_blocked && !content_sensitive;

        // 生成原因
        let reason = if app_blocked {
            Some("应用在禁止列表中".to_string())
        } else if window_blocked {
            Some("窗口标题包含敏感关键词".to_string())
        } else if content_sensitive {
            Some("内容包含敏感字段".to_string())
        } else {
            None
        };

        PrivacyCheckResult {
            allowed,
            reason,
            app_blocked,
            window_blocked,
            content_sensitive,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_app_blocked() {
        assert!(PermissionService::is_app_blocked(
            "com.1password.1password",
            &[]
        ));
        assert!(PermissionService::is_app_blocked(
            "com.apple.Keychain",
            &[]
        ));
        assert!(!PermissionService::is_app_blocked(
            "com.apple.Safari",
            &[]
        ));

        // 自定义列表
        assert!(PermissionService::is_app_blocked(
            "com.custom.blocked",
            &["com.custom.blocked".to_string()]
        ));
    }

    #[test]
    fn test_is_window_blocked() {
        assert!(PermissionService::is_window_blocked("输入密码"));
        assert!(PermissionService::is_window_blocked("Login Page"));
        assert!(!PermissionService::is_window_blocked("Google Search"));
    }

    #[test]
    fn test_contains_sensitive_fields() {
        assert!(PermissionService::contains_sensitive_fields(
            "password: 123456"
        ));
        assert!(PermissionService::contains_sensitive_fields(
            "api_key=abc123"
        ));
        assert!(!PermissionService::contains_sensitive_fields(
            "Hello World"
        ));
    }

    #[test]
    fn test_check_privacy() {
        // 正常内容
        let result = PermissionService::check_privacy(
            Some("com.apple.Safari"),
            Some("Google"),
            Some("Hello World"),
            &[],
        );
        assert!(result.allowed);

        // 禁止的应用
        let result = PermissionService::check_privacy(
            Some("com.1password.1password"),
            Some("1Password"),
            None,
            &[],
        );
        assert!(!result.allowed);
        assert!(result.app_blocked);

        // 敏感窗口
        let result = PermissionService::check_privacy(
            Some("com.apple.Safari"),
            Some("密码输入"),
            None,
            &[],
        );
        assert!(!result.allowed);
        assert!(result.window_blocked);
    }
}
