//! 桌面助手跨显示器截图选区命令。

use std::sync::Arc;
use std::time::Duration;

use base64::Engine;
use tauri::{command, Emitter, Manager, State};

use crate::commands::desktop_assistant::{
    capture_response, ensure_assistant_enabled, CaptureContextResponse,
};
use crate::platform::desktop_assistant::trait_platform::CaptureRegionRequest;
use crate::services::desktop_assistant::capture_overlay_drag::{
    CaptureOverlayCoordinator, CaptureOverlayDragState, CaptureOverlayPoint,
    CaptureOverlaySelection, CaptureOverlayTimeoutCheck, CAPTURE_OVERLAY_DRAG_STATE_EVENT,
    CAPTURE_OVERLAY_DRAG_TIMEOUT,
};
use crate::services::desktop_assistant::capture_service::{
    CaptureResult, CaptureService, CaptureStatus, ContextSourceType,
};
use crate::services::desktop_assistant::capture_store::CaptureStore;
use crate::services::desktop_assistant::content_policy::retained_window_title;
use crate::services::desktop_assistant::{AssistantPreferenceService, PermissionService};
use crate::state::AppState;

pub const CAPTURE_OVERLAY_LABEL_PREFIX: &str = "assistant-capture-overlay";
const CAPTURE_OVERLAY_REQUEST_TIMEOUT: Duration = Duration::from_secs(300);

fn close_capture_overlay_windows(app: &tauri::AppHandle) {
    for (label, window) in app.webview_windows() {
        if label.starts_with(CAPTURE_OVERLAY_LABEL_PREFIX) {
            let _ = window.close();
        }
    }
}

