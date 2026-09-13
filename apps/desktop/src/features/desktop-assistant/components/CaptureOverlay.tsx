/** 覆盖单台显示器的透明截图选区窗口；拖动权威状态由 Rust 跨窗口协调器维护。 */
import { useEffect, useState } from 'react'
import { pixelSizeForLogicalRect, type CaptureOverlayDisplay } from '../captureOverlayGeometry'
import { useCaptureOverlayDrag } from '../hooks/useCaptureOverlayDrag'

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

async function resolveDisplayIndex(): Promise<number> {
  const { getCurrentWindow } = await import('@tauri-apps/api/window')
  const match = getCurrentWindow().label.match(/assistant-capture-overlay-(\d+)$/)
  return match ? Number.parseInt(match[1], 10) : 0
}

export function CaptureOverlay() {
  const [display, setDisplay] = useState<CaptureOverlayDisplay | null>(null)
  const [displayIndex, setDisplayIndex] = useState(0)

  useEffect(() => {
    document.documentElement.style.background = 'transparent'
    document.body.style.background = 'transparent'
  }, [])

  useEffect(() => {
    let disposed = false
    void Promise.all([resolveCurrentDisplay(), resolveDisplayIndex()])
      .then(([resolvedDisplay, resolvedIndex]) => {
        if (!disposed) {
          setDisplay(resolvedDisplay)
          setDisplayIndex(resolvedIndex)
        }
      })
      .catch(() => undefined)
    return () => {
      disposed = true
    }
  }, [])

  const {
    state,
    localRect,
    bindContainer,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
  } = useCaptureOverlayDrag({ display, displayIndex })
  const pixelSize = localRect && display
    ? pixelSizeForLogicalRect(localRect, display.scaleFactor)
    : null

  return (
    <div
      ref={bindContainer}
      role="application"
      aria-label="截图选区层"
      aria-keyshortcuts="Escape"
      aria-describedby="capture-overlay-instructions"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      style={{
        position: 'fixed',
        inset: 0,
        overflow: 'hidden',
        cursor: 'crosshair',
        userSelect: 'none',
        touchAction: 'none',
        background: 'rgba(0, 0, 0, 0.18)',
      }}
    >
      <div id="capture-overlay-instructions" className="sr-only">
        拖动框选截图区域，按 Esc 键取消截图
      </div>
      <div aria-live="polite" className="sr-only">
        {pixelSize ? `已选择 ${pixelSize.width} × ${pixelSize.height} 像素区域` : ''}
      </div>
      {!localRect ? (
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
          {state?.phase === 'timedOut' ? '框选已超时，请重试' : '拖动框选截图区域，Esc 取消'}
        </div>
      ) : null}
      {localRect ? (
        <div
          style={{
            position: 'absolute',
            left: localRect.x,
            top: localRect.y,
            width: localRect.width,
            height: localRect.height,
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
                top: localRect.y > 28 ? -26 : 4,
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
