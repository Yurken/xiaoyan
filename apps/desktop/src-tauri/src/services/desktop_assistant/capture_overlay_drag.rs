//! 跨 WebView 截图拖动协调器：维护唯一等待请求、全局逻辑坐标和超时状态。

use std::sync::Mutex;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use serde::Serialize;
use tokio::sync::oneshot;

use crate::platform::desktop_assistant::trait_platform::CaptureRegionRequest;

pub const CAPTURE_OVERLAY_DRAG_TIMEOUT: Duration = Duration::from_secs(60);
pub const CAPTURE_OVERLAY_MIN_LOGICAL_SIZE: f64 = 4.0;
pub const CAPTURE_OVERLAY_DRAG_STATE_EVENT: &str = "assistant://capture-overlay-drag-state";

#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptureOverlayPoint {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptureOverlayRect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum CaptureOverlayDragPhase {
    Dragging,
    Submitted,
    Cancelled,
    TimedOut,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptureOverlayDragState {
    pub session_id: String,
    pub phase: CaptureOverlayDragPhase,
    pub start: CaptureOverlayPoint,
    pub current: CaptureOverlayPoint,
    pub display_index: usize,
    pub region: Option<CaptureOverlayRect>,
    pub updated_at_ms: u64,
    #[serde(skip)]
    last_activity: Instant,
}

pub enum CaptureOverlayTimeoutCheck {
    Active,
    Finished,
    TimedOut(CaptureOverlayDragState),
}

#[derive(Debug, Clone, PartialEq)]
pub enum CaptureOverlaySelection {
    Submitted(CaptureRegionRequest),
    Cancelled,
    TimedOut,
}

struct CaptureOverlayInner {
    next_request_id: u64,
    active_request_id: Option<u64>,
    pending: Option<oneshot::Sender<CaptureOverlaySelection>>,
    drag: Option<CaptureOverlayDragState>,
}

impl Default for CaptureOverlayInner {
    fn default() -> Self {
        Self {
            next_request_id: 1,
            active_request_id: None,
            pending: None,
            drag: None,
        }
    }
}

#[derive(Default)]
pub struct CaptureOverlayCoordinator {
    inner: Mutex<CaptureOverlayInner>,
}

impl CaptureOverlayCoordinator {
    pub fn begin_request(
        &self,
        sender: oneshot::Sender<CaptureOverlaySelection>,
    ) -> Result<u64, String> {
        let mut inner = self
            .inner
            .lock()
            .map_err(|_| "截图选区协调器状态异常".to_string())?;
        if inner.active_request_id.is_some() {
            return Err("已有截图选区正在进行，请先完成或取消".to_string());
        }
        let request_id = inner.next_request_id;
        inner.next_request_id = inner.next_request_id.wrapping_add(1).max(1);
        inner.active_request_id = Some(request_id);
        inner.pending = Some(sender);
        inner.drag = None;
        Ok(request_id)
    }

    pub fn finish_request(&self, request_id: u64) {
        let sender = self.inner.lock().ok().and_then(|mut inner| {
            if inner.active_request_id != Some(request_id) {
                return None;
            }
            inner.active_request_id = None;
            inner.drag = None;
            inner.pending.take()
        });
        if let Some(sender) = sender {
            let _ = sender.send(CaptureOverlaySelection::Cancelled);
        }
    }

    pub fn start_drag(
        &self,
        session_id: String,
        start: CaptureOverlayPoint,
        display_index: usize,
    ) -> Result<(CaptureOverlayDragState, bool), String> {
        validate_point(start)?;
        let mut inner = self
            .inner
            .lock()
            .map_err(|_| "截图选区协调器状态异常".to_string())?;
        if inner.active_request_id.is_none() || inner.pending.is_none() {
            return Err("没有等待中的截图选区".to_string());
        }
        if let Some(existing) = inner.drag.as_ref() {
            if existing.phase == CaptureOverlayDragPhase::Dragging {
                return Ok((existing.clone(), false));
            }
        }
        let now = Instant::now();
        let state = CaptureOverlayDragState {
            session_id,
            phase: CaptureOverlayDragPhase::Dragging,
            start,
            current: start,
            display_index,
            region: None,
            updated_at_ms: now_ms(),
            last_activity: now,
        };
        inner.drag = Some(state.clone());
        Ok((state, true))
    }

