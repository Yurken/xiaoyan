//! Desktop shell integration: tray, assistant windows and global shortcut.

use std::collections::HashMap;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Mutex, OnceLock,
};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder},
    window::Color,
    App, AppHandle, Emitter, Manager, PhysicalPosition,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutEvent, ShortcutState};

use crate::{
    services::{
        desktop_assistant::preference_service::{
            AssistantShortcutDiagnostic, DIRECT_SHORTCUT_ACTIONS,
        },
        settings_service,
    },
    state::AppState,
};

const DEFAULT_ASSISTANT_SHORTCUT: &str = "Alt+Space";
const CAPTURE_REQUEST_EVENT: &str = "assistant://capture-request";
const DIRECT_ACTION_EVENT: &str = "assistant://direct-action";
const ASSISTANT_DOCK_WIDTH: i32 = 128;
const ASSISTANT_DOCK_HEIGHT: i32 = 136;
static REGISTERED_ASSISTANT_SHORTCUT: OnceLock<Mutex<String>> = OnceLock::new();
static REGISTERED_DIRECT_SHORTCUTS: OnceLock<Mutex<HashMap<String, String>>> = OnceLock::new();
static ASSISTANT_ENABLED: AtomicBool = AtomicBool::new(true);
static ASSISTANT_DIAGNOSTIC_LOGGING_ENABLED: AtomicBool = AtomicBool::new(false);

fn registered_shortcut() -> &'static Mutex<String> {
    REGISTERED_ASSISTANT_SHORTCUT.get_or_init(|| Mutex::new(String::new()))
}

fn registered_direct_shortcuts() -> &'static Mutex<HashMap<String, String>> {
    REGISTERED_DIRECT_SHORTCUTS.get_or_init(|| Mutex::new(HashMap::new()))
}

fn conflicting_direct_action(
    shortcuts: &HashMap<String, String>,
    candidate: &str,
    excluded_action: Option<&str>,
) -> Option<String> {
    shortcuts
        .iter()
        .find(|(action, shortcut)| {
            excluded_action.map_or(true, |excluded| action.as_str() != excluded)
                && shortcut.as_str() == candidate
        })
        .map(|(action, _)| action.clone())
}

fn handle_assistant_shortcut(app: &AppHandle, _shortcut: &Shortcut, event: ShortcutEvent) {
    if assistant_enabled() && event.state == ShortcutState::Pressed {
        let _ = toggle_assistant_panel(app);
    }
}

/// 直达动作快捷键：按下时通知面板窗口跳过动作选择，并展示面板承载预览或结果。
/// 选区仍在按键瞬间由现有采集管线读取一次，符合“用户主动触发”原则。
fn handle_assistant_direct_shortcut(app: &AppHandle, action: &'static str, event: ShortcutEvent) {
    if !assistant_enabled() || event.state != ShortcutState::Pressed {
        return;
    }
    if let Err(error) = app.emit_to("assistant-panel", DIRECT_ACTION_EVENT, action) {
        append_assistant_diagnostic_log(&format!(
            "assistant: failed to emit direct action {action}: {error}"
        ));
    }
    if let Err(error) = show_assistant_panel(app, false) {
        append_assistant_diagnostic_log(&format!(
            "assistant: failed to show panel for direct action {action}: {error}"
        ));
    }
}

pub fn configure_assistant_runtime(enabled: bool, diagnostic_logging_enabled: bool) {
    ASSISTANT_ENABLED.store(enabled, Ordering::Relaxed);
    ASSISTANT_DIAGNOSTIC_LOGGING_ENABLED.store(diagnostic_logging_enabled, Ordering::Relaxed);
}

pub fn assistant_enabled() -> bool {
    ASSISTANT_ENABLED.load(Ordering::Relaxed)
}

pub fn assistant_diagnostic_logging_enabled() -> bool {
    ASSISTANT_DIAGNOSTIC_LOGGING_ENABLED.load(Ordering::Relaxed)
}

pub fn append_assistant_diagnostic_log(message: &str) {
    if assistant_diagnostic_logging_enabled() {
        crate::append_diagnostic_log(message);
    }
}

