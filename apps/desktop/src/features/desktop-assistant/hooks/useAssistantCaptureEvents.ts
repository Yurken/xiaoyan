import { useEffect, useRef, type Dispatch, type RefObject, type SetStateAction } from 'react'
import type {
  AssistantDirectAction,
  AssistantTranslationPreferences,
  CaptureSession,
  ContextSourceType,
} from '../shared'
import {
  ASSISTANT_DIRECT_ACTION_EVENT,
  isAssistantDirectAction,
  limitAssistantContent,
} from '../shared'
import { startAssistantDirectAction } from '../directActionBridge'
import type { StartAssistantActionInput } from './useAssistantActionStream'

/** 接收外部采集事件，并在采集确认后启动对应的直达动作。 */
export function useAssistantCaptureEvents({
  session,
  privacyError,
  pendingAction,
  setPendingAction,
  startCapture,
  clearCaptureState,
  captureSeqRef,
  captureRequestsEnabled,
}: {
  session: CaptureSession | null
  privacyError: string | null
  pendingAction: AssistantDirectAction | null
  setPendingAction: Dispatch<SetStateAction<AssistantDirectAction | null>>
  startCapture: (sourceType: ContextSourceType) => Promise<void>
  /** 同步使旧采集与确认失效，并清空采集状态。 */
  clearCaptureState: () => void
  captureSeqRef: RefObject<number>
  captureRequestsEnabled: boolean
}) {
  // 独立于直达动作 effect 的重跑：消费 pendingAction 后仍需允许本次动作继续。
  const lifecycleRef = useRef(0)
  useEffect(() => () => { lifecycleRef.current += 1 }, [])

  // 只消费经预览确认及敏感内容二次确认的会话；启动器不可用时保留手动选择。
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
    const lifecycle = lifecycleRef.current
    const content = limitAssistantContent(action, session.content).content
    void (async () => {
      let input: StartAssistantActionInput = { action, sessionId, content }
      if (action === 'translate') {
        try {
          const { invoke } = await import('@tauri-apps/api/core')
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
      // 采集替换、取消、清空或卸载后，await 返回的旧动作不得再启动。
      if (captureSeqRef.current !== generation || lifecycleRef.current !== lifecycle) return
      const started = await startAssistantDirectAction(input)
      if (!started) {
        console.warn('[assistant] Direct action starter unavailable or failed; keeping manual action selection')
      }
    })()
  }, [captureSeqRef, pendingAction, privacyError, session, setPendingAction])

  // 唤起面板时仍读取原应用选区；直达截图则直接进入跨屏选区层。
  useEffect(() => {
    if (!captureRequestsEnabled) return

    const unlisteners: Array<() => void> = []
    let disposed = false
    const retainUnlistener = (unlisten: () => void) => {
      if (disposed) unlisten()
      else unlisteners.push(unlisten)
    }

    const subscribe = async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event')
        if (disposed) return
        await Promise.all([
          listen<string>('assistant://capture-request', (event) => {
            if (disposed) return
            const source = event.payload as ContextSourceType
            if (source === 'selection' || source === 'clipboard') {
              setPendingAction(null)
              void startCapture(source)
            }
          }).then(retainUnlistener),
          listen<string>(ASSISTANT_DIRECT_ACTION_EVENT, (event) => {
            if (disposed || !isAssistantDirectAction(event.payload)) return
            if (event.payload === 'screenshot') {
              setPendingAction(null)
              void startCapture('screenshot')
              return
            }
            // 必须先使旧会话及正在 await 的确认/直达动作失效，再绑定新采集。
            clearCaptureState()
            setPendingAction(event.payload)
            void startCapture('selection')
          }).then(retainUnlistener),
        ])
      } catch {
        // 浏览器和单测环境没有 Tauri 事件总线。
      }
    }

    void subscribe()
    return () => {
      disposed = true
      unlisteners.forEach((unlisten) => unlisten())
    }
  }, [captureRequestsEnabled, clearCaptureState, setPendingAction, startCapture])
}