    pub fn move_drag(
        &self,
        current: CaptureOverlayPoint,
    ) -> Result<Option<CaptureOverlayDragState>, String> {
        validate_point(current)?;
        let mut inner = self
            .inner
            .lock()
            .map_err(|_| "截图选区协调器状态异常".to_string())?;
        let Some(state) = inner.drag.as_mut() else {
            return Ok(None);
        };
        if state.phase != CaptureOverlayDragPhase::Dragging {
            return Ok(None);
        }
        state.current = current;
        state.region = Some(normalize_rect(state.start, current));
        state.updated_at_ms = now_ms();
        state.last_activity = Instant::now();
        Ok(Some(state.clone()))
    }

    pub fn end_drag(
        &self,
        current: CaptureOverlayPoint,
    ) -> Result<Option<CaptureOverlayDragState>, String> {
        validate_point(current)?;
        let (state, sender, region) = {
            let mut inner = self
                .inner
                .lock()
                .map_err(|_| "截图选区协调器状态异常".to_string())?;
            let Some(state) = inner.drag.as_mut() else {
                return Ok(None);
            };
            if state.phase != CaptureOverlayDragPhase::Dragging {
                return Ok(None);
            }
            let rect = normalize_rect(state.start, current);
            let submitted = rect.width >= CAPTURE_OVERLAY_MIN_LOGICAL_SIZE
                && rect.height >= CAPTURE_OVERLAY_MIN_LOGICAL_SIZE;
            state.current = current;
            state.region = Some(rect);
            state.phase = if submitted {
                CaptureOverlayDragPhase::Submitted
            } else {
                CaptureOverlayDragPhase::Cancelled
            };
            state.updated_at_ms = now_ms();
            state.last_activity = Instant::now();
            let state = state.clone();
            let sender = inner.pending.take();
            let region = submitted.then(|| rect.into_capture_region());
            (state, sender, region)
        };
        if let Some(sender) = sender {
            let selection = region.map_or(
                CaptureOverlaySelection::Cancelled,
                CaptureOverlaySelection::Submitted,
            );
            let _ = sender.send(selection);
        }
        Ok(Some(state))
    }

    pub fn submit_region(&self, region: CaptureRegionRequest) -> Result<(), String> {
        if region.width < CAPTURE_OVERLAY_MIN_LOGICAL_SIZE as u32
            || region.height < CAPTURE_OVERLAY_MIN_LOGICAL_SIZE as u32
        {
            return Err("选区过小，请重新框选".to_string());
        }
        let sender = self
            .inner
            .lock()
            .map_err(|_| "截图选区协调器状态异常".to_string())?
            .pending
            .take()
            .ok_or_else(|| "没有等待中的截图选区".to_string())?;
        sender
            .send(CaptureOverlaySelection::Submitted(region))
            .map_err(|_| "截图选区已关闭".to_string())
    }

    pub fn cancel_drag(&self) -> Result<Option<CaptureOverlayDragState>, String> {
        let (state, sender) = {
            let mut inner = self
                .inner
                .lock()
                .map_err(|_| "截图选区协调器状态异常".to_string())?;
            let state = inner.drag.as_mut().and_then(|state| {
                if state.phase != CaptureOverlayDragPhase::Dragging {
                    return None;
                }
                state.phase = CaptureOverlayDragPhase::Cancelled;
                state.updated_at_ms = now_ms();
                state.last_activity = Instant::now();
                Some(state.clone())
            });
            (state, inner.pending.take())
        };
        if let Some(sender) = sender {
            let _ = sender.send(CaptureOverlaySelection::Cancelled);
        }
        Ok(state)
    }

    pub fn check_drag_timeout(
        &self,
        session_id: &str,
        timeout: Duration,
    ) -> CaptureOverlayTimeoutCheck {
        let (result, sender) = {
            let Ok(mut inner) = self.inner.lock() else {
                return CaptureOverlayTimeoutCheck::Finished;
            };
            let Some(state) = inner.drag.as_mut() else {
                return CaptureOverlayTimeoutCheck::Finished;
            };
            if state.session_id != session_id || state.phase != CaptureOverlayDragPhase::Dragging {
                return CaptureOverlayTimeoutCheck::Finished;
            }
            if state.last_activity.elapsed() < timeout {
                return CaptureOverlayTimeoutCheck::Active;
            }
            state.phase = CaptureOverlayDragPhase::TimedOut;
            state.updated_at_ms = now_ms();
            let state = state.clone();
            (
                CaptureOverlayTimeoutCheck::TimedOut(state),
                inner.pending.take(),
            )
        };
        if let Some(sender) = sender {
            let _ = sender.send(CaptureOverlaySelection::TimedOut);
        }
        result
    }
}

