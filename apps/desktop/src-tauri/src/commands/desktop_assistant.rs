//! 桌面助手命令模块
//!
//! 参数校验后委托 service，禁止承载业务逻辑

use base64::Engine;
use serde::{Deserialize, Serialize};
use tauri::{command, Emitter, State};

use crate::services::desktop_assistant::capture_service::{
    CaptureConfirmationDecision, CaptureResult, CaptureService, CaptureStatus, ContextSourceType,
};
use crate::services::desktop_assistant::capture_store::CaptureStore;
use crate::services::desktop_assistant::content_policy::retained_window_title;
use crate::services::desktop_assistant::preference_service::{
    AssistantDataPolicy, AssistantOnboardingState, AssistantPrivacyPreferences,
    AssistantRuntimePreferences, AssistantShortcutDiagnostic, AssistantTranslationPreferences,
};
use crate::services::desktop_assistant::{
    AssistantPreferenceService, CleanupService, PermissionService,
};
use crate::state::AppState;

/// 权限状态
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PermissionStatusResponse {
    pub accessibility: bool,
    pub screen_recording: bool,
    pub clipboard: bool,
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
    pub capture_region:
        Option<crate::platform::desktop_assistant::trait_platform::ScreenshotRegion>,
    pub original_character_count: Option<usize>,
    pub content_truncated: bool,
    pub status: String,
    pub privacy_check:
        Option<crate::services::desktop_assistant::permission_service::PrivacyCheckResult>,
}

pub(crate) fn capture_response(result: CaptureResult) -> CaptureContextResponse {
    let display_content = result
        .sanitized_content
        .clone()
        .or(result.session.content.clone());
    CaptureContextResponse {
        session_id: result.session.id,
        content: display_content,
        sanitized_content: result.sanitized_content,
        source_app: result.session.source_app,
        source_app_bundle_id: result.session.source_app_bundle_id,
        window_title: result.session.window_title,
        capture_region: result.session.capture_region,
        original_character_count: result.original_character_count,
        content_truncated: result.content_truncated,
        status: result.session.status.as_str().to_string(),
        privacy_check: result.session.privacy_check,
    }
}

pub(crate) fn ensure_assistant_enabled() -> Result<(), String> {
    if crate::desktop_shell::assistant_enabled() {
        Ok(())
    } else {
        Err("桌面助手已关闭，请先在设置中启用".to_string())
    }
}

async fn acquire_context(
    state: &AppState,
    source_type: ContextSourceType,
) -> Result<CaptureContextResponse, String> {
    ensure_assistant_enabled()?;
    let preferences = AssistantPreferenceService::load_privacy(&state.db)
        .await
        .map_err(|error| error.to_string())?;
    let result = CaptureService::get_context(
        &source_type,
        &preferences.allowed_apps,
        &preferences.blocked_apps,
        preferences.window_title_enabled,
    )
    .await
    .map_err(|error| error.to_string())?;
    if result.session.status != CaptureStatus::Blocked {
        CaptureStore::persist_metadata(&state.db, &result.session)
            .await
            .map_err(|error| error.to_string())?;
    }
    Ok(capture_response(result))
}

fn current_shortcut_diagnostic(
    requested_shortcut: String,
    active_shortcut: String,
    enabled: bool,
) -> AssistantShortcutDiagnostic {
    if !enabled {
        return AssistantShortcutDiagnostic {
            status: "disabled".to_string(),
            requested_shortcut,
            active_shortcut: None,
            message: "桌面助手已关闭".to_string(),
            updated_at: chrono::Utc::now().to_rfc3339(),
        };
    }
    let registered = !active_shortcut.is_empty();
    AssistantShortcutDiagnostic {
        status: if registered { "healthy" } else { "error" }.to_string(),
        requested_shortcut,
        active_shortcut: registered.then_some(active_shortcut),
        message: if registered {
            String::new()
        } else {
            "当前没有成功注册的全局快捷键".to_string()
        },
        updated_at: chrono::Utc::now().to_rfc3339(),
    }
}

async fn record_shortcut_failure(
    state: &AppState,
    requested_shortcut: &str,
    message: &str,
) -> Result<(), String> {
    let active_shortcut = crate::desktop_shell::current_assistant_shortcut();
    let diagnostic = AssistantShortcutDiagnostic {
        status: if active_shortcut.is_empty() {
            "error".to_string()
        } else {
            "degraded".to_string()
        },
        requested_shortcut: requested_shortcut.to_string(),
        active_shortcut: (!active_shortcut.is_empty()).then_some(active_shortcut),
        message: message.to_string(),
        updated_at: chrono::Utc::now().to_rfc3339(),
    };
    AssistantPreferenceService::save_shortcut_diagnostic(&state.db, &diagnostic)
        .await
        .map_err(|error| format!("记录快捷键诊断失败：{error}"))
}

