/**
 * 桌面小妍站位 hook
 * 职责：启动时恢复持久化站位（含显示器迁移与安全夹取），拖动后吸附最近边缘并持久化。
 * 几何计算全部为 shared.ts 中的纯函数；这里只编排 Tauri 调用与状态机。
 */
import { useCallback } from 'react'
import {
  ASSISTANT_DOCK_DEFAULT_SIZE,
  assistantMonitorForPoint,
  dockPlacementFromFrame,
  frameFromDockPlacement,
  parseDockPlacement,
  resolveDockFrame,
  type AssistantScreenSnapshot,
} from '../shared'

async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke: tauriInvoke } = await import('@tauri-apps/api/core')
  return tauriInvoke<T>(command, args)
}

export interface UseAssistantDockPlacement {
  /** 读取持久化站位并恢复到对应显示器；目标显示器不存在时迁移到主显示器。 */
  restorePlacement: () => Promise<void>
  /** 拖动结束后吸附到最近边缘、夹取回可见区域并持久化站位。 */
  persistPlacement: () => Promise<void>
}

export function useAssistantDockPlacement(): UseAssistantDockPlacement {
  const restorePlacement = useCallback(async () => {
    try {
      const [rawPlacement, snapshot] = await Promise.all([
        invoke<unknown>('assistant_get_dock_placement'),
        invoke<AssistantScreenSnapshot>('assistant_get_screen_snapshot'),
      ])
      const size = snapshot.dock_frame
        ? { width: snapshot.dock_frame.width, height: snapshot.dock_frame.height }
        : ASSISTANT_DOCK_DEFAULT_SIZE
      const frame = resolveDockFrame(
        parseDockPlacement(rawPlacement),
        snapshot.monitors,
        size,
      )
      if (!frame) return
      if (
        !snapshot.dock_frame
        || snapshot.dock_frame.x !== frame.x
        || snapshot.dock_frame.y !== frame.y
      ) {
        await invoke('assistant_set_dock_position', { x: frame.x, y: frame.y })
      }
    } catch {
      // 非 Tauri 环境或命令失败时保留当前位置。
    }
  }, [])

  const persistPlacement = useCallback(async () => {
    try {
      const snapshot = await invoke<AssistantScreenSnapshot>(
        'assistant_get_screen_snapshot',
      )
      const frame = snapshot.dock_frame
      if (!frame || snapshot.monitors.length === 0) return
      const monitor = assistantMonitorForPoint(
        { x: frame.x + frame.width / 2, y: frame.y + frame.height / 2 },
        snapshot.monitors,
      )
      if (!monitor) return

      const placement = dockPlacementFromFrame(frame, monitor)
      const snapped = frameFromDockPlacement(placement, monitor, {
        width: frame.width,
        height: frame.height,
      })
      if (snapped.x !== frame.x || snapped.y !== frame.y) {
        await invoke('assistant_set_dock_position', { x: snapped.x, y: snapped.y })
      }
      await invoke('assistant_save_dock_placement', {
        monitorId: placement.monitor_id,
        edge: placement.edge,
        offset: placement.offset,
      })
    } catch {
      // 持久化失败不影响拖动结果，下次拖动会重试。
    }
  }, [])

  return { restorePlacement, persistPlacement }
}
