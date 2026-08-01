/**
 * 采集会话管理 hook
 * 职责：一次性采集会话、预览、重试、取消
 * 调用 Tauri 命令获取上下文，集成隐私检查
 */
import { useState, useCallback, useEffect, useRef } from 'react'
import type {
  AssistantScreenshotRegion,
  CaptureSession,
  ContextSourceType,
  CaptureStatus,
} from '../shared'
import {
  generateId,
  calculateExpiry,
  countTextCharacters,
  limitAssistantContent,
} from '../shared'

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
  app_not_allowed: boolean
  window_blocked: boolean
  content_sensitive: boolean
  content_redacted: boolean
  redaction_kinds: string[]
}

interface CaptureConfirmationResponse {
  confirmed: boolean
  content: string | null
  reason: string | null
  privacy_check: PrivacyCheckResult
}

/** 采集上下文响应 */
interface CaptureContextResponse {
  session_id: string
  content: string | null
  sanitized_content: string | null
  source_app: string | null
  source_app_bundle_id: string | null
  window_title: string | null
  capture_region?: AssistantScreenshotRegion | null
  original_character_count?: number | null
  content_truncated?: boolean
  status: string
  privacy_check: PrivacyCheckResult | null
}

async function createPasteResponse(): Promise<CaptureContextResponse> {
  return invoke<CaptureContextResponse>('assistant_create_paste_session')
}

async function discardResponseSession(response: CaptureContextResponse): Promise<void> {
  try {
    await invoke<void>('assistant_discard_capture', {
      sessionId: response.session_id,
    })
  } catch (error) {
    console.warn('[assistant] Failed to discard fallback capture session:', error)
  }
}

export interface UseCaptureSession {
  session: CaptureSession | null
  status: CaptureStatus
  privacyError: string | null
  startCapture: (sourceType: ContextSourceType) => Promise<void>
  updateContent: (content: string) => void
  confirmCapture: () => Promise<void>
  cancelCapture: () => void
  retryCapture: () => Promise<void>
  clearSession: () => void
}