async fn set_and_persist_shortcut(
    state: &AppState,
    app: &tauri::AppHandle,
    shortcut: &str,
) -> Result<String, String> {
    let previous = crate::desktop_shell::current_assistant_shortcut();
    let registered = match crate::desktop_shell::set_assistant_shortcut(app, shortcut) {
        Ok(registered) => registered,
        Err(error) => {
            let _ = record_shortcut_failure(state, shortcut, &error).await;
            return Err(error);
        }
    };
    let update = serde_json::json!({ "assistant_shortcut": registered });

    if let Err(error) = crate::services::settings_service::update_settings(state, &update).await {
        if !previous.is_empty() {
            let _ = crate::desktop_shell::set_assistant_shortcut(app, &previous);
        }
        let message = format!("快捷键已注册但保存失败，已恢复原设置：{error}");
        let _ = record_shortcut_failure(state, shortcut, &message).await;
        return Err(message);
    }

    AssistantPreferenceService::clear_shortcut_diagnostic(&state.db)
        .await
        .map_err(|error| format!("快捷键已生效，但清除旧诊断失败：{error}"))?;
    Ok(registered)
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

/// 获取首次权限引导状态。
#[command]
pub async fn assistant_get_onboarding(
    state: State<'_, AppState>,
) -> Result<AssistantOnboardingState, String> {
    AssistantPreferenceService::load_onboarding(&state.db)
        .await
        .map_err(|error| error.to_string())
}

/// 用户完成或明确跳过权限说明后，不再自动重复弹出。
#[command]
pub async fn assistant_complete_permission_guide(
    state: State<'_, AppState>,
    app: tauri::AppHandle,
) -> Result<AssistantOnboardingState, String> {
    let onboarding = AssistantPreferenceService::complete_permission_guide(&state.db)
        .await
        .map_err(|error| error.to_string())?;
    app.emit("assistant://onboarding-changed", &onboarding)
        .map_err(|error| format!("引导状态已保存，但同步失败：{error}"))?;
    Ok(onboarding)
}

// ─── 偏好设置命令 ──────────────────────────────────────────────────────────

/// 获取当前已注册的全局快捷键。
#[command]
pub async fn assistant_get_shortcut(state: State<'_, AppState>) -> Result<String, String> {
    let registered = crate::desktop_shell::current_assistant_shortcut();
    if !registered.is_empty() {
        return Ok(registered);
    }
    let settings = state.settings.read().await;
    Ok(settings
        .get("assistant_shortcut")
        .cloned()
        .unwrap_or_else(|| "Alt+Space".to_string()))
}

/// 注册并持久化新的全局快捷键。注册失败时保留原快捷键。
#[command]
pub async fn assistant_set_shortcut(
    state: State<'_, AppState>,
    app: tauri::AppHandle,
    shortcut: String,
) -> Result<String, String> {
    ensure_assistant_enabled()?;
    set_and_persist_shortcut(state.inner(), &app, &shortcut).await
}

/// 获取最近一次快捷键注册诊断；无故障时返回健康状态。
#[command]
pub async fn assistant_get_shortcut_diagnostic(
    state: State<'_, AppState>,
) -> Result<AssistantShortcutDiagnostic, String> {
    let configured = state
        .settings
        .read()
        .await
        .get("assistant_shortcut")
        .cloned()
        .unwrap_or_else(|| "Alt+Space".to_string());
    if !crate::desktop_shell::assistant_enabled() {
        return Ok(current_shortcut_diagnostic(
            configured,
            String::new(),
            false,
        ));
    }
    if let Some(diagnostic) = AssistantPreferenceService::load_shortcut_diagnostic(&state.db)
        .await
        .map_err(|error| error.to_string())?
    {
        return Ok(diagnostic);
    }
    Ok(current_shortcut_diagnostic(
        configured,
        crate::desktop_shell::current_assistant_shortcut(),
        crate::desktop_shell::assistant_enabled(),
    ))
}

/// 重试最近失败的快捷键并在成功后清除诊断。
#[command]
pub async fn assistant_retry_shortcut(
    state: State<'_, AppState>,
    app: tauri::AppHandle,
) -> Result<String, String> {
    ensure_assistant_enabled()?;
    let diagnostic = AssistantPreferenceService::load_shortcut_diagnostic(&state.db)
        .await
        .map_err(|error| error.to_string())?;
    let configured = state
        .settings
        .read()
        .await
        .get("assistant_shortcut")
        .cloned()
        .unwrap_or_else(|| "Alt+Space".to_string());
    let target = diagnostic
        .map(|diagnostic| diagnostic.requested_shortcut)
        .filter(|shortcut| !shortcut.is_empty())
        .unwrap_or(configured);
    if target.is_empty() {
        return Err("没有可重试的快捷键，请先录入新的组合键".to_string());
    }
    set_and_persist_shortcut(state.inner(), &app, &target).await
}

/// 获取桌面助手总开关与助手专属诊断日志开关。
#[command]
pub async fn assistant_get_runtime_preferences(
    state: State<'_, AppState>,
) -> Result<AssistantRuntimePreferences, String> {
    AssistantPreferenceService::load_runtime(&state.db)
        .await
        .map_err(|error| error.to_string())
}

/// 应用桌面助手运行状态。关闭时隐藏窗口并注销全局快捷键。
#[command]
pub async fn assistant_set_runtime_preferences(
    state: State<'_, AppState>,
    app: tauri::AppHandle,
    enabled: bool,
    diagnostic_logging_enabled: bool,
) -> Result<AssistantRuntimePreferences, String> {
    let previous = AssistantPreferenceService::load_runtime(&state.db)
        .await
        .map_err(|error| error.to_string())?;
    let preferences =
        AssistantPreferenceService::save_runtime(&state.db, enabled, diagnostic_logging_enabled)
            .await
            .map_err(|error| error.to_string())?;
    crate::desktop_shell::configure_assistant_runtime(enabled, diagnostic_logging_enabled);
    if !enabled {
        let handles = std::mem::take(&mut *state.assistant_action_handles.lock().await);
        for (_, handle) in handles {
            handle.abort();
        }
    }

    let runtime_result = if enabled && !previous.enabled {
        let configured = state
            .settings
            .read()
            .await
            .get("assistant_shortcut")
            .cloned()
            .unwrap_or_else(|| "Alt+Space".to_string());
        set_and_persist_shortcut(state.inner(), &app, &configured)
            .await
            .map(|_| ())
    } else if !enabled && previous.enabled {
        crate::desktop_shell::deactivate_assistant(&app)
    } else {
        Ok(())
    };

    let _ = app.emit("assistant://runtime-preferences-changed", &preferences);
    runtime_result.map_err(|error| {
        if enabled {
            format!("桌面助手已启用，但快捷键恢复失败：{error}")
        } else {
            format!("桌面助手已关闭，但部分资源清理失败：{error}")
        }
    })?;
    Ok(preferences)
}

/// 获取应用级允许/禁止规则。
#[command]
pub async fn assistant_get_privacy_preferences(
    state: State<'_, AppState>,
) -> Result<AssistantPrivacyPreferences, String> {
    AssistantPreferenceService::load_privacy(&state.db)
        .await
        .map_err(|error| error.to_string())
}

/// 保存应用级允许/禁止规则。禁止列表始终具有更高优先级。
#[command]
pub async fn assistant_set_privacy_preferences(
    state: State<'_, AppState>,
    allowed_apps: Vec<String>,
    blocked_apps: Vec<String>,
    window_title_enabled: bool,
) -> Result<AssistantPrivacyPreferences, String> {
    AssistantPreferenceService::save_privacy(
        &state.db,
        allowed_apps,
        blocked_apps,
        window_title_enabled,
    )
    .await
    .map_err(|error| error.to_string())
}

/// 获取发送前预览和稍后处理箱保留策略。
#[command]
pub async fn assistant_get_data_policy(
    state: State<'_, AppState>,
) -> Result<AssistantDataPolicy, String> {
    AssistantPreferenceService::load_data_policy(&state.db)
        .await
        .map_err(|error| error.to_string())
}

/// 保存发送前预览和稍后处理箱保留策略。
#[command]
pub async fn assistant_set_data_policy(
    state: State<'_, AppState>,
    app: tauri::AppHandle,
    preview_required: bool,
    inbox_retention_days: Option<u16>,
) -> Result<AssistantDataPolicy, String> {
    let policy = AssistantPreferenceService::save_data_policy(
        &state.db,
        preview_required,
        inbox_retention_days,
    )
    .await
    .map_err(|error| error.to_string())?;
    app.emit("assistant://data-policy-changed", &policy)
        .map_err(|error| format!("策略已保存，但同步到悬浮面板失败：{error}"))?;
    Ok(policy)
}

/// 获取桌面助手翻译目标语言和术语呈现偏好。
#[command]
pub async fn assistant_get_translation_preferences(
    state: State<'_, AppState>,
) -> Result<AssistantTranslationPreferences, String> {
    AssistantPreferenceService::load_translation(&state.db)
        .await
        .map_err(|error| error.to_string())
}

/// 保存翻译偏好并同步到其他助手窗口。
#[command]
pub async fn assistant_set_translation_preferences(
    state: State<'_, AppState>,
    app: tauri::AppHandle,
    target_language: String,
    terminology_style: String,
) -> Result<AssistantTranslationPreferences, String> {
    let preferences = AssistantPreferenceService::save_translation(
        &state.db,
        &target_language,
        &terminology_style,
    )
    .await
    .map_err(|error| error.to_string())?;
    app.emit("assistant://translation-preferences-changed", &preferences)
        .map_err(|error| format!("翻译偏好已保存，但跨窗口同步失败：{error}"))?;
    Ok(preferences)
}

// ─── 采集相关命令 ──────────────────────────────────────────────────────────

/// 获取选中文本（带隐私检查）
#[command]
pub async fn assistant_get_selection(
    state: State<'_, AppState>,
) -> Result<CaptureContextResponse, String> {
    acquire_context(state.inner(), ContextSourceType::Selection).await
}

/// 获取剪贴板内容（带隐私检查）
#[command]
pub async fn assistant_get_clipboard(
    state: State<'_, AppState>,
) -> Result<CaptureContextResponse, String> {
    acquire_context(state.inner(), ContextSourceType::Clipboard).await
}

/// 创建不包含正文的手动粘贴会话。
#[command]
pub async fn assistant_create_paste_session(
    state: State<'_, AppState>,
) -> Result<CaptureContextResponse, String> {
    ensure_assistant_enabled()?;
    let mut session = CaptureService::create_session(ContextSourceType::Paste, 24);
    session.status = CaptureStatus::Ready;
    CaptureStore::persist_metadata(&state.db, &session)
        .await
        .map_err(|error| error.to_string())?;
    Ok(capture_response(CaptureResult {
        session,
        sanitized_content: None,
        original_character_count: None,
        content_truncated: false,
    }))
}

/// 标记用户已确认发送当前捕获上下文。
#[command]
pub async fn assistant_confirm_capture(
    state: State<'_, AppState>,
    session_id: String,
    content: String,
) -> Result<CaptureConfirmationDecision, String> {
    ensure_assistant_enabled()?;
    let confirmation = CaptureService::prepare_confirmation(&content);
    if !confirmation.confirmed {
        return Ok(confirmation);
    }
    CaptureStore::confirm(&state.db, &session_id)
        .await
        .map_err(|error| error.to_string())?;
    Ok(confirmation)
}

/// 用户取消时立即删除临时会话元数据。
#[command]
pub async fn assistant_discard_capture(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<(), String> {
    CaptureStore::discard(&state.db, &session_id)
        .await
        .map_err(|error| error.to_string())
}

/// 截取屏幕区域
#[command]
pub async fn assistant_capture_screen(
    state: State<'_, AppState>,
    app: tauri::AppHandle,
) -> Result<CaptureContextResponse, String> {
    ensure_assistant_enabled()?;
    let preferences = AssistantPreferenceService::load_privacy(&state.db)
        .await
        .map_err(|error| error.to_string())?;
    let (source_app, source_app_bundle_id, window_title) = CaptureService::get_frontmost_app()
        .await
        .map_err(|e| e.to_string())?;
    let privacy_check = PermissionService::check_privacy(
        source_app_bundle_id.as_deref(),
        window_title.as_deref(),
        None,
        &preferences.allowed_apps,
        &preferences.blocked_apps,
    );

    let mut session = CaptureService::create_session(ContextSourceType::Screenshot, 24);
    session.source_app = source_app;
    session.source_app_bundle_id = source_app_bundle_id;
    session.window_title =
        retained_window_title(preferences.window_title_enabled, window_title.as_deref());
    session.privacy_check = Some(privacy_check.clone());

    if !privacy_check.allowed {
        session.status = CaptureStatus::Blocked;
        session.window_title = None;
        return Ok(capture_response(CaptureResult {
            session,
            sanitized_content: None,
            original_character_count: None,
            content_truncated: false,
        }));
    }

    if let Some(panel) = app.get_webview_window("assistant-panel") {
        let _ = panel.hide();
    }
    let capture = CaptureService::capture_screen_interactive().await;
    let _ = crate::desktop_shell::show_assistant_panel(&app, false);
    let capture = capture.map_err(|e| e.to_string())?;
    if capture.bytes.len() > 20 * 1024 * 1024 {
        return Err("截图超过 20 MB，请缩小选择区域后重试".to_string());
    }
    let data_url = format!(
        "data:image/png;base64,{}",
        base64::engine::general_purpose::STANDARD.encode(capture.bytes)
    );

    session.status = CaptureStatus::Ready;
    session.content = Some(data_url);
    session.capture_region = Some(capture.region);
    CaptureStore::persist_metadata(&state.db, &session)
        .await
        .map_err(|error| error.to_string())?;
    Ok(capture_response(CaptureResult {
        session,
        sanitized_content: None,
        original_character_count: None,
        content_truncated: false,
    }))
}

/// 获取前台应用信息
#[command]
pub async fn assistant_get_frontmost_app(
    state: State<'_, AppState>,
) -> Result<(Option<String>, Option<String>, Option<String>), String> {
    ensure_assistant_enabled()?;
    let preferences = AssistantPreferenceService::load_privacy(&state.db)
        .await
        .map_err(|error| error.to_string())?;
    CaptureService::get_frontmost_app()
        .await
        .map(|(name, bundle_id, window_title)| {
            (
                name,
                bundle_id,
                retained_window_title(preferences.window_title_enabled, window_title.as_deref()),
            )
        })
        .map_err(|e| e.to_string())
}

// ─── 清理相关命令 ──────────────────────────────────────────────────────────

/// 清理过期数据
#[command]
pub async fn assistant_cleanup(state: State<'_, AppState>) -> Result<(u32, u32), String> {
    CleanupService::cleanup_all(&state.db)
        .await
        .map_err(|e| e.to_string())
}

/// 用户主动清空稍后处理箱。
#[command]
pub async fn assistant_clear_later_items(state: State<'_, AppState>) -> Result<u32, String> {
    CleanupService::clear_later_items(&state.db)
        .await
        .map_err(|error| error.to_string())
}

// ─── 窗口控制命令 ──────────────────────────────────────────────────────────

use tauri::Manager;

/// 显示桌面小妍角色窗口
#[command]
pub async fn assistant_show_dock(app: tauri::AppHandle) -> Result<(), String> {
    crate::desktop_shell::set_assistant_dock_visible(&app, true)
}

/// 隐藏桌面小妍角色窗口
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

/// 获取桌面小妍可见状态
#[command]
pub async fn assistant_is_dock_visible(app: tauri::AppHandle) -> Result<bool, String> {
    if let Some(window) = app.get_webview_window("assistant-dock") {
        window.is_visible().map_err(|e| e.to_string())
    } else {
        Ok(false)
    }
}

/// 桌面小妍注视目标
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DockLookTargetResponse {
    pub cursor_x: f64,
    pub cursor_y: f64,
    pub window_x: i32,
    pub window_y: i32,
    pub window_width: u32,
    pub window_height: u32,
}

/// 获取桌面小妍注视目标（全局光标位置 + 窗口位置）
#[command]
pub async fn assistant_get_dock_look_target(
    window: tauri::WebviewWindow,
) -> Result<DockLookTargetResponse, String> {
    let cursor = window.cursor_position().map_err(|e| e.to_string())?;
    let position = window.outer_position().map_err(|e| e.to_string())?;
    let size = window.outer_size().map_err(|e| e.to_string())?;
    Ok(DockLookTargetResponse {
        cursor_x: cursor.x,
        cursor_y: cursor.y,
        window_x: position.x,
        window_y: position.y,
        window_width: size.width,
        window_height: size.height,
    })
}

#[cfg(test)]
mod tests {
    use super::{capture_response, current_shortcut_diagnostic};
    use crate::services::desktop_assistant::capture_service::{
        CaptureResult, CaptureService, ContextSourceType,
    };

    #[test]
    fn shortcut_diagnostic_distinguishes_registered_and_missing_shortcuts() {
        let healthy =
            current_shortcut_diagnostic("Alt+Space".to_string(), "Alt+Space".to_string(), true);
        assert_eq!(healthy.status, "healthy");
        assert_eq!(healthy.active_shortcut.as_deref(), Some("Alt+Space"));

        let missing = current_shortcut_diagnostic("Alt+Space".to_string(), String::new(), true);
        assert_eq!(missing.status, "error");
        assert!(missing.active_shortcut.is_none());
        assert!(!missing.message.is_empty());

        let disabled = current_shortcut_diagnostic("Alt+Space".to_string(), String::new(), false);
        assert_eq!(disabled.status, "disabled");
    }

    #[test]
    fn capture_response_never_exposes_the_unredacted_text_when_a_mask_exists() {
        let mut session = CaptureService::create_session(ContextSourceType::Clipboard, 24);
        session.content = Some("联系 researcher@example.com".to_string());
        let response = capture_response(CaptureResult {
            session,
            sanitized_content: Some("联系 [EMAIL]".to_string()),
            original_character_count: Some(25),
            content_truncated: false,
        });
        assert_eq!(response.content.as_deref(), Some("联系 [EMAIL]"));
        assert_ne!(
            response.content.as_deref(),
            Some("联系 researcher@example.com")
        );
    }
}

// ─── 匿名本地指标命令（P0-5）────────────────────────────────────────────────
//
// 只接受结构化枚举与计数，不接收任何文本载荷；详见 services/desktop_assistant/metrics_service.rs。

use crate::services::desktop_assistant::metrics_service::{
    AssistantMetricsPreferences, AssistantMetricsService, MetricsDailyBucket,
    DEFAULT_OVERVIEW_DAYS,
};

/// 获取匿名本地指标开关（默认关闭）。
#[command]
pub async fn assistant_get_metrics_preferences(
    state: State<'_, AppState>,
) -> Result<AssistantMetricsPreferences, String> {
    AssistantMetricsService::load_preferences(&state.db)
        .await
        .map_err(|error| error.to_string())
}

/// 开关匿名本地指标；关闭时同步清空已存事件。
#[command]
pub async fn assistant_set_metrics_preferences(
    state: State<'_, AppState>,
    enabled: bool,
) -> Result<AssistantMetricsPreferences, String> {
    AssistantMetricsService::save_preferences(&state.db, enabled)
        .await
        .map_err(|error| error.to_string())
}

/// 按天聚合的指标概览，供 KR 统计与设置区计数展示。
#[command]
pub async fn assistant_get_metrics_overview(
    state: State<'_, AppState>,
    days: Option<u16>,
) -> Result<Vec<MetricsDailyBucket>, String> {
    AssistantMetricsService::daily_overview(&state.db, days.unwrap_or(DEFAULT_OVERVIEW_DAYS))
        .await
        .map_err(|error| error.to_string())
}

/// 复制动作打点。无参数设计使前端无法借此写入任何内容载荷。
#[command]
pub async fn assistant_record_copy(state: State<'_, AppState>) -> Result<(), String> {
    AssistantMetricsService::record_quiet(
        &state.db,
        crate::services::desktop_assistant::metrics_service::MetricEvent {
            event_type: "copy".to_string(),
            action: None,
            source_type: None,
            target: None,
            duration_ms: None,
            status: "success".to_string(),
        },
    )
    .await;
    Ok(())
}

// ─── 站位与屏幕几何命令（P0-2）────────────────────────────────────────

/// 显示器信息快照；坐标与尺寸为 Tauri 物理像素，与窗口 outer_position 一致。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssistantMonitorInfo {
    pub name: Option<String>,
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub work_x: i32,
    pub work_y: i32,
    pub work_width: u32,
    pub work_height: u32,
    pub scale_factor: f64,
    pub is_primary: bool,
}

/// 窗口矩形快照（物理像素）。
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct AssistantWindowFrame {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

/// 屏幕快照：显示器列表 + 桌面小妍当前位置，供前端做站位恢复与边缘吸附。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssistantScreenSnapshot {
    pub monitors: Vec<AssistantMonitorInfo>,
    pub dock_frame: Option<AssistantWindowFrame>,
}

/// 获取显示器列表与桌面小妍当前位置。
#[command]
pub async fn assistant_get_screen_snapshot(
    app: tauri::AppHandle,
) -> Result<AssistantScreenSnapshot, String> {
    let primary = app.primary_monitor().map_err(|error| error.to_string())?;
    let monitors = app
        .available_monitors()
        .map_err(|error| error.to_string())?
        .into_iter()
        .map(|monitor| {
            let is_primary = primary.as_ref().is_some_and(|primary| {
                primary.name() == monitor.name()
                    && primary.position() == monitor.position()
                    && primary.size() == monitor.size()
            });
            let position = monitor.position();
            let size = monitor.size();
            let work_area = monitor.work_area();
            AssistantMonitorInfo {
                name: monitor.name().cloned(),
                x: position.x,
                y: position.y,
                width: size.width,
                height: size.height,
                work_x: work_area.position.x,
                work_y: work_area.position.y,
                work_width: work_area.size.width,
                work_height: work_area.size.height,
                scale_factor: monitor.scale_factor(),
                is_primary,
            }
        })
        .collect();
    let dock_frame = app
        .get_webview_window("assistant-dock")
        .and_then(|window| {
            let position = window.outer_position().ok()?;
            let size = window.outer_size().ok()?;
            Some(AssistantWindowFrame {
                x: position.x,
                y: position.y,
                width: size.width,
                height: size.height,
            })
        });
    Ok(AssistantScreenSnapshot {
        monitors,
        dock_frame,
    })
}

/// 移动桌面小妍窗口；坐标会夹取到目标显示器的可用区域内，
/// 作为前端几何计算之外的安全网，避开系统菜单栏与 Dock。
#[command]
pub async fn assistant_set_dock_position(
    app: tauri::AppHandle,
    x: i32,
    y: i32,
) -> Result<(), String> {
    let window = app
        .get_webview_window("assistant-dock")
        .ok_or_else(|| "Dock window not found".to_string())?;
    let size = window.outer_size().map_err(|error| error.to_string())?;
    let monitors = app
        .available_monitors()
        .map_err(|error| error.to_string())?;
    let (mut x, mut y) = (x, y);
    let center = (x + size.width as i32 / 2, y + size.height as i32 / 2);
    let target_monitor = monitors
        .iter()
        .find(|monitor| {
            let position = monitor.position();
            let monitor_size = monitor.size();
            center.0 >= position.x
                && center.0 < position.x + monitor_size.width as i32
                && center.1 >= position.y
                && center.1 < position.y + monitor_size.height as i32
        })
        .cloned()
        .or_else(|| app.primary_monitor().ok().flatten())
        .or_else(|| monitors.first().cloned());
    if let Some(monitor) = target_monitor {
        let work_area = monitor.work_area();
        let max_x = work_area.position.x + work_area.size.width as i32 - size.width as i32;
        let max_y = work_area.position.y + work_area.size.height as i32 - size.height as i32;
        x = if max_x < work_area.position.x {
            work_area.position.x
        } else {
            x.clamp(work_area.position.x, max_x)
        };
        y = if max_y < work_area.position.y {
            work_area.position.y
        } else {
            y.clamp(work_area.position.y, max_y)
        };
    }
    window
        .set_position(tauri::PhysicalPosition::new(x, y))
        .map_err(|error| error.to_string())
}

/// 读取持久化的桌面小妍站位。
#[command]
pub async fn assistant_get_dock_placement(
    state: State<'_, AppState>,
) -> Result<
    Option<crate::services::desktop_assistant::preference_service::AssistantDockPlacement>,
    String,
> {
    AssistantPreferenceService::load_dock_placement(&state.db)
        .await
        .map_err(|error| error.to_string())
}

/// 保存桌面小妍站位（显示器标识 + 边缘 + 沿边缘偏移）。
#[command]
pub async fn assistant_save_dock_placement(
    state: State<'_, AppState>,
    monitor_id: String,
    edge: String,
    offset: i32,
) -> Result<(), String> {
    let monitor_id = monitor_id.trim().to_string();
    if monitor_id.is_empty() || monitor_id.chars().count() > 256 {
        return Err("显示器标识不能为空或超过 256 个字符".to_string());
    }
    if !matches!(edge.as_str(), "left" | "right" | "top" | "bottom") {
        return Err("站位边缘仅支持 left/right/top/bottom".to_string());
    }
    if offset.abs() > 100_000 {
        return Err("站位偏移超出允许范围".to_string());
    }
    AssistantPreferenceService::save_dock_placement(
        &state.db,
        &crate::services::desktop_assistant::preference_service::AssistantDockPlacement {
            monitor_id,
            edge,
            offset,
        },
    )
    .await
    .map_err(|error| error.to_string())
}

/// 清除持久化站位并把桌面小妍恢复到默认位置。
#[command]
pub async fn assistant_reset_dock_placement(
    state: State<'_, AppState>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    AssistantPreferenceService::clear_dock_placement(&state.db)
        .await
        .map_err(|error| error.to_string())?;
    crate::desktop_shell::reset_assistant_dock_position(&app);
    Ok(())
}

// ─── 直达动作快捷键（P1-1，PRD §16.2）──────────────────────────────────────
//
// 默认不注册；设置页开启后按动作持久化组合键与注册诊断，
// 冲突处理复用主快捷键的“持久诊断 + 降级展示 + 重试入口”模式。

/// 单个直达动作的快捷键状态。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssistantDirectShortcutStatus {
    pub action: String,
    /// 用户配置并持久化的组合键；None 表示未开启。
    pub configured_shortcut: Option<String>,
    /// 当前实际注册生效的组合键；None 表示未注册。
    pub active_shortcut: Option<String>,
    /// 最近一次注册失败诊断；无故障时为 None。
    pub diagnostic: Option<AssistantShortcutDiagnostic>,
}

