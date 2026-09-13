/**
 * 采集会话管理 hook
 * 职责：一次性采集会话、预览、重试、取消
 * 调用 Tauri 命令获取上下文，集成隐私检查
 */
import { useState, useCallback, useEffect, useRef } from 'react'
import type {
  AssistantDirectAction,
  AssistantScreenshotRegion,
  AssistantTranslationPreferences,
  CaptureSession,
  ContextSourceType,
  CaptureStatus,
} from '../shared'
import {
  ASSISTANT_DIRECT_ACTION_EVENT,
  generateId,
  calculateExpiry,
  countTextCharacters,
  isAssistantDirectAction,
  limitAssistantContent,
} from '../shared'
import { startAssistantDirectAction } from '../directActionBridge'
import type { StartAssistantActionInput } from './useAssistantActionStream'

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
  /** 当前文本是否来自截图 OCR；用于按 PRD §7.2 F3 标注「识别可能有误」 */
  extractedFromImage: boolean
  /** 直达快捷键（P1-1）记录的预设动作；预览页据此提示确认后将直接执行 */
  pendingAction: AssistantDirectAction | null
  startCapture: (sourceType: ContextSourceType) => Promise<void>
  updateContent: (content: string) => void
  /** 用 OCR 文本替换会话内容并回到可编辑预览，需用户重新确认后才会发送模型 */
  applyExtractedText: (text: string) => void
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
  const [extractedFromImage, setExtractedFromImage] = useState(false)
  const lastSourceRef = useRef<ContextSourceType>('clipboard')
  // 采集/会话 generation：每次发起采集、取消或清空时递增。
  // - 并发或过期的采集响应只允许最新一次落地，避免旧响应覆盖新采集会话。
  // - 已确认的直达动作在 await 期间用它检测会话是否已被替换/取消/清空。
  const captureSeqRef = useRef(0)
  // 直达动作（P1-1）：快捷键事件先记录预设动作，采集确认后跳过动作选择直接启动。
  // 用状态而非 ref，预览页可同步展示「确认后将直接执行」标识。
  const [pendingAction, setPendingAction] = useState<AssistantDirectAction | null>(null)

  const startCapture = useCallback(
    async (sourceType: ContextSourceType) => {
      const captureSeq = ++captureSeqRef.current
      lastSourceRef.current = sourceType
      setStatus('capturing')
      setPrivacyError(null)
      setExtractedFromImage(false)

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
            // 走自有跨显示器选区层：框选后回传全局逻辑坐标与可验证像素范围。
            response = await invoke<CaptureContextResponse>('assistant_capture_screen_overlay')
            break
          }
          case 'paste':
            // 粘贴模式：创建空会话，等待用户粘贴
            response = await createPasteResponse()
            break
          default:
            throw new Error(`Unknown source type: ${sourceType}`)
        }

        // 过期响应：采集期间已有更新的请求发起，丢弃本次后端会话，不覆盖新采集。
        if (captureSeq !== captureSeqRef.current) {
          await discardResponseSession(response)
          return
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
        if (captureSeq !== captureSeqRef.current) return
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

  const applyExtractedText = useCallback((text: string) => {
    const limited = limitAssistantContent('import', text)
    setSession((prev) => (prev ? {
      ...prev,
      content: limited.content,
      originalCharacterCount: limited.originalCharacters,
      contentTruncated: limited.truncated,
      status: 'ready',
      // OCR 文本属于不可信内容：回到可编辑预览，重新走确认与隐私检查后才可发送。
      userConfirmed: false,
      sensitiveRedactionKinds: [],
      sensitiveConfirmationArmed: false,
    } : null))
    setStatus('ready')
    setPrivacyError(null)
    setExtractedFromImage(true)
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

  // 直达动作：采集经确认（含预览确认与敏感内容二次确认）后，跳过动作选择直接启动
  // 预设动作；动作流不可用时停留在动作选择页，用户可手动继续。
  useEffect(() => {
    const action = pendingAction
    if (!action || action === 'screenshot') return
    if (session?.status === 'error') {
      setPendingAction(null)
      return
    }
    if (privacyError || !session?.userConfirmed || !session.content?.trim()) return
    setPendingAction(null)

    const sessionId = session.id
    const generation = captureSeqRef.current
    const content = limitAssistantContent(action, session.content).content
    void (async () => {
      let input: StartAssistantActionInput = { action, sessionId, content }
      if (action === 'translate') {
        try {
          const preferences = await invoke<AssistantTranslationPreferences>(
            'assistant_get_translation_preferences',
          )
          input = {
            ...input,
            targetLang: preferences.target_language,
            terminologyStyle: preferences.terminology_style,
          }
        } catch {
          // 翻译偏好读取失败时使用后端默认目标语言。
        }
      }
      // await 期间 generation 已被推进说明会话已被清空、取消或新采集替换，
      // 过期动作不得再启动。
      if (captureSeqRef.current !== generation) return
      // startAssistantDirectAction 返回 null（启动器未注册）或 Promise<boolean>，
      // 两者都要 await/判空；启动失败时保留已确认会话，用户仍可手动选择动作。
      const started = await startAssistantDirectAction(input)
      if (!started) {
        console.warn('[assistant] Direct action starter unavailable or failed; keeping manual action selection')
      }
    })()
  }, [privacyError, session, pendingAction])

  const cancelCapture = useCallback(() => {
    // 推进 generation：进行中的采集响应落地时会被丢弃，正在 await 的直达动作也会失效。
    captureSeqRef.current += 1
    if (session?.id) {
      void invoke<void>('assistant_discard_capture', { sessionId: session.id }).catch((error) => {
        console.warn('[assistant] Failed to discard capture session:', error)
      })
    }
    setPendingAction(null)
    setSession(null)
    setStatus('idle')
    setPrivacyError(null)
    setExtractedFromImage(false)
  }, [session?.id])

  const retryCapture = useCallback(async () => {
    if (session) {
      await startCapture(lastSourceRef.current)
    }
  }, [session, startCapture])

  const clearSession = useCallback(() => {
    // 推进 generation：正在 await 的直达动作立即失效，避免清空后仍启动旧动作。
    captureSeqRef.current += 1
    setPendingAction(null)
    setSession(null)
    setStatus('idle')
    setPrivacyError(null)
    setExtractedFromImage(false)
  }, [])

  // 后端在快捷键、托盘或桌面小妍唤起面板时立即发出采集请求。
  // 面板此时不抢焦点，仍可读取第三方应用中的当前选区。
  // 直达动作快捷键（P1-1）走同一管线：interpret/translate 记录预设动作后读取
  // 当前选区（含剪贴板/粘贴降级），screenshot 直接打开跨屏选区层。
  useEffect(() => {
    if (!captureRequestsEnabled) return

    const unlisteners: Array<() => void> = []
    let disposed = false

    const subscribe = async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event')
        const stops = await Promise.all([
          listen<string>('assistant://capture-request', (event) => {
            const source = event.payload as ContextSourceType
            if (source === 'selection' || source === 'clipboard') {
              setPendingAction(null)
              void startCapture(source)
            }
          }),
          listen<string>(ASSISTANT_DIRECT_ACTION_EVENT, (event) => {
            if (!isAssistantDirectAction(event.payload)) return
            if (event.payload === 'screenshot') {
              setPendingAction(null)
              void startCapture('screenshot')
              return
            }
            // 直达动作必须绑定本次新采集：先推进 generation 使旧会话及正在 await 的
            // 旧直达动作立即失效，再清空状态开始新采集。
            captureSeqRef.current += 1
            setSession(null)
            setStatus('idle')
            setPrivacyError(null)
            setExtractedFromImage(false)
            setPendingAction(event.payload)
            void startCapture('selection')
          }),
        ])
        if (disposed) stops.forEach((stop) => stop())
        else unlisteners.push(...stops)
      } catch {
        // 浏览器和单测环境没有 Tauri 事件总线。
      }
    }

    void subscribe()
    return () => {
      disposed = true
      unlisteners.forEach((unlisten) => unlisten())
    }
  }, [captureRequestsEnabled, startCapture])

  return {
    session,
    status,
    privacyError,
    extractedFromImage,
    pendingAction,
    startCapture,
    updateContent,
    applyExtractedText,
    confirmCapture,
    cancelCapture,
    retryCapture,
    clearSession,
  }
}
