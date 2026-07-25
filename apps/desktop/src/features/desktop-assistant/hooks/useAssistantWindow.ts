/**
 * 助手窗口管理 hook
 * 职责：调用 Tauri 命令控制悬浮球和面板窗口
 */
import { useState, useCallback, useEffect } from 'react'

// Tauri invoke 包装
async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  // 动态导入避免 SSR 问题
  const { invoke: tauriInvoke } = await import('@tauri-apps/api/core')
  return tauriInvoke<T>(command, args)
}

export interface UseAssistantWindow {
  isDockVisible: boolean
  isPanelVisible: boolean
  showDock: () => Promise<void>
  hideDock: () => Promise<void>
  showPanel: () => Promise<void>
  hidePanel: () => Promise<void>
  togglePanel: () => Promise<boolean>
}

export function useAssistantWindow(): UseAssistantWindow {
  const [isDockVisible, setIsDockVisible] = useState(false)
  const [isPanelVisible, setIsPanelVisible] = useState(false)

  // 初始化时检查窗口状态
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const visible = await invoke<boolean>('assistant_is_panel_visible')
        setIsPanelVisible(visible)
      } catch {
        // 忽略错误
      }
    }
    void checkStatus()
  }, [])

  const showDock = useCallback(async () => {
    try {
      await invoke('assistant_show_dock')
      setIsDockVisible(true)
    } catch (err) {
      console.error('[assistant] Failed to show dock:', err)
    }
  }, [])

  const hideDock = useCallback(async () => {
    try {
      await invoke('assistant_hide_dock')
      setIsDockVisible(false)
    } catch (err) {
      console.error('[assistant] Failed to hide dock:', err)
    }
  }, [])

  const showPanel = useCallback(async () => {
    try {
      await invoke('assistant_show_panel')
      setIsPanelVisible(true)
    } catch (err) {
      console.error('[assistant] Failed to show panel:', err)
    }
  }, [])

  const hidePanel = useCallback(async () => {
    try {
      await invoke('assistant_hide_panel')
      setIsPanelVisible(false)
    } catch (err) {
      console.error('[assistant] Failed to hide panel:', err)
    }
  }, [])

  const togglePanel = useCallback(async (): Promise<boolean> => {
    try {
      const visible = await invoke<boolean>('assistant_toggle_panel')
      setIsPanelVisible(visible)
      return visible
    } catch (err) {
      console.error('[assistant] Failed to toggle panel:', err)
      return false
    }
  }, [])

  return {
    isDockVisible,
    isPanelVisible,
    showDock,
    hideDock,
    showPanel,
    hidePanel,
    togglePanel,
  }
}