async fn direct_shortcut_status(
    state: &AppState,
    action: &str,
) -> Result<AssistantDirectShortcutStatus, String> {
    let mut shortcuts = AssistantPreferenceService::load_direct_shortcuts(&state.db)
        .await
        .map_err(|error| error.to_string())?;
    let active = crate::desktop_shell::current_assistant_direct_shortcut(action);
    let diagnostic =
        AssistantPreferenceService::load_direct_shortcut_diagnostic(&state.db, action)
            .await
            .map_err(|error| error.to_string())?;
    Ok(AssistantDirectShortcutStatus {
        action: action.to_string(),
        configured_shortcut: shortcuts.remove(action),
        active_shortcut: (!active.is_empty()).then_some(active),
        diagnostic,
    })
}

async fn record_direct_shortcut_failure(
    state: &AppState,
    action: &str,
    requested_shortcut: &str,
    message: &str,
) -> Result<(), String> {
    let active_shortcut = crate::desktop_shell::current_assistant_direct_shortcut(action);
    let diagnostic = AssistantShortcutDiagnostic {
        status: if active_shortcut.is_empty() {
            "error".to_string()
        } else {
            "degraded".to_string()
        },
        requested_shortcut: requested_shortcut.to_string(),
        active_shortcut: (!active_shortcut.is_empty()).then_some(active_shortcut),
        message: message.to_string(),
        updated_at: chrono::Utc::now().to_rfc3339(),
    };
    AssistantPreferenceService::save_direct_shortcut_diagnostic(&state.db, action, &diagnostic)
        .await
        .map_err(|error| format!("记录直达快捷键诊断失败：{error}"))
}

