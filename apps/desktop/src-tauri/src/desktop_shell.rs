//! Desktop shell integration: tray, assistant windows and global shortcut.

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
        desktop_assistant::preference_service::AssistantShortcutDiagnostic, settings_service,
    },
    state::AppState,
};

const DEFAULT_ASSISTANT_SHORTCUT: &str = "Alt+Space";
const CAPTURE_REQUEST_EVENT: &str = "assistant://capture-request";
const ASSISTANT_DOCK_WIDTH: i32 = 128;
const ASSISTANT_DOCK_HEIGHT: i32 = 136;
static REGISTERED_ASSISTANT_SHORTCUT: OnceLock<Mutex<String>> = OnceLock::new();
static ASSISTANT_ENABLED: AtomicBool = AtomicBool::new(true);
static ASSISTANT_DIAGNOSTIC_LOGGING_ENABLED: AtomicBool = AtomicBool::new(false);

fn registered_shortcut() -> &'static Mutex<String> {
    REGISTERED_ASSISTANT_SHORTCUT.get_or_init(|| Mutex::new(String::new()))
}

fn handle_assistant_shortcut(app: &AppHandle, _shortcut: &Shortcut, event: ShortcutEvent) {
    if assistant_enabled() && event.state == ShortcutState::Pressed {
        let _ = toggle_assistant_panel(app);
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
    let has_modifier = tokens.iter().any(|token| {
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
    });
    if tokens.len() < 2 || !has_modifier {
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
    // 不主动抢焦点，确保辅助功能读取的仍是第三方前台应用；用户点击面板后仍可正常交互。
    window.show().map_err(|error| error.to_string())
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
    let origin = monitor.position();
    let size = monitor.size();

    let (preferred_x, preferred_y) = main_window
        .and_then(|main| Some((main.outer_position().ok()?, main.outer_size().ok()?)))
        .map(|(position, main_size)| {
            (
                position.x + main_size.width as i32 - 48,
                position.y + main_size.height as i32 - ASSISTANT_DOCK_HEIGHT,
            )
        })
        .unwrap_or((
            origin.x + size.width as i32 - ASSISTANT_DOCK_WIDTH - 16,
            origin.y + size.height as i32 - ASSISTANT_DOCK_HEIGHT - 20,
        ));

    let x = preferred_x.clamp(
        origin.x,
        origin.x + size.width as i32 - ASSISTANT_DOCK_WIDTH,
    );
    let y = preferred_y.clamp(
        origin.y,
        origin.y + size.height as i32 - ASSISTANT_DOCK_HEIGHT,
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

pub fn set_assistant_dock_visible(app: &AppHandle, visible: bool) -> Result<(), String> {
    if visible && !assistant_enabled() {
        return Err("桌面助手已关闭，请先在设置中启用".to_string());
    }
    let window = app
        .get_webview_window("assistant-dock")
        .ok_or_else(|| "Dock window not found".to_string())?;

    if visible {
        position_dock(app);
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
    use super::normalize_assistant_shortcut;

    #[test]
    fn assistant_shortcut_requires_modifier_and_key() {
        assert_eq!(
            normalize_assistant_shortcut(" Alt+Space ").unwrap(),
            "Alt+Space"
        );
        assert!(normalize_assistant_shortcut("Space").is_err());
        assert!(normalize_assistant_shortcut("Alt").is_err());
        assert!(normalize_assistant_shortcut("").is_err());
    }
}
