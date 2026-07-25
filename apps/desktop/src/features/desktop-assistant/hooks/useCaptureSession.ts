/**
 * 采集会话管理 hook
 * 职责：一次性采集会话、预览、重试、取消
 * 调用 Tauri 命令获取上下文，集成隐私检查
 */
import { useState, useCallback, useRef } from 'react'
import type { CaptureSession, ContextSourceType, CaptureStatus } from '../shared'
import { generateId, calculateExpiry } from '../shared'

// Tauri invoke 包装
async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke: tauriInvoke } = await import('@tauri-apps/api/core')
  return tauriInvoke<T>(command, args)
}

/** 隐私检查结果 */
interface PrivacyCheckResult {
  allowed: boolean
  reason: string | null
  app_blocked: boolean
  window_blocked: boolean
  content_sensitive: boolean
}

/** 采集上下文响应 */
interface CaptureContextResponse {
  session_id: string
  content: string | null
  sanitized_content: string | null
  source_app: string | null
  source_app_bundle_id: string | null
  window_title: string | null
  status: string
  privacy_check: PrivacyCheckResult | null
}

export interface UseCaptureSession {
  session: CaptureSession | null
  status: CaptureStatus
  privacyError: string | null
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
  const [privacyError, setPrivacyError] = useState<string | null>(null)
  const lastSourceRef = useRef<ContextSourceType>('clipboard')

  const startCapture = useCallback(
    async (sourceType: ContextSourceType) => {
      lastSourceRef.current = sourceType
      setStatus('capturing')
      setPrivacyError(null)

      try {
        // 根据来源类型调用不同的 Tauri 命令
        let response: CaptureContextResponse

        switch (sourceType) {
          case 'selection':
            response = await invoke<CaptureContextResponse>('assistant_get_selection')
            break
          case 'clipboard':
            response = await invoke<CaptureContextResponse>('assistant_get_clipboard')
            break
          case 'screenshot': {
            // 截图模式：先获取前台应用信息，后续通过独立截图工具框选区域
            const [sourceApp, sourceAppBundleId, windowTitle] = await invoke<
              [string | null, string | null, string | null]
            >('assistant_get_frontmost_app')
            response = {
              session_id: generateId(),
              content: null,
              sanitized_content: null,
              source_app: sourceApp,
              source_app_bundle_id: sourceAppBundleId,
              window_title: windowTitle,
              status: 'ready',
              privacy_check: null,
            }
            break
          }
          case 'paste':
            // 粘贴模式：创建空会话，等待用户粘贴
            response = {
              session_id: generateId(),
              content: null,
              sanitized_content: null,
              source_app: null,
              source_app_bundle_id: null,
              window_title: null,
              status: 'ready',
              privacy_check: null,
            }
            break
          default:
            throw new Error(`Unknown source type: ${sourceType}`)
        }

        // 创建会话
        const newSession: CaptureSession = {
          id: response.session_id,
          sourceType,
          content: response.content,
          screenshotPath: null,
          sourceApp: response.source_app,
          sourceAppBundleId: response.source_app_bundle_id,
          windowTitle: response.window_title,
          createdAt: Date.now(),
          expiresAt: calculateExpiry(retainPolicy),
          status: response.status === 'ready' ? 'ready' : response.status === 'blocked' ? 'error' : 'capturing',
          userConfirmed: false,
        }

        // 检查隐私检查结果
        if (response.privacy_check && !response.privacy_check.allowed) {
          setPrivacyError(response.privacy_check.reason || '内容被隐私策略阻止')
          newSession.status = 'error'
        }

        setSession(newSession)
        setStatus(newSession.status)
      } catch (err) {
        console.error('[assistant] Capture failed:', err)
        const errorSession: CaptureSession = {
          id: generateId(),
          sourceType,
          content: null,
          screenshotPath: null,
          sourceApp: null,
          sourceAppBundleId: null,
          windowTitle: null,
          createdAt: Date.now(),
          expiresAt: calculateExpiry(retainPolicy),
          status: 'error',
          userConfirmed: false,
        }
        setSession(errorSession)
        setStatus('error')
        setPrivacyError(err instanceof Error ? err.message : '采集失败')
      }
    },
    [retainPolicy]
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
    setPrivacyError(null)
  }, [])

  const retryCapture = useCallback(async () => {
    if (session) {
      await startCapture(lastSourceRef.current)
    }
  }, [session, startCapture])

  const clearSession = useCallback(() => {
    setSession(null)
    setStatus('idle')
    setPrivacyError(null)
  }, [])

  return {
    session,
    status,
    privacyError,
    startCapture,
    updateContent,
    confirmCapture,
    cancelCapture,
    retryCapture,
    clearSession,
  }
}
