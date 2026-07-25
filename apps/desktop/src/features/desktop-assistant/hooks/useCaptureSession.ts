/**
 * 采集会话管理 hook
 * 职责：一次性采集会话、预览、重试、取消
 * 调用 Tauri 命令获取上下文
 */
import { useState, useCallback, useRef } from 'react'
import type { CaptureSession, ContextSourceType, CaptureStatus } from '../shared'
import { generateId, calculateExpiry } from '../shared'

// Tauri invoke 包装
async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke: tauriInvoke } = await import('@tauri-apps/api/core')
  return tauriInvoke<T>(command, args)
}

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
        // 获取前台应用信息
        const [appName, bundleId, windowTitle] = await invoke<[string | null, string | null, string | null]>(
          'assistant_get_frontmost_app'
        )

        let content: string | null = null
        let screenshotPath: string | null = null

        switch (sourceType) {
          case 'selection':
            // 尝试获取选中文本
            content = await invoke<string | null>('assistant_get_selection')
            break

          case 'clipboard':
            // 获取剪贴板内容
            content = await invoke<string | null>('assistant_get_clipboard')
            break

          case 'screenshot':
            // 截图需要用户框选，这里先获取全屏或等待用户操作
            // TODO: 实现框选截图
            screenshotPath = null
            break

          case 'paste':
            // 粘贴模式：内容由用户手动输入
            content = null
            break
        }

        // 更新会话状态
        const updatedSession: CaptureSession = {
          ...newSession,
          content,
          screenshotPath,
          sourceApp: appName,
          sourceAppBundleId: bundleId,
          windowTitle,
          status: content || screenshotPath ? 'ready' : 'error',
        }
        setSession(updatedSession)
        setStatus(updatedSession.status)
      } catch (err) {
        console.error('[assistant] Capture failed:', err)
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