fn open_capture_overlay_windows(app: &tauri::AppHandle) -> Result<(), String> {
    let monitors = app
        .available_monitors()
        .map_err(|error| error.to_string())?;
    if monitors.is_empty() {
        return Err("未检测到可用显示器".to_string());
    }
    for (index, monitor) in monitors.iter().enumerate() {
        let label = format!("{CAPTURE_OVERLAY_LABEL_PREFIX}-{index}");
        if let Some(existing) = app.get_webview_window(&label) {
            let _ = existing.close();
        }
        let scale = monitor.scale_factor();
        let position = monitor.position();
        let size = monitor.size();
        tauri::WebviewWindowBuilder::new(app, &label, tauri::WebviewUrl::App("index.html".into()))
            .title("")
            .decorations(false)
            .transparent(true)
            .shadow(false)
            .always_on_top(true)
            .skip_taskbar(true)
            .resizable(false)
            .accept_first_mouse(true)
            .focused(index == 0)
            .position(f64::from(position.x) / scale, f64::from(position.y) / scale)
            .inner_size(
                f64::from(size.width) / scale,
                f64::from(size.height) / scale,
            )
            .build()
            .map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn broadcast_drag_state(app: &tauri::AppHandle, state: &CaptureOverlayDragState) {
    let _ = app.emit(CAPTURE_OVERLAY_DRAG_STATE_EVENT, state);
}

fn start_drag_timeout_watch(
    coordinator: Arc<CaptureOverlayCoordinator>,
    app: tauri::AppHandle,
    session_id: String,
) {
    tauri::async_runtime::spawn(async move {
        loop {
            tokio::time::sleep(Duration::from_secs(1)).await;
            match coordinator.check_drag_timeout(&session_id, CAPTURE_OVERLAY_DRAG_TIMEOUT) {
                CaptureOverlayTimeoutCheck::Active => {}
                CaptureOverlayTimeoutCheck::Finished => break,
                CaptureOverlayTimeoutCheck::TimedOut(state) => {
                    broadcast_drag_state(&app, &state);
                    break;
                }
            }
        }
    });
}

#[command]
pub async fn assistant_capture_screen_overlay(
    state: State<'_, AppState>,
    app: tauri::AppHandle,
) -> Result<CaptureContextResponse, String> {
    ensure_assistant_enabled()?;
    let preferences = AssistantPreferenceService::load_privacy(&state.db)
        .await
        .map_err(|error| error.to_string())?;
    let (source_app, source_app_bundle_id, window_title) = CaptureService::get_frontmost_app()
        .await
        .map_err(|error| error.to_string())?;
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

    let (sender, receiver) = tokio::sync::oneshot::channel::<CaptureOverlaySelection>();
    let request_id = state.capture_overlay.begin_request(sender)?;
    if let Some(panel) = app.get_webview_window("assistant-panel") {
        let _ = panel.hide();
    }
    if let Err(error) = open_capture_overlay_windows(&app) {
        state.capture_overlay.finish_request(request_id);
        close_capture_overlay_windows(&app);
        let _ = crate::desktop_shell::show_assistant_panel(&app, false);
        return Err(error);
    }

    let selection = tokio::time::timeout(CAPTURE_OVERLAY_REQUEST_TIMEOUT, receiver).await;
    state.capture_overlay.finish_request(request_id);
    close_capture_overlay_windows(&app);
    let _ = crate::desktop_shell::show_assistant_panel(&app, false);

    let region = match selection {
        Ok(Ok(CaptureOverlaySelection::Submitted(region))) => region,
        Ok(Ok(CaptureOverlaySelection::Cancelled)) => return Err("截图已取消".to_string()),
        Ok(Ok(CaptureOverlaySelection::TimedOut)) => {
            return Err("截图框选长时间无操作，请重试".to_string())
        }
        _ => return Err("截图选区已超时，请重试".to_string()),
    };
    let capture = CaptureService::capture_screen_region(region)
        .await
        .map_err(|error| error.to_string())?;
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

#[command]
pub async fn assistant_capture_overlay_submit(
    state: State<'_, AppState>,
    region: CaptureRegionRequest,
) -> Result<(), String> {
    state.capture_overlay.submit_region(region)
}

#[command]
pub async fn assistant_capture_overlay_cancel(
    state: State<'_, AppState>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    if let Some(state) = state.capture_overlay.cancel_drag()? {
        broadcast_drag_state(&app, &state);
    }
    Ok(())
}

#[command]
pub async fn assistant_capture_overlay_drag_start(
    state: State<'_, AppState>,
    app: tauri::AppHandle,
    x: f64,
    y: f64,
    display_index: usize,
) -> Result<CaptureOverlayDragState, String> {
    let session_id = uuid::Uuid::new_v4().to_string();
    let (drag, started) = state.capture_overlay.start_drag(
        session_id,
        CaptureOverlayPoint { x, y },
        display_index,
    )?;
    broadcast_drag_state(&app, &drag);
    if started {
        start_drag_timeout_watch(state.capture_overlay.clone(), app, drag.session_id.clone());
    }
    Ok(drag)
}

#[command]
pub async fn assistant_capture_overlay_drag_move(
    state: State<'_, AppState>,
    app: tauri::AppHandle,
    x: f64,
    y: f64,
) -> Result<Option<CaptureOverlayDragState>, String> {
    let drag = state
        .capture_overlay
        .move_drag(CaptureOverlayPoint { x, y })?;
    if let Some(ref drag) = drag {
        broadcast_drag_state(&app, drag);
    }
    Ok(drag)
}

#[command]
pub async fn assistant_capture_overlay_drag_end(
    state: State<'_, AppState>,
    app: tauri::AppHandle,
    x: f64,
    y: f64,
) -> Result<Option<CaptureOverlayDragState>, String> {
    let drag = state
        .capture_overlay
        .end_drag(CaptureOverlayPoint { x, y })?;
    if let Some(ref drag) = drag {
        broadcast_drag_state(&app, drag);
    }
    Ok(drag)
}

#[command]
pub async fn assistant_capture_overlay_drag_cancel(
    state: State<'_, AppState>,
    app: tauri::AppHandle,
) -> Result<Option<CaptureOverlayDragState>, String> {
    let drag = state.capture_overlay.cancel_drag()?;
    if let Some(ref drag) = drag {
        broadcast_drag_state(&app, drag);
    }
    Ok(drag)
}
