//! Desktop shell integration: tray, assistant windows and global shortcut.

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder},
    window::Color,
    App, AppHandle, Emitter, Manager, PhysicalPosition,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

use crate::{services::settings_service, state::AppState};

const DEFAULT_ASSISTANT_SHORTCUT: &str = "Alt+Space";
const CAPTURE_REQUEST_EVENT: &str = "assistant://capture-request";
const ASSISTANT_DOCK_WIDTH: i32 = 128;
const ASSISTANT_DOCK_HEIGHT: i32 = 136;

pub fn show_assistant_panel(app: &AppHandle, request_capture: bool) -> Result<(), String> {
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
            crate::append_diagnostic_log(&format!(
                "assistant: failed to persist dock visibility: {error}"
            ));
        }
    });
}

pub fn set_assistant_dock_visible(app: &AppHandle, visible: bool) -> Result<(), String> {
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
            if dock_enabled {
                let _ = dock.show();
            } else {
                let _ = dock.hide();
            }
        }
        if let Some(panel) = app.get_webview_window("assistant-panel") {
            let _ = panel.set_visible_on_all_workspaces(true);
        }

        if let Err(error) = app.global_shortcut().on_shortcut(
            DEFAULT_ASSISTANT_SHORTCUT,
            |app, _shortcut, event| {
                if event.state == ShortcutState::Pressed {
                    let _ = toggle_assistant_panel(app);
                }
            },
        ) {
            crate::append_diagnostic_log(&format!(
                "assistant: failed to register {DEFAULT_ASSISTANT_SHORTCUT}: {error}"
            ));
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
                let _ = set_assistant_dock_visible(app, true);
                let _ = show_assistant_panel(app, true);
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
