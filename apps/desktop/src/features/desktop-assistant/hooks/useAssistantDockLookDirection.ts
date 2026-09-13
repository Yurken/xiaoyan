import { useEffect, useState } from 'react'
import { resolveCompanionLookDirection } from '../../companion/shared'

const LOOK_DEADZONE_RADIUS = 44
const POLL_INTERVAL_MS = 32

interface DockLookTarget {
  cursor_x: number
  cursor_y: number
  window_x: number
  window_y: number
  window_width: number
  window_height: number
}

/**
 * 桌面小妍全局注视方向。
 * 通过 Tauri 命令获取全局光标位置与当前窗口在屏幕上的位置，
 * 计算小妍应该看向的方向索引。
 */
export function useAssistantDockLookDirection(enabled: boolean): number | null {
  const [direction, setDirection] = useState<number | null>(null)

  useEffect(() => {
    if (!enabled) {
      setDirection(null)
      return
    }

    let cancelled = false
    let timeout: number | undefined

    const poll = async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core')
        const target = await invoke<DockLookTarget>('assistant_get_dock_look_target')
        if (cancelled) return

        const centerX = target.window_x + target.window_width / 2
        const centerY = target.window_y + target.window_height / 2
        const nextDirection = resolveCompanionLookDirection(
          target.cursor_x - centerX,
          target.cursor_y - centerY,
          LOOK_DEADZONE_RADIUS,
        )
        setDirection((current) => (current === nextDirection ? current : nextDirection))
      } catch {
        // 非桌面端或命令失败时静默降级，不打断 idle 动画
      }

      if (!cancelled) {
        timeout = window.setTimeout(poll, POLL_INTERVAL_MS)
      }
    }

    poll()

    return () => {
      cancelled = true
      if (timeout) window.clearTimeout(timeout)
    }
  }, [enabled])

  return direction
}
