import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import {
  captureOverlayLocalRect,
  isCaptureOverlayDragTerminal,
  type CaptureOverlayDragState,
} from '../captureOverlayDragMachine'
import type { CaptureOverlayDisplay } from '../captureOverlayGeometry'

const DRAG_STATE_EVENT = 'assistant://capture-overlay-drag-state'

interface UseCaptureOverlayDragOptions {
  display: CaptureOverlayDisplay | null
  displayIndex: number
}

export function useCaptureOverlayDrag({
  display,
  displayIndex,
}: UseCaptureOverlayDragOptions) {
  const [state, setState] = useState<CaptureOverlayDragState | null>(null)
  const containerRef = useRef<HTMLElement | null>(null)
  const capturedPointerRef = useRef<number | null>(null)

  useEffect(() => {
    let disposed = false
    let unlisten: (() => void) | undefined
    void listen<CaptureOverlayDragState>(DRAG_STATE_EVENT, (event) => {
      if (!disposed) setState(event.payload)
    })
      .then((stop) => {
        if (disposed) stop()
        else unlisten = stop
      })
      .catch(() => undefined)
    return () => {
      disposed = true
      unlisten?.()
    }
  }, [])

  const toGlobalPoint = useCallback((clientX: number, clientY: number) => ({
    x: (display?.x ?? 0) + clientX,
    y: (display?.y ?? 0) + clientY,
  }), [display])

  const releasePointer = useCallback(() => {
    const element = containerRef.current
    const pointerId = capturedPointerRef.current
    if (element && pointerId != null) {
      try {
        element.releasePointerCapture(pointerId)
      } catch {
        // WebKit 或测试环境可能不支持 pointer capture。
      }
    }
    capturedPointerRef.current = null
  }, [])

  const onPointerDown = useCallback((event: ReactPointerEvent) => {
    if (event.button !== 0 || !display) return
    event.preventDefault()
    try {
      containerRef.current?.setPointerCapture(event.pointerId)
      capturedPointerRef.current = event.pointerId
    } catch {
      capturedPointerRef.current = null
    }
    const point = toGlobalPoint(event.clientX, event.clientY)
    void invoke('assistant_capture_overlay_drag_start', {
      ...point,
      displayIndex,
    }).catch(() => releasePointer())
  }, [display, displayIndex, releasePointer, toGlobalPoint])

  const onPointerMove = useCallback((event: ReactPointerEvent) => {
    if (!display) return
    // 跨到另一个 WebView 时没有本地 pointerdown；buttons=1 或广播中的 dragging
    // 都足以证明这是进行中的接力事件。
    if (event.buttons !== 1 && state?.phase !== 'dragging') return
    const point = toGlobalPoint(event.clientX, event.clientY)
    void invoke('assistant_capture_overlay_drag_move', point).catch(() => undefined)
  }, [display, state?.phase, toGlobalPoint])

  const onPointerUp = useCallback((event: ReactPointerEvent) => {
    if (event.button !== 0 || !display) return
    const point = toGlobalPoint(event.clientX, event.clientY)
    releasePointer()
    void invoke('assistant_capture_overlay_drag_end', point).catch(() => undefined)
  }, [display, releasePointer, toGlobalPoint])

  const cancel = useCallback(() => {
    releasePointer()
    void invoke('assistant_capture_overlay_drag_cancel').catch(() => undefined)
  }, [releasePointer])

  const onPointerCancel = useCallback(() => {
    cancel()
  }, [cancel])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Escape') cancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [cancel])

  useEffect(() => {
    if (isCaptureOverlayDragTerminal(state)) releasePointer()
  }, [releasePointer, state])

  const localRect = useMemo(
    () => captureOverlayLocalRect(state, display),
    [display, state],
  )

  return {
    state,
    localRect,
    bindContainer: useCallback((element: HTMLElement | null) => {
      containerRef.current = element
    }, []),
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
  }
}
