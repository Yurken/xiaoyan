import {
  displayLogicalBounds,
  globalRectToLocal,
  intersectLogicalRects,
  type CaptureLogicalRect,
  type CaptureOverlayDisplay,
} from './captureOverlayGeometry'

export type CaptureOverlayDragPhase =
  | 'dragging'
  | 'submitted'
  | 'cancelled'
  | 'timedOut'

export interface CaptureOverlayPoint {
  x: number
  y: number
}

/** 与 Rust CaptureOverlayDragState 的 camelCase 序列化协议严格对应。 */
export interface CaptureOverlayDragState {
  sessionId: string
  phase: CaptureOverlayDragPhase
  start: CaptureOverlayPoint
  current: CaptureOverlayPoint
  displayIndex: number
  region: CaptureLogicalRect | null
  updatedAtMs: number
}

export function isCaptureOverlayDragTerminal(
  state: CaptureOverlayDragState | null,
): boolean {
  return state != null && state.phase !== 'dragging'
}

export function captureOverlayLocalRect(
  state: CaptureOverlayDragState | null,
  display: CaptureOverlayDisplay | null,
): CaptureLogicalRect | null {
  if (!state?.region || !display) return null
  const visible = intersectLogicalRects(state.region, displayLogicalBounds(display))
  return visible ? globalRectToLocal(visible, display) : null
}
