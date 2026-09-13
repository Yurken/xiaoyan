import { act, renderHook, waitFor } from '@testing-library/react'
import { listen } from '@tauri-apps/api/event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getInvokeMock, resetInvokeMock } from '../../../__tests__/mocks/tauri'
import type { CaptureOverlayDragState } from '../captureOverlayDragMachine'
import { useCaptureOverlayDrag } from '../hooks/useCaptureOverlayDrag'

type DragHandler = (event: { payload: CaptureOverlayDragState }) => void
const listenMock = listen as unknown as ReturnType<typeof vi.fn>

const leftDisplay = {
  x: -1280,
  y: 0,
  width: 1280,
  height: 1024,
  scaleFactor: 1,
}

function pointerEvent(
  clientX: number,
  clientY: number,
  options: { button?: number; buttons?: number; pointerId?: number } = {},
): React.PointerEvent {
  return {
    clientX,
    clientY,
    button: options.button ?? 0,
    buttons: options.buttons ?? 1,
    pointerId: options.pointerId ?? 1,
    preventDefault: vi.fn(),
  } as unknown as React.PointerEvent
}

describe('useCaptureOverlayDrag', () => {
  beforeEach(() => {
    resetInvokeMock()
    getInvokeMock().mockResolvedValue(undefined)
    listenMock.mockReset()
  })

  it('reports negative global coordinates from a left-side display', async () => {
    listenMock.mockResolvedValue(() => {})
    const { result } = renderHook(() => useCaptureOverlayDrag({
      display: leftDisplay,
      displayIndex: 1,
    }))

    act(() => result.current.onPointerDown(pointerEvent(100, 50, { pointerId: 7 })))

    await waitFor(() => expect(getInvokeMock()).toHaveBeenCalledWith(
      'assistant_capture_overlay_drag_start',
      { x: -1180, y: 50, displayIndex: 1 },
    ))
  })

  it('relays move and mouseup in a window that never received pointerdown', async () => {
    let handler: DragHandler | undefined
    listenMock.mockImplementation(async (_event: string, next: DragHandler) => {
      handler = next
      return () => {}
    })
    const { result } = renderHook(() => useCaptureOverlayDrag({
      display: leftDisplay,
      displayIndex: 1,
    }))
    await waitFor(() => expect(handler).toBeDefined())
    act(() => handler?.({
      payload: {
        sessionId: 'drag-cross-window',
        phase: 'dragging',
        start: { x: 100, y: 100 },
        current: { x: 100, y: 100 },
        displayIndex: 0,
        region: null,
        updatedAtMs: 1,
      },
    }))

    act(() => result.current.onPointerMove(pointerEvent(1200, 100, { buttons: 1 })))
    act(() => result.current.onPointerUp(pointerEvent(1100, 200, { buttons: 0 })))

    await waitFor(() => {
      expect(getInvokeMock()).toHaveBeenCalledWith(
        'assistant_capture_overlay_drag_move',
        { x: -80, y: 100 },
      )
      expect(getInvokeMock()).toHaveBeenCalledWith(
        'assistant_capture_overlay_drag_end',
        { x: -180, y: 200 },
      )
    })
  })

  it('relays a pressed move before the drag broadcast reaches this window', async () => {
    listenMock.mockResolvedValue(() => {})
    const { result } = renderHook(() => useCaptureOverlayDrag({
      display: leftDisplay,
      displayIndex: 1,
    }))
    act(() => result.current.onPointerMove(pointerEvent(1270, 20, { buttons: 1 })))
    await waitFor(() => expect(getInvokeMock()).toHaveBeenCalledWith(
      'assistant_capture_overlay_drag_move',
      { x: -10, y: 20 },
    ))
  })

  it('cancels the pending request on Escape', async () => {
    listenMock.mockResolvedValue(() => {})
    renderHook(() => useCaptureOverlayDrag({ display: leftDisplay, displayIndex: 1 }))
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' })))
    await waitFor(() => expect(getInvokeMock()).toHaveBeenCalledWith(
      'assistant_capture_overlay_drag_cancel',
    ))
  })
})