pub fn deactivate_assistant(app: &AppHandle) -> Result<(), String> {
    ASSISTANT_ENABLED.store(false, Ordering::Relaxed);
    let mut errors = Vec::new();

    for label in ["assistant-dock", "assistant-panel"] {
        if let Some(window) = app.get_webview_window(label) {
            if let Err(error) = window.hide() {
                errors.push(format!("隐藏 {label} 失败：{error}"));
            }
        }
    }

    let current = current_assistant_shortcut();
    let shortcut_released = if current.is_empty() {
        true
    } else {
        match app.global_shortcut().unregister(current.as_str()) {
            Ok(()) => true,
            Err(error) => {
                errors.push(format!("注销全局快捷键失败：{error}"));
                false
            }
        }
    };
    if shortcut_released {
        if let Ok(mut registered) = registered_shortcut().lock() {
            registered.clear();
        }
    }

    // 直达动作快捷键一并注销；处理器虽有 enabled 兜底，但不继续占用组合键。
    let direct_shortcuts = registered_direct_shortcuts()
        .lock()
        .map(|shortcuts| shortcuts.clone())
        .unwrap_or_default();
    let mut direct_released = true;
    for shortcut in direct_shortcuts.values() {
        if let Err(error) = app.global_shortcut().unregister(shortcut.as_str()) {
            errors.push(format!("注销直达快捷键 {shortcut} 失败：{error}"));
            direct_released = false;
        }
    }
    if direct_released {
        if let Ok(mut registered) = registered_direct_shortcuts().lock() {
            registered.clear();
        }
    }

    if errors.is_empty() {
        Ok(())
    } else {
        Err(errors.join("；"))
    }
}

fn normalize_assistant_shortcut(shortcut: &str) -> Result<String, String> {
    let shortcut = shortcut.trim();
    if shortcut.is_empty() || shortcut.len() > 64 {
        return Err("快捷键不能为空或超过 64 个字符".to_string());
    }

    let tokens = shortcut
        .split('+')
        .map(str::trim)
        .filter(|token| !token.is_empty())
        .collect::<Vec<_>>();
    let is_modifier = |token: &&str| {
        matches!(
            token.to_ascii_lowercase().as_str(),
            "alt"
                | "option"
                | "control"
                | "ctrl"
                | "command"
                | "cmd"
                | "super"
                | "shift"
                | "commandorcontrol"
                | "commandorctrl"
                | "cmdorctrl"
                | "cmdorcontrol"
        )
    };
    let has_modifier = tokens.iter().any(is_modifier);
    let has_regular_key = tokens.iter().any(|token| !is_modifier(token));
    if tokens.len() < 2 || !has_modifier || !has_regular_key {
        return Err("快捷键必须包含至少一个修饰键和一个普通按键".to_string());
    }

    Ok(shortcut.to_string())
}

pub fn current_assistant_shortcut() -> String {
    registered_shortcut()
        .lock()
        .map(|shortcut| shortcut.clone())
        .unwrap_or_else(|_| DEFAULT_ASSISTANT_SHORTCUT.to_string())
}

pub fn set_assistant_shortcut(app: &AppHandle, shortcut: &str) -> Result<String, String> {
    let shortcut = normalize_assistant_shortcut(shortcut)?;
    let current = current_assistant_shortcut();
    let direct_shortcuts = registered_direct_shortcuts()
        .lock()
        .map_err(|_| "直达快捷键状态暂时不可用".to_string())?;
    if let Some(action) = conflicting_direct_action(&direct_shortcuts, &shortcut, None) {
        return Err(format!("与直达动作「{action}」的快捷键冲突，请换一个组合"));
    }
    drop(direct_shortcuts);
    if current == shortcut {
        return Ok(shortcut);
    }

    app.global_shortcut()
        .on_shortcut(shortcut.as_str(), handle_assistant_shortcut)
        .map_err(|error| format!("快捷键注册失败，可能已被其他应用占用：{error}"))?;

    if !current.is_empty() {
        if let Err(error) = app.global_shortcut().unregister(current.as_str()) {
            let _ = app.global_shortcut().unregister(shortcut.as_str());
            return Err(format!("替换旧快捷键失败：{error}"));
        }
    }

    let mut registered = registered_shortcut()
        .lock()
        .map_err(|_| "快捷键状态暂时不可用".to_string())?;
    *registered = shortcut.clone();
    Ok(shortcut)
}