fn validate_point(point: CaptureOverlayPoint) -> Result<(), String> {
    if point.x.is_finite() && point.y.is_finite() {
        Ok(())
    } else {
        Err("截图坐标无效".to_string())
    }
}

fn normalize_rect(start: CaptureOverlayPoint, current: CaptureOverlayPoint) -> CaptureOverlayRect {
    CaptureOverlayRect {
        x: start.x.min(current.x),
        y: start.y.min(current.y),
        width: (current.x - start.x).abs(),
        height: (current.y - start.y).abs(),
    }
}

impl CaptureOverlayRect {
    fn into_capture_region(self) -> CaptureRegionRequest {
        CaptureRegionRequest {
            x: self.x.round() as i32,
            y: self.y.round() as i32,
            width: self.width.round() as u32,
            height: self.height.round() as u32,
        }
    }
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

#[cfg(test)]
mod tests {
    use super::*;

    fn point(x: f64, y: f64) -> CaptureOverlayPoint {
        CaptureOverlayPoint { x, y }
    }

    #[tokio::test]
    async fn rejects_a_second_capture_request_without_overwriting_the_first() {
        let coordinator = CaptureOverlayCoordinator::default();
        let (first_tx, first_rx) = oneshot::channel();
        let first_id = coordinator.begin_request(first_tx).unwrap();
        let (second_tx, _second_rx) = oneshot::channel();
        assert!(coordinator.begin_request(second_tx).is_err());
        coordinator.finish_request(first_id);
        assert_eq!(first_rx.await.unwrap(), CaptureOverlaySelection::Cancelled);
    }

    #[tokio::test]
    async fn cross_window_end_submits_negative_global_region() {
        let coordinator = CaptureOverlayCoordinator::default();
        let (tx, rx) = oneshot::channel();
        coordinator.begin_request(tx).unwrap();
        coordinator
            .start_drag("drag-1".into(), point(-100.0, 20.0), 1)
            .unwrap();
        let state = coordinator.end_drag(point(200.0, 120.0)).unwrap().unwrap();
        assert_eq!(state.phase, CaptureOverlayDragPhase::Submitted);
        assert_eq!(
            rx.await.unwrap(),
            CaptureOverlaySelection::Submitted(CaptureRegionRequest {
                x: -100,
                y: 20,
                width: 300,
                height: 100,
            })
        );
    }

    #[tokio::test]
    async fn timeout_releases_the_waiting_request_and_serializes_camel_case() {
        let coordinator = CaptureOverlayCoordinator::default();
        let (tx, rx) = oneshot::channel();
        coordinator.begin_request(tx).unwrap();
        let (state, _) = coordinator
            .start_drag("drag-timeout".into(), point(0.0, 0.0), 0)
            .unwrap();
        let json = serde_json::to_value(&state).unwrap();
        assert_eq!(json["sessionId"], "drag-timeout");
        assert_eq!(json["displayIndex"], 0);
        assert!(json.get("session_id").is_none());

        let timed_out = coordinator.check_drag_timeout("drag-timeout", Duration::ZERO);
        let CaptureOverlayTimeoutCheck::TimedOut(state) = timed_out else {
            panic!("drag should time out");
        };
        assert_eq!(state.phase, CaptureOverlayDragPhase::TimedOut);
        let json = serde_json::to_value(&state).unwrap();
        assert_eq!(json["phase"], "timedOut");
        assert_eq!(rx.await.unwrap(), CaptureOverlaySelection::TimedOut);
    }

    #[tokio::test]
    async fn tiny_selection_cancels_and_releases_the_waiter() {
        let coordinator = CaptureOverlayCoordinator::default();
        let (tx, rx) = oneshot::channel();
        coordinator.begin_request(tx).unwrap();
        coordinator
            .start_drag("drag-tiny".into(), point(10.0, 10.0), 0)
            .unwrap();
        let state = coordinator.end_drag(point(12.0, 11.0)).unwrap().unwrap();
        assert_eq!(state.phase, CaptureOverlayDragPhase::Cancelled);
        assert_eq!(rx.await.unwrap(), CaptureOverlaySelection::Cancelled);
    }
}
