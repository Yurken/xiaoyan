/**
 * 截图选区层（Capture Overlay）
 * 职责：覆盖单台显示器的透明选区窗口；拖动框选并回传全局逻辑坐标，Esc 取消
 * 跨屏拖动时通过事件同步选区，让每台显示器都渲染自己边界内的裁剪部分
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  displayLogicalBounds,
  globalRectToLocal,
  intersectLogicalRects,
  isCaptureSelectionLargeEnough,
  localRectToGlobal,
  normalizeDragRect,
  pixelSizeForLogicalRect,
  type CaptureLogicalRect,
  type CaptureOverlayDisplay,
} from '../shared'

const DRAG_SYNC_EVENT = 'assistant://capture-overlay-drag'

async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke: tauriInvoke } = await import('@tauri-apps/api/core')
  return tauriInvoke<T>(command, args)
}

/** 当前选区窗口所在显示器的全局逻辑原点、逻辑尺寸与缩放比例 */
async function resolveCurrentDisplay(): Promise<CaptureOverlayDisplay | null> {
  const { currentMonitor } = await import('@tauri-apps/api/window')
  const monitor = await currentMonitor()
  if (!monitor) return null
  const scaleFactor = monitor.scaleFactor
  return {
    x: monitor.position.x / scaleFactor,
    y: monitor.position.y / scaleFactor,
    width: monitor.size.width / scaleFactor,
    height: monitor.size.height / scaleFactor,
    scaleFactor,
  }
}

export function CaptureOverlay() {
  const [display, setDisplay] = useState<CaptureOverlayDisplay | null>(null)
  const [localRect, setLocalRect] = useState<CaptureLogicalRect | null>(null)
  const [remoteRect, setRemoteRect] = useState<CaptureLogicalRect | null>(null)
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)
  const localRectRef = useRef<CaptureLogicalRect | null>(null)
  const submittedRef = useRef(false)

  // 透明窗口需要页面本身透明，露出下方桌面内容。
  useEffect(() => {
    document.documentElement.style.background = 'transparent'
    document.body.style.background = 'transparent'
  }, [])

  useEffect(() => {
    let cancelled = false
    resolveCurrentDisplay()
      .then((resolved) => {
        if (!cancelled) setDisplay(resolved)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  // 同步其他显示器选区层的拖动状态，让跨屏选区在每台显示器上可见。
  useEffect(() => {
    let unlisten: (() => void) | undefined
    let disposed = false
    const subscribe = async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event')
        const stop = await listen<CaptureLogicalRect | null>(DRAG_SYNC_EVENT, (event) => {
          // 本窗口正在拖动时以本地状态为准，忽略自己广播出去的矩形。
          if (dragStartRef.current) return
          setRemoteRect(event.payload ?? null)
        })
        if (disposed) stop()
        else unlisten = stop
      } catch {
        // 浏览器和单测环境没有 Tauri 事件总线。
      }
    }
    void subscribe()
    return () => {
      disposed = true
      unlisten?.()
    }
  }, [])

  const emitDragRect = useCallback((rect: CaptureLogicalRect | null) => {
    void import('@tauri-apps/api/event')
      .then(({ emit }) => emit(DRAG_SYNC_EVENT, rect))
      .catch(() => undefined)
  }, [])

  const cancel = useCallback(() => {
    if (submittedRef.current) return
    submittedRef.current = true
    emitDragRect(null)
    void invoke('assistant_capture_overlay_cancel').catch(() => undefined)
  }, [emitDragRect])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Escape') cancel()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [cancel])

  const submit = useCallback(
    (rect: CaptureLogicalRect) => {
      if (!display || submittedRef.current) return
      submittedRef.current = true
      const globalRect = localRectToGlobal(rect, display)
      emitDragRect(null)
      void invoke('assistant_capture_overlay_submit', {
        region: {
          x: Math.round(globalRect.x),
          y: Math.round(globalRect.y),
          width: Math.round(globalRect.width),
          height: Math.round(globalRect.height),
        },
      }).catch(() => {
        // 提交失败时解除锁定，允许重新框选。
        submittedRef.current = false
      })
    },
    [display, emitDragRect],
  )

  const handleMouseDown = (event: React.MouseEvent) => {
    if (event.button !== 0 || submittedRef.current) return
    dragStartRef.current = { x: event.clientX, y: event.clientY }
    localRectRef.current = null
    setLocalRect(null)
    setRemoteRect(null)
  }

  const handleMouseMove = (event: React.MouseEvent) => {
    const start = dragStartRef.current
    if (!start || !display) return
    const rect = normalizeDragRect(start.x, start.y, event.clientX, event.clientY)
    localRectRef.current = rect
    setLocalRect(rect)
    emitDragRect(localRectToGlobal(rect, display))
  }

  const handleMouseUp = () => {
    if (!dragStartRef.current) return
    dragStartRef.current = null
    const rect = localRectRef.current
    if (rect && isCaptureSelectionLargeEnough(rect)) {
      submit(rect)
    } else {
      localRectRef.current = null
      setLocalRect(null)
      emitDragRect(null)
    }
  }

  // 本窗口未拖动时，渲染其他显示器传来的选区落在本屏边界内的裁剪部分。
  const passiveCrop =
    !dragStartRef.current && remoteRect && display
      ? intersectLogicalRects(remoteRect, displayLogicalBounds(display))
      : null
  const visibleRect =
    localRect ?? (passiveCrop && display ? globalRectToLocal(passiveCrop, display) : null)
  const pixelSize =
    visibleRect && display ? pixelSizeForLogicalRect(visibleRect, display.scaleFactor) : null

  return (
    <div
      role="application"
      aria-label="截图选区层"
      aria-keyshortcuts="Escape"
      aria-describedby="capture-overlay-instructions"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      style={{
        position: 'fixed',
        inset: 0,
        overflow: 'hidden',
        cursor: 'crosshair',
        userSelect: 'none',
        background: 'rgba(0, 0, 0, 0.18)',
      }}
    >
      <div id="capture-overlay-instructions" className="sr-only">
        拖动框选截图区域，按 Esc 键取消截图
      </div>
      <div aria-live="polite" className="sr-only">
        {pixelSize ? `已选择 ${pixelSize.width} × ${pixelSize.height} 像素区域` : ''}
      </div>
      {!visibleRect ? (
        <div
          style={{
            position: 'absolute',
            top: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '6px 12px',
            borderRadius: 8,
            background: 'rgba(0, 0, 0, 0.55)',
            color: '#fff',
            fontSize: 12,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          拖动框选截图区域，Esc 取消
        </div>
      ) : null}
      {visibleRect ? (
        <div
          style={{
            position: 'absolute',
            left: visibleRect.x,
            top: visibleRect.y,
            width: visibleRect.width,
            height: visibleRect.height,
            border: '1px solid #0a84c1',
            background: 'rgba(10, 132, 193, 0.15)',
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.12)',
            pointerEvents: 'none',
          }}
        >
          {pixelSize ? (
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: visibleRect.y > 28 ? -26 : 4,
                padding: '3px 8px',
                borderRadius: 6,
                background: '#0a84c1',
                color: '#fff',
                fontSize: 11,
                lineHeight: 1.4,
                whiteSpace: 'nowrap',
              }}
            >
              {pixelSize.width} × {pixelSize.height}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export default CaptureOverlay