/// 某个直达动作当前实际注册的组合键；未注册时返回空串。
pub fn current_assistant_direct_shortcut(action: &str) -> String {
    registered_direct_shortcuts()
        .lock()
        .map(|shortcuts| shortcuts.get(action).cloned().unwrap_or_default())
        .unwrap_or_default()
}

/// 注册或注销直达动作快捷键（Some 注册 / None 注销）。
/// 注册前校验与主快捷键及其他直达动作的冲突；失败时不改变现有注册状态。
pub fn set_assistant_direct_shortcut(
    app: &AppHandle,
    action: &str,
    shortcut: Option<&str>,
) -> Result<Option<String>, String> {
    let action_static: &'static str = DIRECT_SHORTCUT_ACTIONS
        .iter()
        .copied()
        .find(|candidate| *candidate == action)
        .ok_or_else(|| format!("不支持的直达动作：{action}"))?;

    let normalized = match shortcut {
        Some(shortcut) => Some(normalize_assistant_shortcut(shortcut)?),
        None => None,
    };

    let previous = {
        let shortcuts = registered_direct_shortcuts()
            .lock()
            .map_err(|_| "直达快捷键状态暂时不可用".to_string())?;
        // 冲突检查：不允许与唤起面板快捷键或其他直达动作重复。
        if let Some(candidate) = &normalized {
            if current_assistant_shortcut() == *candidate {
                return Err("与唤起动作面板的快捷键冲突，请换一个组合".to_string());
            }
            if let Some(other) =
                conflicting_direct_action(&shortcuts, candidate, Some(action))
            {
                return Err(format!("与直达动作「{other}」的快捷键冲突，请换一个组合"));
            }
        }
        shortcuts.get(action).cloned()
    };

    if previous == normalized {
        return Ok(normalized);
    }

    if let Some(candidate) = &normalized {
        app.global_shortcut()
            .on_shortcut(candidate.as_str(), move |app, _shortcut, event| {
                handle_assistant_direct_shortcut(app, action_static, event)
            })
            .map_err(|error| format!("快捷键注册失败，可能已被其他应用占用：{error}"))?;
        if let Some(previous) = &previous {
            if let Err(error) = app.global_shortcut().unregister(previous.as_str()) {
                let _ = app.global_shortcut().unregister(candidate.as_str());
                return Err(format!("替换旧快捷键失败：{error}"));
            }
        }
    } else if let Some(previous) = &previous {
        app.global_shortcut()
            .unregister(previous.as_str())
            .map_err(|error| format!("注销直达快捷键失败：{error}"))?;
    }

    let mut shortcuts = registered_direct_shortcuts()
        .lock()
        .map_err(|_| "直达快捷键状态暂时不可用".to_string())?;
    match &normalized {
        Some(candidate) => {
            shortcuts.insert(action.to_string(), candidate.clone());
        }
        None => {
            shortcuts.remove(action);
        }
    }
    Ok(normalized)
}

pub fn show_assistant_panel(app: &AppHandle, request_capture: bool) -> Result<(), String> {
    if !assistant_enabled() {
        return Err("桌面助手已关闭，请先在设置中启用".to_string());
    }
    let window = app
        .get_webview_window("assistant-panel")
        .ok_or_else(|| "Panel window not found".to_string())?;

    if request_capture {
        app.emit_to("assistant-panel", CAPTURE_REQUEST_EVENT, "selection")
            .map_err(|error| error.to_string())?;
    }
    position_assistant_panel(app);
    // 不主动抢焦点，确保辅助功能读取的仍是第三方前台应用；用户点击面板后仍可正常交互。
    window.show().map_err(|error| error.to_string())
}