async fn set_and_persist_direct_shortcut(
    state: &AppState,
    app: &tauri::AppHandle,
    action: &str,
    shortcut: Option<&str>,
) -> Result<AssistantDirectShortcutStatus, String> {
    if !crate::services::desktop_assistant::preference_service::is_valid_direct_action(action) {
        return Err(format!("不支持的直达动作：{action}"));
    }
    let previous = AssistantPreferenceService::load_direct_shortcuts(&state.db)
        .await
        .map_err(|error| error.to_string())?
        .remove(action);
    let registered = match crate::desktop_shell::set_assistant_direct_shortcut(app, action, shortcut)
    {
        Ok(registered) => registered,
        Err(error) => {
            let _ = record_direct_shortcut_failure(
                state,
                action,
                shortcut.unwrap_or_default(),
                &error,
            )
            .await;
            return Err(error);
        }
    };
    if let Err(error) =
        AssistantPreferenceService::save_direct_shortcut(&state.db, action, registered.as_deref())
            .await
    {
        let _ = crate::desktop_shell::set_assistant_direct_shortcut(
            app,
            action,
            previous.as_deref(),
        );
        let message = format!("直达快捷键已注册但保存失败，已恢复原设置：{error}");
        let _ = record_direct_shortcut_failure(
            state,
            action,
            shortcut.unwrap_or_default(),
            &message,
        )
        .await;
        return Err(message);
    }
    AssistantPreferenceService::clear_direct_shortcut_diagnostic(&state.db, action)
        .await
        .map_err(|error| format!("直达快捷键已生效，但清除旧诊断失败：{error}"))?;
    direct_shortcut_status(state, action).await
}

