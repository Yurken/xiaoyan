import { describe, expect, it } from 'vitest'
import {
  captureOverlayLocalRect,
  isCaptureOverlayDragTerminal,
  type CaptureOverlayDragState,
} from '../captureOverlayDragMachine'

const spanningDrag: CaptureOverlayDragState = {
  sessionId: 'drag-1',
  phase: 'dragging',
  start: { x: -100, y: 20 },
  current: { x: 200, y: 120 },
  displayIndex: 1,
  region: { x: -100, y: 20, width: 300, height: 100 },
  updatedAtMs: 1,
}

describe('capture overlay drag machine protocol', () => {
  it('clips one global drag into each overlay window local coordinates', () => {
    expect(captureOverlayLocalRect(spanningDrag, {
      x: -1280,
      y: 0,
      width: 1280,
      height: 1024,
      scaleFactor: 1,
    })).toEqual({ x: 1180, y: 20, width: 100, height: 100 })
    expect(captureOverlayLocalRect(spanningDrag, {
      x: 0,
      y: 0,
      width: 1440,
      height: 900,
      scaleFactor: 2,
    })).toEqual({ x: 0, y: 20, width: 200, height: 100 })
  })

  it('recognizes the Rust camelCase timedOut phase as terminal', () => {
    expect(isCaptureOverlayDragTerminal({
      ...spanningDrag,
      phase: 'timedOut',
    })).toBe(true)
    expect(isCaptureOverlayDragTerminal(spanningDrag)).toBe(false)
  })
})