/// 面板在锚点附近的展开位置（均为物理像素坐标）：
/// 水平方向默认向锚点左侧展开，放不下时翻转到右侧；
/// 垂直方向默认与锚点顶部对齐向下展开，超出下边缘时向上翻转与锚点底部对齐；
/// 最后夹取到显示器内，保证面板不会完全移出可见区域。
fn panel_position_near_anchor(
    anchor: (i32, i32, i32, i32),
    monitor: (i32, i32, i32, i32),
    panel: (i32, i32),
    gap: i32,
) -> (i32, i32) {
    let (anchor_x, anchor_y, anchor_width, anchor_height) = anchor;
    let (monitor_x, monitor_y, monitor_width, monitor_height) = monitor;
    let (panel_width, panel_height) = panel;

    let mut x = anchor_x - panel_width - gap;
    if x < monitor_x {
        x = anchor_x + anchor_width + gap;
    }
    let mut y = anchor_y;
    if y + panel_height > monitor_y + monitor_height {
        y = anchor_y + anchor_height - panel_height;
    }

    let max_x = monitor_x + monitor_width - panel_width;
    let max_y = monitor_y + monitor_height - panel_height;
    // 面板比显示器还大时钉在显示器原点，保证左上角可见。
    let x = if max_x < monitor_x {
        monitor_x
    } else {
        x.clamp(monitor_x, max_x)
    };
    let y = if max_y < monitor_y {
        monitor_y
    } else {
        y.clamp(monitor_y, max_y)
    };
    (x, y)
}

fn point_in_monitor(point: (i32, i32), monitor: &tauri::Monitor) -> bool {
    let position = monitor.position();
    let size = monitor.size();
    point.0 >= position.x
        && point.0 < position.x + size.width as i32
        && point.1 >= position.y
        && point.1 < position.y + size.height as i32
}

fn frame_inside_monitor_work_area(frame: (i32, i32, i32, i32), monitor: &tauri::Monitor) -> bool {
    let work_area = monitor.work_area();
    let right = work_area.position.x + work_area.size.width as i32;
    let bottom = work_area.position.y + work_area.size.height as i32;
    frame.0 >= work_area.position.x
        && frame.1 >= work_area.position.y
        && frame.0 + frame.2 <= right
        && frame.1 + frame.3 <= bottom
}

fn clamp_window_position(
    preferred: (i32, i32),
    area: (i32, i32, i32, i32),
    window: (i32, i32),
) -> (i32, i32) {
    let max_x = area.0 + area.2 - window.0;
    let max_y = area.1 + area.3 - window.1;
    (
        if max_x < area.0 {
            area.0
        } else {
            preferred.0.clamp(area.0, max_x)
        },
        if max_y < area.1 {
            area.1
        } else {
            preferred.1.clamp(area.1, max_y)
        },
    )
}

/// 把动作面板定位到触发它所在的显示器：
/// 桌面小妍可见时以它为锚点，否则以全局光标为锚点（快捷键触发场景）。
fn position_assistant_panel(app: &AppHandle) {
    const PANEL_ANCHOR_GAP: i32 = 12;
    let Some(panel) = app.get_webview_window("assistant-panel") else {
        return;
    };
    let Ok(panel_size) = panel.outer_size() else {
        return;
    };

    let dock = app.get_webview_window("assistant-dock");
    let dock_anchor = dock
        .filter(|dock| dock.is_visible().unwrap_or(false))
        .and_then(|dock| {
            let position = dock.outer_position().ok()?;
            let size = dock.outer_size().ok()?;
            Some((position.x, position.y, size.width as i32, size.height as i32))
        });
    let anchor = dock_anchor.or_else(|| {
        panel
            .cursor_position()
            .ok()
            .map(|cursor| (cursor.x as i32, cursor.y as i32, 0, 0))
    });
    let Some(anchor) = anchor else {
        return;
    };

    let anchor_center = (anchor.0 + anchor.2 / 2, anchor.1 + anchor.3 / 2);
    let monitors = app.available_monitors().unwrap_or_default();
    let monitor = monitors
        .iter()
        .find(|monitor| point_in_monitor(anchor_center, monitor))
        .cloned()
        .or_else(|| app.primary_monitor().ok().flatten());
    let Some(monitor) = monitor else {
        return;
    };
    let work_area = monitor.work_area();
    let (x, y) = panel_position_near_anchor(
        anchor,
        (
            work_area.position.x,
            work_area.position.y,
            work_area.size.width as i32,
            work_area.size.height as i32,
        ),
        (panel_size.width as i32, panel_size.height as i32),
        PANEL_ANCHOR_GAP,
    );
    let _ = panel.set_position(PhysicalPosition::new(x, y));
}

pub fn toggle_assistant_panel(app: &AppHandle) -> Result<bool, String> {
    if !assistant_enabled() {
        return Err("桌面助手已关闭，请先在设置中启用".to_string());
    }
    let window = app
        .get_webview_window("assistant-panel")
        .ok_or_else(|| "Panel window not found".to_string())?;

    if window.is_visible().map_err(|error| error.to_string())? {
        window.hide().map_err(|error| error.to_string())?;
        Ok(false)
    } else {
        show_assistant_panel(app, true)?;
        Ok(true)
    }
}

