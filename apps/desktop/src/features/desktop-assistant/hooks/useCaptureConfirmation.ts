import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction, type RefObject } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { CaptureSession, CaptureStatus } from '../shared'
import type { CaptureConfirmationResponse } from '../capture/shared'

export function useCaptureConfirmation({
  session, captureSeqRef, setSession, setStatus, setPrivacyError,
}: {
  session: CaptureSession | null
  captureSeqRef: RefObject<number>
  setSession: Dispatch<SetStateAction<CaptureSession | null>>
  setStatus: Dispatch<SetStateAction<CaptureStatus>>
  setPrivacyError: Dispatch<SetStateAction<string | null>>
}) {
  const [confirming, setConfirming] = useState(false)
  const pending = useRef<symbol | null>(null)
  const mounted = useRef(true)

  const resetConfirmation = useCallback(() => {
    pending.current = null
    setConfirming(false)
  }, [])

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      pending.current = null
    }
  }, [])

  const confirmCapture = useCallback(async () => {
    if (!session?.content?.trim() || session.userConfirmed || pending.current) return
    if ((session.sensitiveRedactionKinds?.length ?? 0) > 0 && !session.sensitiveConfirmationArmed) {
      setSession((current) => current?.id === session.id ? { ...current, sensitiveConfirmationArmed: true } : current)
      return
    }
    const request = Symbol('capture-confirmation')
    const generation = captureSeqRef.current
    pending.current = request
    setConfirming(true)
    setPrivacyError(null)
    const isCurrent = () => mounted.current && pending.current === request && captureSeqRef.current === generation

    try {
      const confirmation = await invoke<CaptureConfirmationResponse | undefined>(
        'assistant_confirm_capture', { sessionId: session.id, content: session.content },
      )
      if (!isCurrent()) return
      if (confirmation && !confirmation.privacy_check.allowed) {
        setSession((current) => current?.id === session.id ? {
          ...current, content: null, status: 'error', userConfirmed: false,
          sensitiveRedactionKinds: [], sensitiveConfirmationArmed: false,
        } : current)
        setStatus('error')
        setPrivacyError(confirmation.reason || '内容包含不可发送的敏感字段')
        return
      }
      if (confirmation && !confirmation.confirmed) {
        setSession((current) => current?.id === session.id ? {
          ...current, content: confirmation.content, userConfirmed: false,
          sensitiveRedactionKinds: confirmation.privacy_check.redaction_kinds,
          sensitiveConfirmationArmed: true,
        } : current)
        return
      }
      setSession((current) => current?.id === session.id ? {
        ...current, userConfirmed: true, sensitiveConfirmationArmed: false,
      } : current)
    } catch (error) {
      if (isCurrent()) setPrivacyError(error instanceof Error ? error.message : '确认捕获内容失败')
    } finally {
      if (isCurrent()) {
        pending.current = null
        setConfirming(false)
      }
    }
  }, [captureSeqRef, session, setPrivacyError, setSession, setStatus])

  return { confirming, confirmCapture, resetConfirmation }
}
