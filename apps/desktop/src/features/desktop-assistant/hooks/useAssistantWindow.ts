/**
 * 助手窗口管理 hook
 * 职责：调用 Tauri 命令控制桌面小妍和面板窗口
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
  refreshVisibility: () => Promise<void>
  showDock: () => Promise<void>
  hideDock: () => Promise<void>
  showPanel: () => Promise<void>
  hidePanel: () => Promise<void>
  togglePanel: () => Promise<boolean>
  /** 清除持久化站位并把桌面小妍恢复到默认位置；失败时抛错由调用方提示。 */
  resetDockPlacement: () => Promise<void>
}

export function useAssistantWindow(): UseAssistantWindow {
  const [isDockVisible, setIsDockVisible] = useState(false)
  const [isPanelVisible, setIsPanelVisible] = useState(false)

  const refreshVisibility = useCallback(async () => {
    try {
      const [dockVisible, panelVisible] = await Promise.all([
        invoke<boolean>('assistant_is_dock_visible'),
        invoke<boolean>('assistant_is_panel_visible'),
      ])
      setIsDockVisible(dockVisible)
      setIsPanelVisible(panelVisible)
    } catch {
      // 非 Tauri 环境或窗口尚未就绪时保留当前状态。
    }
  }, [])

  // 初始化与主窗口重新聚焦时同步真实窗口状态。
  useEffect(() => {
    void refreshVisibility()
    window.addEventListener('focus', refreshVisibility)
    return () => window.removeEventListener('focus', refreshVisibility)
  }, [refreshVisibility])

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

  const resetDockPlacement = useCallback(async () => {
    await invoke('assistant_reset_dock_placement')
  }, [])

  return {
    isDockVisible,
    isPanelVisible,
    refreshVisibility,
    showDock,
    hideDock,
    showPanel,
    hidePanel,
    togglePanel,
    resetDockPlacement,
  }
}