fn position_dock(app: &AppHandle) {
    let Some(window) = app.get_webview_window("assistant-dock") else {
        return;
    };
    let main_window = app.get_webview_window("main");
    let monitor = main_window
        .as_ref()
        .and_then(|main| main.current_monitor().ok().flatten())
        .or_else(|| window.primary_monitor().ok().flatten());
    let Some(monitor) = monitor else {
        return;
    };
    let work_area = monitor.work_area();

    let (preferred_x, preferred_y) = main_window
        .and_then(|main| Some((main.outer_position().ok()?, main.outer_size().ok()?)))
        .map(|(position, main_size)| {
            (
                position.x + main_size.width as i32 - 48,
                position.y + main_size.height as i32 - ASSISTANT_DOCK_HEIGHT - 20,
            )
        })
        .unwrap_or((
            work_area.position.x + work_area.size.width as i32 - ASSISTANT_DOCK_WIDTH - 16,
            work_area.position.y + work_area.size.height as i32 - ASSISTANT_DOCK_HEIGHT - 20,
        ));

    let (x, y) = clamp_window_position(
        (preferred_x, preferred_y),
        (
            work_area.position.x,
            work_area.position.y,
            work_area.size.width as i32,
            work_area.size.height as i32,
        ),
        (ASSISTANT_DOCK_WIDTH, ASSISTANT_DOCK_HEIGHT),
    );
    let _ = window.set_position(PhysicalPosition::new(x, y));
}

fn persist_dock_visibility(app: &AppHandle, visible: bool) {
    let Some(state) = app.try_state::<AppState>() else {
        return;
    };
    let state = state.inner().clone();
    tauri::async_runtime::spawn(async move {
        let value = if visible { "true" } else { "false" };
        if let Err(error) = settings_service::update_settings(
            &state,
            &serde_json::json!({ "assistant_dock_enabled": value }),
        )
        .await
        {
            append_assistant_diagnostic_log(&format!(
                "assistant: failed to persist dock visibility: {error}"
            ));
        }
    });
}

fn persist_assistant_shortcut(app: &AppHandle, shortcut: String) {
    let Some(state) = app.try_state::<AppState>() else {
        return;
    };
    let state = state.inner().clone();
    tauri::async_runtime::spawn(async move {
        if let Err(error) = settings_service::update_settings(
            &state,
            &serde_json::json!({ "assistant_shortcut": shortcut }),
        )
        .await
        {
            append_assistant_diagnostic_log(&format!(
                "assistant: failed to persist shortcut fallback: {error}"
            ));
        }
    });
}

fn persist_shortcut_diagnostic(
    app: &AppHandle,
    requested_shortcut: &str,
    active_shortcut: Option<String>,
    message: String,
) {
    let Some(state) = app.try_state::<AppState>() else {
        return;
    };
    let diagnostic = AssistantShortcutDiagnostic {
        status: if active_shortcut.is_some() {
            "degraded".to_string()
        } else {
            "error".to_string()
        },
        requested_shortcut: requested_shortcut.to_string(),
        active_shortcut,
        message,
        updated_at: chrono::Utc::now().to_rfc3339(),
    };
    if let Err(error) = tauri::async_runtime::block_on(
        crate::services::desktop_assistant::AssistantPreferenceService::save_shortcut_diagnostic(
            &state.db,
            &diagnostic,
        ),
    ) {
        append_assistant_diagnostic_log(&format!(
            "assistant: failed to persist shortcut diagnostic: {error}"
        ));
    }
}

fn persist_direct_shortcut_diagnostic(app: &AppHandle, action: &str, shortcut: &str, message: String) {
    let Some(state) = app.try_state::<AppState>() else {
        return;
    };
    let diagnostic = AssistantShortcutDiagnostic {
        status: "error".to_string(),
        requested_shortcut: shortcut.to_string(),
        active_shortcut: None,
        message,
        updated_at: chrono::Utc::now().to_rfc3339(),
    };
    if let Err(error) = tauri::async_runtime::block_on(
        crate::services::desktop_assistant::AssistantPreferenceService::save_direct_shortcut_diagnostic(
            &state.db,
            action,
            &diagnostic,
        ),
    ) {
        append_assistant_diagnostic_log(&format!(
            "assistant: failed to persist direct shortcut diagnostic: {error}"
        ));
    }
}

