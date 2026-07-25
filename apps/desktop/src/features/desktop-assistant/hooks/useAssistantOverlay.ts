/**
 * 助手面板状态管理 hook
 * 职责：面板显示、窗口事件与 UI 状态编排
 */
import { useState, useCallback, useEffect } from 'react'
import type { PanelStatus, CaptureSession, ActionResult } from '../shared'

export interface AssistantOverlayState {
  panelStatus: PanelStatus
  currentSession: CaptureSession | null
  currentResult: ActionResult | null
  error: string | null
}

export interface AssistantOverlayActions {
  setPanelStatus: (status: PanelStatus) => void
  setCurrentSession: (session: CaptureSession | null) => void
  setCurrentResult: (result: ActionResult | null) => void
  setError: (error: string | null) => void
  reset: () => void
}

export type UseAssistantOverlay = AssistantOverlayState & AssistantOverlayActions

export function useAssistantOverlay(): UseAssistantOverlay {
  const [panelStatus, setPanelStatus] = useState<PanelStatus>('hidden')
  const [currentSession, setCurrentSession] = useState<CaptureSession | null>(null)
  const [currentResult, setCurrentResult] = useState<ActionResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reset = useCallback(() => {
    setCurrentSession(null)
    setCurrentResult(null)
    setError(null)
    setPanelStatus('hidden')
  }, [])

  // 监听快捷键事件
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Esc 关闭面板
      if (e.code === 'Escape' && panelStatus !== 'hidden') {
        reset()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [panelStatus, reset])

  return {
    panelStatus,
    currentSession,
    currentResult,
    error,
    setPanelStatus,
    setCurrentSession,
    setCurrentResult,
    setError,
    reset,
  }
}