/// 获取三个直达动作的快捷键配置、注册状态与诊断。
/// 助手被关闭再开启后，注册状态会丢失；此处对“已配置但未注册且无诊断”的
/// 动作做一次静默恢复（典型场景就是总开关重新启用），明确失败过的仍需手动重试。
#[command]
pub async fn assistant_get_direct_shortcuts(
    state: State<'_, AppState>,
    app: tauri::AppHandle,
) -> Result<Vec<AssistantDirectShortcutStatus>, String> {
    let mut statuses = Vec::new();
    for action in crate::services::desktop_assistant::preference_service::DIRECT_SHORTCUT_ACTIONS {
        let mut status = direct_shortcut_status(state.inner(), action).await?;
        if crate::desktop_shell::assistant_enabled()
            && status.configured_shortcut.is_some()
            && status.active_shortcut.is_none()
            && status.diagnostic.is_none()
        {
            let shortcut = status.configured_shortcut.clone().unwrap_or_default();
            match crate::desktop_shell::set_assistant_direct_shortcut(
                &app,
                action,
                Some(&shortcut),
            ) {
                Ok(_) => {
                    let _ = AssistantPreferenceService::clear_direct_shortcut_diagnostic(
                        &state.db, action,
                    )
                    .await;
                    status.active_shortcut = Some(shortcut);
                }
                Err(error) => {
                    let _ =
                        record_direct_shortcut_failure(state.inner(), action, &shortcut, &error)
                            .await;
                    status = direct_shortcut_status(state.inner(), action).await?;
                }
            }
        }
        statuses.push(status);
    }
    Ok(statuses)
}