fn clear_shortcut_diagnostic_if_recovered(app: &AppHandle, recovered_shortcut: &str) {
    let Some(state) = app.try_state::<AppState>() else {
        return;
    };
    let result = tauri::async_runtime::block_on(async {
        let diagnostic =
            crate::services::desktop_assistant::AssistantPreferenceService::load_shortcut_diagnostic(
                &state.db,
            )
            .await?;
        if diagnostic.is_some_and(|diagnostic| diagnostic.requested_shortcut == recovered_shortcut)
        {
            crate::services::desktop_assistant::AssistantPreferenceService::clear_shortcut_diagnostic(
                &state.db,
            )
            .await?;
        }
        Ok::<(), anyhow::Error>(())
    });
    if let Err(error) = result {
        append_assistant_diagnostic_log(&format!(
            "assistant: failed to clear shortcut diagnostic: {error}"
        ));
    }
}

/// 清除持久化站位后，把桌面小妍恢复到默认位置。
pub fn reset_assistant_dock_position(app: &AppHandle) {
    position_dock(app);
}

/// 桌面小妍当前是否完整位于某台显示器的可用区域内。
fn dock_inside_any_work_area(app: &AppHandle) -> bool {
    let Some(window) = app.get_webview_window("assistant-dock") else {
        return false;
    };
    let (Ok(position), Ok(size)) = (window.outer_position(), window.outer_size()) else {
        return false;
    };
    let frame = (
        position.x,
        position.y,
        size.width as i32,
        size.height as i32,
    );
    app.available_monitors()
        .map(|monitors| {
            monitors
                .iter()
                .any(|monitor| frame_inside_monitor_work_area(frame, monitor))
        })
        .unwrap_or(false)
}

/// 安全恢复：当显示器断开或系统 Dock / 菜单栏变化导致站位越界时，迁移回默认位置。
fn ensure_dock_on_screen(app: &AppHandle) {
    if !dock_inside_any_work_area(app) {
        position_dock(app);
    }
}

pub fn set_assistant_dock_visible(app: &AppHandle, visible: bool) -> Result<(), String> {
    if visible && !assistant_enabled() {
        return Err("桌面助手已关闭，请先在设置中启用".to_string());
    }
    let window = app
        .get_webview_window("assistant-dock")
        .ok_or_else(|| "Dock window not found".to_string())?;

    if visible {
        ensure_dock_on_screen(app);
        window.show().map_err(|error| error.to_string())?;
    } else {
        window.hide().map_err(|error| error.to_string())?;
    }

    let _ = app.emit_to("main", "assistant://dock-visibility", visible);
    persist_dock_visibility(app, visible);
    Ok(())
}

