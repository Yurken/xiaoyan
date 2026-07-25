/**
 * 助手面板状态管理 hook
 * 职责：面板显示、窗口事件与 UI 状态编排
 */
import { useState, useCallback, useEffect } from 'react'
import type { PanelStatus, CaptureSession, ActionResult } from '../shared'

export interface AssistantOverlayState {
  panelStatus: PanelStatus
  isDockVisible: boolean
  isPanelVisible: boolean
  currentSession: CaptureSession | null
  currentResult: ActionResult | null
  error: string | null
}

export interface AssistantOverlayActions {
  showDock: () => void
  hideDock: () => void
  showPanel: () => void
  hidePanel: () => void
  togglePanel: () => void
  setCurrentSession: (session: CaptureSession | null) => void
  setCurrentResult: (result: ActionResult | null) => void
  setError: (error: string | null) => void
  reset: () => void
}

export type UseAssistantOverlay = AssistantOverlayState & AssistantOverlayActions

export function useAssistantOverlay(): UseAssistantOverlay {
  const [panelStatus, setPanelStatus] = useState<PanelStatus>('hidden')
  const [isDockVisible, setIsDockVisible] = useState(true)
  const [isPanelVisible, setIsPanelVisible] = useState(false)
  const [currentSession, setCurrentSession] = useState<CaptureSession | null>(null)
  const [currentResult, setCurrentResult] = useState<ActionResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const showDock = useCallback(() => {
    setIsDockVisible(true)
    // TODO: 调用 Tauri 命令显示 dock 窗口
  }, [])

  const hideDock = useCallback(() => {
    setIsDockVisible(false)
    // TODO: 调用 Tauri 命令隐藏 dock 窗口
  }, [])

  const showPanel = useCallback(() => {
    setIsPanelVisible(true)
    setPanelStatus('loading')
    // TODO: 调用 Tauri 命令显示 panel 窗口
    // 模拟加载完成
    setTimeout(() => {
      setPanelStatus('ready')
    }, 100)
  }, [])

  const hidePanel = useCallback(() => {
    setIsPanelVisible(false)
    setPanelStatus('hidden')
    setCurrentResult(null)
    // TODO: 调用 Tauri 命令隐藏 panel 窗口
  }, [])

  const togglePanel = useCallback(() => {
    if (isPanelVisible) {
      hidePanel()
    } else {
      showPanel()
    }
  }, [isPanelVisible, showPanel, hidePanel])

  const reset = useCallback(() => {
    setCurrentSession(null)
    setCurrentResult(null)
    setError(null)
    setPanelStatus('hidden')
  }, [])

  // 监听快捷键事件
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Alt+Space 切换面板
      if (e.altKey && e.code === 'Space') {
        e.preventDefault()
        togglePanel()
      }
      // Esc 关闭面板
      if (e.code === 'Escape' && isPanelVisible) {
        hidePanel()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [togglePanel, isPanelVisible, hidePanel])

  return {
    panelStatus,
    isDockVisible,
    isPanelVisible,
    currentSession,
    currentResult,
    error,
    showDock,
    hideDock,
    showPanel,
    hidePanel,
    togglePanel,
    setCurrentSession,
    setCurrentResult,
    setError,
    reset,
  }
}
