//! Main-window navigation requested by the companion's native menu.

use tauri::{command, Emitter, Manager};

pub(super) fn focus_main_window(app: &tauri::AppHandle) -> Result<(), String> {
    let main = app
        .get_window("main")
        .ok_or_else(|| "主窗口尚未创建".to_string())?;
    main.show().map_err(|error| error.to_string())?;
    let _ = main.unminimize();
    main.set_focus().map_err(|error| error.to_string())
}

#[command]
pub fn assistant_open_settings(app: tauri::AppHandle) -> Result<(), String> {
    focus_main_window(&app)?;
    app.emit_to("main", "assistant:open-settings", ())
        .map_err(|error| error.to_string())
}