export function useCaptureSession(
  previewRequired = true,
  captureRequestsEnabled = true,
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
        let resolvedSourceType = sourceType

        switch (sourceType) {
          case 'selection': {
            try {
              response = await invoke<CaptureContextResponse>('assistant_get_selection')
            } catch {
              response = await invoke<CaptureContextResponse>('assistant_get_clipboard')
              resolvedSourceType = 'clipboard'
            }
            if (
              response.status === 'ready'
              && !response.content?.trim()
            ) {
              await discardResponseSession(response)
              response = await invoke<CaptureContextResponse>('assistant_get_clipboard')
              resolvedSourceType = 'clipboard'
            }
            if (
              response.status === 'ready'
              && !response.content?.trim()
            ) {
              await discardResponseSession(response)
              response = await createPasteResponse()
              resolvedSourceType = 'paste'
            }
            break
          }
          case 'clipboard': {
            response = await invoke<CaptureContextResponse>('assistant_get_clipboard')
            if (
              response.status === 'ready'
              && !response.content?.trim()
            ) {
              await discardResponseSession(response)
              response = await createPasteResponse()
              resolvedSourceType = 'paste'
            }
            break
          }
          case 'screenshot': {
            response = await invoke<CaptureContextResponse>('assistant_capture_screen')
            break
          }
          case 'paste':
            // 粘贴模式：创建空会话，等待用户粘贴
            response = await createPasteResponse()
            break
          default:
            throw new Error(`Unknown source type: ${sourceType}`)
        }

        // 创建会话
        const newSession: CaptureSession = {
          id: response.session_id,
          sourceType: resolvedSourceType,
          content: response.sanitized_content ?? response.content,
          screenshotPath: resolvedSourceType === 'screenshot' ? response.content : null,
          sourceApp: response.source_app,
          sourceAppBundleId: response.source_app_bundle_id,
          windowTitle: response.window_title,
          captureRegion: response.capture_region ?? null,
          createdAt: Date.now(),
          expiresAt: calculateExpiry('24h'),
          status: response.status === 'ready' ? 'ready' : response.status === 'blocked' ? 'error' : 'capturing',
          userConfirmed: false,
          originalCharacterCount:
            response.original_character_count
            ?? (response.content ? countTextCharacters(response.content) : undefined),
          contentTruncated: response.content_truncated ?? false,
          sensitiveRedactionKinds: response.privacy_check?.redaction_kinds ?? [],
          sensitiveConfirmationArmed: false,
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
          captureRegion: null,
          createdAt: Date.now(),
          expiresAt: calculateExpiry('24h'),
          status: 'error',
          userConfirmed: false,
        }
        setSession(errorSession)
        setStatus('error')
        setPrivacyError(err instanceof Error ? err.message : '采集失败')
      }
    },
    []
  )

  const updateContent = useCallback((content: string) => {
    const limited = limitAssistantContent('import', content)
    setSession((prev) => (prev ? {
      ...prev,
      content: limited.content,
      originalCharacterCount: limited.originalCharacters,
      contentTruncated: limited.truncated,
      status: 'ready',
      sensitiveRedactionKinds: [],
      sensitiveConfirmationArmed: false,
    } : null))
    setStatus('ready')
  }, [])

  const confirmCapture = useCallback(async () => {
    if (!session?.content?.trim()) return
    if (
      (session.sensitiveRedactionKinds?.length ?? 0) > 0
      && !session.sensitiveConfirmationArmed
    ) {
      setSession((current) => current?.id === session.id ? {
        ...current,
        sensitiveConfirmationArmed: true,
      } : current)
      return
    }
    try {
      const confirmation = await invoke<CaptureConfirmationResponse | undefined>(
        'assistant_confirm_capture',
        { sessionId: session.id, content: session.content },
      )
      if (confirmation && !confirmation.privacy_check.allowed) {
        setSession((current) => current?.id === session.id ? {
          ...current,
          content: null,
          status: 'error',
          sensitiveRedactionKinds: [],
          sensitiveConfirmationArmed: false,
        } : current)
        setStatus('error')
        setPrivacyError(confirmation.reason || '内容包含不可发送的敏感字段')
        return
      }
      if (confirmation && !confirmation.confirmed) {
        setSession((current) => current?.id === session.id ? {
          ...current,
          content: confirmation.content,
          sensitiveRedactionKinds: confirmation.privacy_check.redaction_kinds,
          // 用户刚刚发起过一次确认；遮盖后仍需再点一次才能继续。
          sensitiveConfirmationArmed: true,
        } : current)
        return
      }
      setSession((current) =>
        current?.id === session.id ? {
          ...current,
          userConfirmed: true,
          sensitiveConfirmationArmed: false,
        } : current
      )
    } catch (error) {
      setPrivacyError(error instanceof Error ? error.message : '确认捕获内容失败')
    }
  }, [session])

  // 用户显式关闭完整预览后，系统采集内容可直接进入动作选择。
  // 手动粘贴仍保留确认步骤，避免用户输入第一个字符时就提前结束编辑。
  useEffect(() => {
    if (
      previewRequired
      || !session?.content?.trim()
      || session.sourceType === 'paste'
      || session.status !== 'ready'
      || session.userConfirmed
      || (session.sensitiveRedactionKinds?.length ?? 0) > 0
      || privacyError
    ) {
      return
    }
    void confirmCapture()
  }, [
    confirmCapture,
    previewRequired,
    privacyError,
    session?.content,
    session?.sourceType,
    session?.status,
    session?.sensitiveRedactionKinds,
    session?.userConfirmed,
  ])

  const cancelCapture = useCallback(() => {
    if (session?.id) {
      void invoke<void>('assistant_discard_capture', { sessionId: session.id }).catch((error) => {
        console.warn('[assistant] Failed to discard capture session:', error)
      })
    }
    setSession(null)
    setStatus('idle')
    setPrivacyError(null)
  }, [session?.id])

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

  // 后端在快捷键、托盘或悬浮球唤起面板时立即发出采集请求。
  // 面板此时不抢焦点，仍可读取第三方应用中的当前选区。
  useEffect(() => {
    if (!captureRequestsEnabled) return

    let unlisten: (() => void) | undefined
    let disposed = false

    const subscribe = async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event')
        const stop = await listen<string>('assistant://capture-request', (event) => {
          const source = event.payload as ContextSourceType
          if (source === 'selection' || source === 'clipboard') {
            void startCapture(source)
          }
        })
        if (disposed) stop()
        else unlisten = stop
      } catch {
        // 浏览器和单测环境没有 Tauri 事件总线。
      }
    }

    void subscribe()
    return () => {
      disposed = true
      unlisten?.()
    }
  }, [captureRequestsEnabled, startCapture])

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
