import { useLayoutEffect, useRef } from 'react'

const PANEL_WIDTH = 400
const MIN_PANEL_HEIGHT = 220
const MAX_PANEL_HEIGHT = 620

export function clampAssistantPanelHeight(height: number): number {
  return Math.max(MIN_PANEL_HEIGHT, Math.min(MAX_PANEL_HEIGHT, Math.ceil(height)))
}

/** Keeps the independent Tauri window aligned with the rendered panel content. */
export function useAssistantPanelAutoSize(minimumHeight = 0) {
  const contentRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const element = contentRef.current
    if (!element) return

    let animationFrame: number | undefined
    let lastHeight = 0
    let disposed = false

    const syncWindowSize = async () => {
      const height = clampAssistantPanelHeight(Math.max(element.scrollHeight, minimumHeight))
      if (height === lastHeight) return

      try {
        const [{ getCurrentWindow }, { LogicalSize }] = await Promise.all([
          import('@tauri-apps/api/window'),
          import('@tauri-apps/api/dpi'),
        ])
        const currentWindow = getCurrentWindow()
        if (disposed || currentWindow.label !== 'assistant-panel') return
        await currentWindow.setSize(new LogicalSize(PANEL_WIDTH, height))
        lastHeight = height
      } catch {
        // Browser and unit-test environments do not expose a Tauri window.
      }
    }

    const scheduleResize = () => {
      if (animationFrame !== undefined) cancelAnimationFrame(animationFrame)
      animationFrame = requestAnimationFrame(() => void syncWindowSize())
    }

    const observer = new ResizeObserver(scheduleResize)
    observer.observe(element)
    scheduleResize()

    return () => {
      disposed = true
      observer.disconnect()
      if (animationFrame !== undefined) cancelAnimationFrame(animationFrame)
    }
  }, [minimumHeight])

  return contentRef
}