fn setup_assistant(app: &mut App) {
    #[cfg(not(target_os = "macos"))]
    {
        let _ = app;
        return;
    }

    #[cfg(target_os = "macos")]
    {
        let handle = app.handle().clone();

        if let Some(dock) = app.get_webview_window("assistant-dock") {
            let _ = dock.set_focusable(false);
            let _ = dock.set_visible_on_all_workspaces(true);
            let _ = dock.set_shadow(false);
            let _ = dock.set_background_color(Some(Color(0, 0, 0, 0)));
            position_dock(&handle);
            let dock_enabled = app
                .try_state::<AppState>()
                .map(|state| {
                    tauri::async_runtime::block_on(async {
                        state
                            .settings
                            .read()
                            .await
                            .get("assistant_dock_enabled")
                            .is_some_and(|value| value == "true")
                    })
                })
                .unwrap_or(false);
            if assistant_enabled() && dock_enabled {
                let _ = dock.show();
            } else {
                let _ = dock.hide();
            }
        }
        if let Some(panel) = app.get_webview_window("assistant-panel") {
            let _ = panel.set_visible_on_all_workspaces(true);
        }

        let configured_shortcut = app
            .try_state::<AppState>()
            .map(|state| {
                tauri::async_runtime::block_on(async {
                    state
                        .settings
                        .read()
                        .await
                        .get("assistant_shortcut")
                        .cloned()
                        .unwrap_or_else(|| DEFAULT_ASSISTANT_SHORTCUT.to_string())
                })
            })
            .unwrap_or_else(|| DEFAULT_ASSISTANT_SHORTCUT.to_string());

        if !assistant_enabled() {
            return;
        }

        match set_assistant_shortcut(&handle, &configured_shortcut) {
            Ok(_) => clear_shortcut_diagnostic_if_recovered(&handle, &configured_shortcut),
            Err(error) => {
                append_assistant_diagnostic_log(&format!(
                    "assistant: failed to register {configured_shortcut}: {error}"
                ));
                if configured_shortcut != DEFAULT_ASSISTANT_SHORTCUT {
                    match set_assistant_shortcut(&handle, DEFAULT_ASSISTANT_SHORTCUT) {
                        Ok(fallback) => {
                            persist_assistant_shortcut(&handle, fallback.clone());
                            persist_shortcut_diagnostic(
                                &handle,
                                &configured_shortcut,
                                Some(fallback),
                                error,
                            );
                        }
                        Err(fallback_error) => {
                            let message =
                                format!("{error}；默认快捷键也注册失败：{fallback_error}");
                            append_assistant_diagnostic_log(&format!(
                                "assistant: failed to register fallback {DEFAULT_ASSISTANT_SHORTCUT}: {fallback_error}"
                            ));
                            persist_shortcut_diagnostic(
                                &handle,
                                &configured_shortcut,
                                None,
                                message,
                            );
                        }
                    }
                } else {
                    persist_shortcut_diagnostic(&handle, &configured_shortcut, None, error);
                }
            }
        }

        // 直达动作快捷键（P1-1）：默认不注册，仅恢复用户显式开启过的组合。
        // 注册失败只记录按动作的诊断，不做键位回退，也不影响主快捷键。
        let configured_direct = app
            .try_state::<AppState>()
            .map(|state| {
                tauri::async_runtime::block_on(async {
                    crate::services::desktop_assistant::AssistantPreferenceService::load_direct_shortcuts(
                        &state.db,
                    )
                    .await
                    .unwrap_or_default()
                })
            })
            .unwrap_or_default();
        for (action, shortcut) in configured_direct {
            if let Err(error) = set_assistant_direct_shortcut(&handle, &action, Some(&shortcut)) {
                append_assistant_diagnostic_log(&format!(
                    "assistant: failed to register direct shortcut {action}={shortcut}: {error}"
                ));
                persist_direct_shortcut_diagnostic(&handle, &action, &shortcut, error);
            }
        }
    }
}

