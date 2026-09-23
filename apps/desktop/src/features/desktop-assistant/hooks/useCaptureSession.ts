/**
 * 采集会话管理 hook
 * 职责：一次性采集会话、预览、重试、取消
 * 调用 Tauri 命令获取上下文，集成隐私检查
 */
import { useState, useCallback, useEffect, useRef } from 'react'
import type {
  AssistantDirectAction,
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
import { useCaptureConfirmation } from './useCaptureConfirmation'
import { useAssistantCaptureEvents } from './useAssistantCaptureEvents'
import { discardCaptureSession, useCaptureRequest } from './useCaptureRequest'

export interface UseCaptureSession {
  session: CaptureSession | null
  status: CaptureStatus
  privacyError: string | null
  confirming: boolean
  /** 当前文本是否来自截图 OCR；用于按 PRD §7.2 F3 标注「识别可能有误」 */
  extractedFromImage: boolean
  /** 直达快捷键（P1-1）记录的预设动作；预览页据此提示确认后将直接执行 */
  pendingAction: AssistantDirectAction | null
  startCapture: (sourceType: ContextSourceType) => Promise<void>
  updateContent: (content: string) => void
  /** 用 OCR 文本替换会话内容并回到可编辑预览，需用户重新确认后才会发送模型 */
  applyExtractedText: (text: string, sessionId?: string) => void
  confirmCapture: () => Promise<void>
  cancelCapture: () => void
  retryCapture: () => Promise<void>
  clearSession: () => void
}

export function useCaptureSession(
  previewRequired = true,
  captureRequestsEnabled = true,
  onCaptureStart?: () => void,
): UseCaptureSession {
  const requestCapture = useCaptureRequest()
  const onCaptureStartRef = useRef(onCaptureStart)
  onCaptureStartRef.current = onCaptureStart
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
  const sessionRef = useRef(session)
  sessionRef.current = session
  const { confirming, confirmCapture, resetConfirmation } = useCaptureConfirmation({
    session, captureSeqRef, setSession, setStatus, setPrivacyError,
  })
  const invalidateCapture = useCallback(() => {
    captureSeqRef.current += 1
    resetConfirmation()
  }, [resetConfirmation])

  useEffect(() => () => { captureSeqRef.current += 1 }, [])

  const startCapture = useCallback(
    async (sourceType: ContextSourceType) => {
      onCaptureStartRef.current?.()
      invalidateCapture()
      const captureSeq = captureSeqRef.current
      sessionRef.current = null
      setSession(null)
      lastSourceRef.current = sourceType
      setStatus('capturing')
      setPrivacyError(null)
      setExtractedFromImage(false)

      try {
        const captured = await requestCapture(sourceType, () => captureSeq === captureSeqRef.current)
        if (!captured) return
        const { response, sourceType: resolvedSourceType } = captured
        if (captureSeq !== captureSeqRef.current) {
          await discardCaptureSession(response.session_id)
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

        sessionRef.current = newSession
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
        sessionRef.current = errorSession
        setSession(errorSession)
        setStatus('error')
        setPrivacyError(err instanceof Error ? err.message : '采集失败')
      }
    },
    [invalidateCapture, requestCapture]
  )

  const updateContent = useCallback((content: string) => {
    invalidateCapture()
    setPrivacyError(null)
    const limited = limitAssistantContent('import', content)
    setSession((prev) => (prev ? {
      ...prev,
      content: limited.content,
      originalCharacterCount: limited.originalCharacters,
      contentTruncated: limited.truncated,
      status: 'ready',
      userConfirmed: false,
      sensitiveRedactionKinds: [],
      sensitiveConfirmationArmed: false,
    } : null))
    setStatus('ready')
  }, [invalidateCapture])

  const applyExtractedText = useCallback((text: string, sessionId?: string) => {
    if (!sessionRef.current || (sessionId && sessionRef.current.id !== sessionId)) return
    invalidateCapture()
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
  }, [invalidateCapture])

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
    // 推进 generation：进行中的采集响应落地时会被丢弃，正在 await 的直达动作也会失效。
    invalidateCapture()
    sessionRef.current = null
    if (session?.id) {
      void discardCaptureSession(session.id)
    }
    setPendingAction(null)
    setSession(null)
    setStatus('idle')
    setPrivacyError(null)
    setExtractedFromImage(false)
  }, [invalidateCapture, session?.id])

  const retryCapture = useCallback(async () => {
    if (session) {
      await startCapture(lastSourceRef.current)
    }
  }, [session, startCapture])

  const clearSession = useCallback(() => {
    // 推进 generation：正在 await 的直达动作立即失效，避免清空后仍启动旧动作。
    invalidateCapture()
    sessionRef.current = null
    setPendingAction(null)
    setSession(null)
    setStatus('idle')
    setPrivacyError(null)
    setExtractedFromImage(false)
  }, [invalidateCapture])

  useAssistantCaptureEvents({
    session, privacyError, pendingAction, setPendingAction, startCapture,
    clearCaptureState: clearSession, captureSeqRef, captureRequestsEnabled,
  })

  return {
    session,
    status,
    privacyError,
    confirming,
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