/// 开启（shortcut 为 Some）或关闭（None）某个直达动作的全局快捷键。
/// 注册失败时保留原配置并记录诊断。
#[command]
pub async fn assistant_set_direct_shortcut(
    state: State<'_, AppState>,
    app: tauri::AppHandle,
    action: String,
    shortcut: Option<String>,
) -> Result<AssistantDirectShortcutStatus, String> {
    ensure_assistant_enabled()?;
    set_and_persist_direct_shortcut(state.inner(), &app, &action, shortcut.as_deref()).await
}

/// 重试最近失败的直达动作快捷键（优先诊断中记录的请求键位），成功后清除诊断。
#[command]
pub async fn assistant_retry_direct_shortcut(
    state: State<'_, AppState>,
    app: tauri::AppHandle,
    action: String,
) -> Result<AssistantDirectShortcutStatus, String> {
    ensure_assistant_enabled()?;
    if !crate::services::desktop_assistant::preference_service::is_valid_direct_action(&action) {
        return Err(format!("不支持的直达动作：{action}"));
    }
    let diagnostic =
        AssistantPreferenceService::load_direct_shortcut_diagnostic(&state.db, &action)
            .await
            .map_err(|error| error.to_string())?;
    let configured = AssistantPreferenceService::load_direct_shortcuts(&state.db)
        .await
        .map_err(|error| error.to_string())?
        .remove(&action);
    let target = diagnostic
        .map(|diagnostic| diagnostic.requested_shortcut)
        .filter(|shortcut| !shortcut.is_empty())
        .or(configured)
        .ok_or_else(|| "没有可重试的直达快捷键，请先录入新的组合键".to_string())?;
    set_and_persist_direct_shortcut(state.inner(), &app, &action, Some(&target)).await
}