fn setup_tray(app: &mut App) -> anyhow::Result<()> {
    let show_item = MenuItem::with_id(app, "show", "显示主窗口", true, None::<&str>)?;
    let assistant_item = MenuItem::with_id(app, "assistant", "显示桌面小妍", true, None::<&str>)?;
    let close_assistant_item =
        MenuItem::with_id(app, "close-assistant", "关闭桌面小妍", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
    let menu = Menu::with_items(
        app,
        &[
            &show_item,
            &assistant_item,
            &close_assistant_item,
            &quit_item,
        ],
    )?;
    let icon = tauri::include_image!("./icons/xiaoyan-tray.png");

    TrayIconBuilder::new()
        .icon(icon)
        .tooltip("小妍")
        .menu(&menu)
        .on_menu_event(move |app, event| match event.id.as_ref() {
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "assistant" => {
                if assistant_enabled() {
                    let _ = set_assistant_dock_visible(app, true);
                    let _ = show_assistant_panel(app, true);
                } else if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "close-assistant" => {
                let _ = set_assistant_dock_visible(app, false);
                if let Some(panel) = app.get_webview_window("assistant-panel") {
                    let _ = panel.hide();
                }
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let tauri::tray::TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                if let Some(window) = tray.app_handle().get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)?;
    Ok(())
}

pub fn setup(app: &mut App) -> anyhow::Result<()> {
    setup_assistant(app);
    setup_tray(app)
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use super::{
        clamp_window_position, conflicting_direct_action, normalize_assistant_shortcut,
        panel_position_near_anchor,
    };

    #[test]
    fn assistant_shortcut_requires_modifier_and_key() {
        assert_eq!(
            normalize_assistant_shortcut(" Alt+Space ").unwrap(),
            "Alt+Space"
        );
        assert!(normalize_assistant_shortcut("Space").is_err());
        assert!(normalize_assistant_shortcut("Alt").is_err());
        assert!(normalize_assistant_shortcut("Alt+Shift").is_err());
        assert!(normalize_assistant_shortcut("").is_err());
    }

    #[test]
    fn assistant_shortcut_detects_direct_action_conflicts() {
        let shortcuts = HashMap::from([
            ("interpret".to_string(), "Alt+1".to_string()),
            ("translate".to_string(), "Alt+2".to_string()),
        ]);
        assert_eq!(
            conflicting_direct_action(&shortcuts, "Alt+1", None).as_deref(),
            Some("interpret")
        );
        assert_eq!(
            conflicting_direct_action(&shortcuts, "Alt+1", Some("interpret")),
            None
        );
    }

    const MONITOR: (i32, i32, i32, i32) = (0, 0, 2560, 1440);
    const PANEL: (i32, i32) = (400, 360);
    const DOCK: (i32, i32) = (128, 136);

    #[test]
    fn dock_position_stays_inside_the_monitor_work_area() {
        // 该显示器底部 96px 被系统 Dock 占用，可用区域在 y=48..1344。
        let work_area = (0, 48, 2560, 1296);
        let position = clamp_window_position((2600, 1400), work_area, DOCK);
        assert_eq!(position, (2560 - DOCK.0, 1344 - DOCK.1));
    }

    #[test]
    fn panel_flips_left_when_anchor_is_near_the_right_edge() {
        // 桌面小妍停在右下角：面板应向其左侧展开，并与小妍顶部对齐。
        let anchor = (2560 - DOCK.0 - 16, 700, DOCK.0, DOCK.1);
        let (x, y) = panel_position_near_anchor(anchor, MONITOR, PANEL, 12);
        assert_eq!(x, anchor.0 - PANEL.0 - 12);
        assert_eq!(y, 700);
    }

    #[test]
    fn panel_flips_right_when_anchor_is_near_the_left_edge() {
        let anchor = (0, 300, DOCK.0, DOCK.1);
        let (x, y) = panel_position_near_anchor(anchor, MONITOR, PANEL, 12);
        assert_eq!(x, anchor.0 + DOCK.0 + 12);
        assert_eq!(y, 300);
    }

    #[test]
    fn panel_flips_upward_when_anchor_is_near_the_bottom_edge() {
        let anchor = (1200, 1440 - DOCK.1 - 8, DOCK.0, DOCK.1);
        let (x, y) = panel_position_near_anchor(anchor, MONITOR, PANEL, 12);
        assert_eq!(y, anchor.1 + DOCK.1 - PANEL.1);
        assert!(y + PANEL.1 <= MONITOR.1 + MONITOR.3);
        // 左右都有空间时保持默认向左展开
        assert_eq!(x, anchor.0 - PANEL.0 - 12);
    }

    #[test]
    fn panel_stays_inside_a_monitor_smaller_than_the_panel() {
        let tiny_monitor = (100, 100, 320, 300);
        let anchor = (100, 100, DOCK.0, DOCK.1);
        let (x, y) = panel_position_near_anchor(anchor, tiny_monitor, PANEL, 12);
        // 面板比显示器还大：钉在显示器原点，保证左上角可见
        assert_eq!((x, y), (tiny_monitor.0, tiny_monitor.1));
    }

    #[test]
    fn panel_uses_cursor_anchor_on_a_negative_coordinate_monitor() {
        let left_monitor = (-1920, 0, 1920, 1080);
        let cursor_anchor = (-100, 500, 0, 0);
        let (x, y) = panel_position_near_anchor(cursor_anchor, left_monitor, PANEL, 12);
        // 光标左侧仍有空间：默认向左展开并保持在该显示器内
        assert_eq!(x, -100 - PANEL.0 - 12);
        assert!(x >= left_monitor.0);
        assert!(y >= left_monitor.1);
        assert!(y + PANEL.1 <= left_monitor.1 + left_monitor.3);
        // 光标贴近左边缘时翻转到右侧展开
        let near_left = (-1900, 500, 0, 0);
        let (flipped_x, _) = panel_position_near_anchor(near_left, left_monitor, PANEL, 12);
        assert_eq!(flipped_x, -1900 + 12);
    }
}
