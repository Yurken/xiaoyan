/**
 * 采集会话管理 hook
 * 职责：一次性采集会话、预览、重试、取消
 */
import { useState, useCallback, useRef } from 'react'
import type { CaptureSession, ContextSourceType, CaptureStatus } from '../shared'
import { generateId, calculateExpiry } from '../shared'

export interface UseCaptureSession {
  session: CaptureSession | null
  status: CaptureStatus
  startCapture: (sourceType: ContextSourceType) => Promise<void>
  updateContent: (content: string) => void
  confirmCapture: () => void
  cancelCapture: () => void
  retryCapture: () => Promise<void>
  clearSession: () => void
}

export function useCaptureSession(
  retainPolicy: 'session' | '24h' | 'permanent' = '24h'
): UseCaptureSession {
  const [session, setSession] = useState<CaptureSession | null>(null)
  const [status, setStatus] = useState<CaptureStatus>('idle')
  const lastSourceRef = useRef<ContextSourceType>('clipboard')

  const createSession = useCallback(
    (sourceType: ContextSourceType): CaptureSession => {
      return {
        id: generateId(),
        sourceType,
        content: null,
        screenshotPath: null,
        sourceApp: null,
        sourceAppBundleId: null,
        windowTitle: null,
        createdAt: Date.now(),
        expiresAt: calculateExpiry(retainPolicy),
        status: 'capturing',
        userConfirmed: false,
      }
    },
    [retainPolicy]
  )

  const startCapture = useCallback(
    async (sourceType: ContextSourceType) => {
      lastSourceRef.current = sourceType
      setStatus('capturing')
      const newSession = createSession(sourceType)
      setSession(newSession)

      try {
        // TODO: 调用 Tauri 命令获取上下文
        // 模拟采集过程
        await new Promise((resolve) => setTimeout(resolve, 300))

        // 模拟成功获取
        const updatedSession: CaptureSession = {
          ...newSession,
          content: '示例选中文本内容...',
          sourceApp: 'Safari',
          sourceAppBundleId: 'com.apple.Safari',
          windowTitle: '示例网页标题',
          status: 'ready',
        }
        setSession(updatedSession)
        setStatus('ready')
      } catch (err) {
        const errorSession: CaptureSession = {
          ...newSession,
          status: 'error',
        }
        setSession(errorSession)
        setStatus('error')
      }
    },
    [createSession]
  )

  const updateContent = useCallback((content: string) => {
    setSession((prev) => (prev ? { ...prev, content } : null))
  }, [])

  const confirmCapture = useCallback(() => {
    setSession((prev) => (prev ? { ...prev, userConfirmed: true } : null))
  }, [])

  const cancelCapture = useCallback(() => {
    setSession(null)
    setStatus('idle')
  }, [])

  const retryCapture = useCallback(async () => {
    if (session) {
      await startCapture(lastSourceRef.current)
    }
  }, [session, startCapture])

  const clearSession = useCallback(() => {
    setSession(null)
    setStatus('idle')
  }, [])

  return {
    session,
    status,
    startCapture,
    updateContent,
    confirmCapture,
    cancelCapture,
    retryCapture,
    clearSession,
  }
}
