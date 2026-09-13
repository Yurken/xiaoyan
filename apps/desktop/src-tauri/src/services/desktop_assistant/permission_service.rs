//! 权限检查服务
//!
//! 管理辅助功能、屏幕录制等系统权限
//! 实现隐私安全策略：禁止应用、敏感字段检测

use anyhow::Result;
use serde::{Deserialize, Serialize};

use crate::platform::desktop_assistant::get_platform_adapter;

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
    /// 应用不在用户启用的允许列表
    pub app_not_allowed: bool,
    /// 窗口标题是否包含敏感关键词
    pub window_blocked: bool,
    /// 内容是否包含敏感字段
    pub content_sensitive: bool,
    /// 内容是否包含已默认遮盖、需额外确认的疑似敏感片段
    pub content_redacted: bool,
    /// 仅暴露类别，不暴露命中的原始内容
    pub redaction_kinds: Vec<String>,
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
    "密码", "password", "登录", "login", "sign in", "认证", "auth", "支付", "payment", "银行",
    "bank",
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
        let default_blocked = DEFAULT_BLOCKED_APPS
            .iter()
            .any(|blocked| bundle_id.eq_ignore_ascii_case(blocked));

        // 检查用户自定义禁止列表
        let custom_blocked = custom_blocked
            .iter()
            .any(|blocked| bundle_id.eq_ignore_ascii_case(blocked));

        default_blocked || custom_blocked
    }

    /// 允许列表为空时不限制应用；启用后仅允许精确匹配的 bundle ID。
    pub fn is_app_allowed(bundle_id: &str, allowed_apps: &[String]) -> bool {
        allowed_apps.is_empty()
            || allowed_apps
                .iter()
                .any(|allowed| bundle_id.eq_ignore_ascii_case(allowed))
    }

    /// 检查窗口标题是否包含敏感关键词
    pub fn is_window_blocked(window_title: &str) -> bool {
        let lower_title = window_title.to_lowercase();
        BLOCKED_WINDOW_KEYWORDS
            .iter()
            .any(|keyword| lower_title.contains(&keyword.to_lowercase()))
    }

    /// 检测内容是否包含敏感字段
    pub fn contains_sensitive_fields(content: &str) -> bool {
        let credential = regex::Regex::new(r"(?i)(password|passwd)\s*[:=]\s*\S{4,}")
            .expect("valid credential regex");
        let private_key = regex::Regex::new(r"(?i)-----BEGIN [A-Z ]*PRIVATE KEY-----")
            .expect("valid private key regex");
        let bearer =
            regex::Regex::new(r"(?i)\bbearer\s+[a-z0-9._~+/=-]{8,}").expect("valid bearer regex");
        credential.is_match(content) || private_key.is_match(content) || bearer.is_match(content)
    }

    /// 隐私检查：综合判断是否允许采集
    pub fn check_privacy(
        bundle_id: Option<&str>,
        window_title: Option<&str>,
        content: Option<&str>,
        allowed_apps: &[String],
        blocked_apps: &[String],
    ) -> PrivacyCheckResult {
        // 检查应用
        let app_blocked = match bundle_id {
            Some(id) => Self::is_app_blocked(id, blocked_apps),
            None => false,
        };
        let app_not_allowed = match bundle_id {
            Some(id) => !Self::is_app_allowed(id, allowed_apps),
            // 剪贴板与手动粘贴在没有辅助功能权限时仍需可用。
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
        let redaction_kinds = content.map(Self::redaction_kinds).unwrap_or_default();
        let content_redacted = !redaction_kinds.is_empty();

        // 确定是否允许
        let allowed = !app_blocked && !app_not_allowed && !window_blocked && !content_sensitive;

        // 生成原因
        let reason = if app_blocked {
            Some("应用在禁止列表中".to_string())
        } else if app_not_allowed {
            Some("应用不在允许列表中".to_string())
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
            app_not_allowed,
            window_blocked,
            content_sensitive,
            content_redacted,
            redaction_kinds,
        }
    }

    pub fn redaction_kinds(content: &str) -> Vec<String> {
        let patterns = [
            ("邮箱", r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}"),
            ("手机号", r"(?:\+?86)?1[3-9]\d{9}"),
            ("银行卡号", r"\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b"),
            ("身份证号", r"\b\d{17}[\dXx]\b"),
            (
                "访问凭据",
                r"(?i)(?:api[_ -]?key|access[_ -]?key|secret|token)\s*[:=]\s*\S{4,}",
            ),
        ];
        patterns
            .into_iter()
            .filter_map(|(label, pattern)| {
                regex::Regex::new(pattern)
                    .expect("valid redaction regex")
                    .is_match(content)
                    .then(|| label.to_string())
            })
            .collect()
    }

    /// 脱敏处理：移除敏感内容
    pub fn sanitize_content(content: &str) -> String {
        let mut sanitized = content.to_string();

        // 移除邮箱地址
        let email_regex =
            regex::Regex::new(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}").unwrap();
        sanitized = email_regex.replace_all(&sanitized, "[EMAIL]").to_string();

        // 移除电话号码（中国大陆）
        let phone_regex = regex::Regex::new(r"(\+?86)?1[3-9]\d{9}").unwrap();
        sanitized = phone_regex.replace_all(&sanitized, "[PHONE]").to_string();

        // 移除信用卡号
        let card_regex = regex::Regex::new(r"\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}").unwrap();
        sanitized = card_regex.replace_all(&sanitized, "[CARD]").to_string();

        // 移除身份证号
        let id_regex = regex::Regex::new(r"\d{17}[\dXx]").unwrap();
        sanitized = id_regex.replace_all(&sanitized, "[ID]").to_string();

        // 移除 API Key 模式
        let api_key_regex =
            regex::Regex::new(r"(?i)(api[_ -]?key|access[_ -]?key|token|secret)\s*[=:]\s*\S+")
                .unwrap();
        sanitized = api_key_regex
            .replace_all(&sanitized, "$1=[REDACTED]")
            .to_string();

        sanitized
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
        assert!(PermissionService::is_app_blocked("com.apple.Keychain", &[]));
        assert!(!PermissionService::is_app_blocked("com.apple.Safari", &[]));

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
        assert!(!PermissionService::contains_sensitive_fields(
            "api_key=abc123"
        ));
        assert_eq!(
            PermissionService::redaction_kinds("api_key=abc123 and me@example.com"),
            vec!["邮箱".to_string(), "访问凭据".to_string()]
        );
        assert!(!PermissionService::contains_sensitive_fields("Hello World"));
        assert!(!PermissionService::contains_sensitive_fields(
            "The model uses 512 context tokens for inference"
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
            &[],
        );
        assert!(result.allowed);

        // 启用允许列表后，未列出的应用不可采集。
        let result = PermissionService::check_privacy(
            Some("com.apple.Safari"),
            Some("Google"),
            None,
            &["com.microsoft.VSCode".to_string()],
            &[],
        );
        assert!(!result.allowed);
        assert!(result.app_not_allowed);

        // 禁止的应用
        let result = PermissionService::check_privacy(
            Some("com.1password.1password"),
            Some("1Password"),
            None,
            &["com.1password.1password".to_string()],
            &[],
        );
        assert!(!result.allowed);
        assert!(result.app_blocked);
        assert!(!result.app_not_allowed);

        // 敏感窗口
        let result = PermissionService::check_privacy(
            Some("com.apple.Safari"),
            Some("密码输入"),
            None,
            &[],
            &[],
        );
        assert!(!result.allowed);
        assert!(result.window_blocked);

        let result = PermissionService::check_privacy(
            None,
            None,
            Some("联系 researcher@example.com"),
            &[],
            &[],
        );
        assert!(result.allowed);
        assert!(result.content_redacted);
        assert_eq!(result.redaction_kinds, vec!["邮箱"]);
    }
}
