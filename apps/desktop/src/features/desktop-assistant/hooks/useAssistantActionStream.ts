import { invoke } from '@tauri-apps/api/core'
import { useCallback, useEffect, useRef, useState } from 'react'
import { safeListen } from '../../../lib/tauriEvent'
import type {
  ActionResult,
  AssistantAction,
  AssistantInterpretMode,
  AssistantTerminologyStyle,
  AssistantTranslationTargetLanguage,
  AssistantActionStreamStatus,
  AssistantKnowledgeSource,
  AssistantSessionHistoryMessage,
} from '../shared'

type StreamAction = Exclude<AssistantAction, 'import'>

export interface StartAssistantActionInput {
  action: StreamAction
  sessionId: string
  content: string
  question?: string
  interpretMode?: AssistantInterpretMode
  targetLang?: AssistantTranslationTargetLanguage
  terminologyStyle?: AssistantTerminologyStyle
  localKnowledgeEnabled?: boolean
  knowledgeThemeId?: string
  history?: AssistantSessionHistoryMessage[]
  includeCaptureContext?: boolean
}

interface BackendKnowledgeSource {
  source_type: AssistantKnowledgeSource['sourceType']
  source_id: string
  title: string
  url?: string | null
}

interface BackendActionMetadata {
  model?: string | null
  token_usage?: number | null
  input_tokens?: number | null
  output_tokens?: number | null
  token_usage_estimated?: boolean
  duration_ms?: number | null
  sources?: string[] | null
  source_details?: BackendKnowledgeSource[] | null
  knowledge_theme?: string | null
}

interface BackendActionResult {
  id: string
  session_id: string
  action: StreamAction
  content: string
  format: string
  metadata?: BackendActionMetadata | null
}

function createRequestId() {
  return globalThis.crypto?.randomUUID?.()
    ?? `assistant-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function mapActionResult(result: BackendActionResult): ActionResult {
  const metadata = result.metadata
  return {
    id: result.id,
    sessionId: result.session_id,
    action: result.action,
    content: result.content,
    format:
      result.format === 'markdown' || result.format === 'html'
        ? result.format
        : 'text',
    metadata: metadata
      ? {
          model: metadata.model ?? undefined,
          tokenUsage: metadata.token_usage ?? undefined,
          inputTokens: metadata.input_tokens ?? undefined,
          outputTokens: metadata.output_tokens ?? undefined,
          tokenUsageEstimated: metadata.token_usage_estimated,
          duration: metadata.duration_ms ?? undefined,
          sources: metadata.sources ?? undefined,
          sourceDetails: metadata.source_details?.map((source) => ({
            sourceType: source.source_type,
            sourceId: source.source_id,
            title: source.title,
            url: source.url ?? undefined,
          })),
          knowledgeTheme: metadata.knowledge_theme ?? undefined,
        }
      : undefined,
    createdAt: Date.now(),
  }
}

export function useAssistantActionStream() {
  const [result, setResult] = useState<ActionResult | null>(null)
  const [status, setStatus] = useState<AssistantActionStreamStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const requestIdRef = useRef<string | null>(null)
  const generationRef = useRef(0)
  const unlistenersRef = useRef<Array<() => void>>([])

  const cleanupListeners = useCallback(() => {
    const unlisteners = unlistenersRef.current
    unlistenersRef.current = []
    unlisteners.forEach((unlisten) => unlisten())
  }, [])

  const start = useCallback(async (input: StartAssistantActionInput) => {
    const previousRequestId = requestIdRef.current
    if (previousRequestId) {
      void invoke('assistant_cancel_action', { requestId: previousRequestId }).catch(() => {
        // 新动作仍可继续；后端总开关和任务表会兜底清理旧请求。
      })
    }
    cleanupListeners()

    const requestId = createRequestId()
    const generation = generationRef.current + 1
    generationRef.current = generation
    requestIdRef.current = requestId
    setError(null)
    setStatus('streaming')
    setResult({
      id: requestId,
      sessionId: input.sessionId,
      action: input.action,
      content: '',
      format: 'markdown',
      createdAt: Date.now(),
    })

    try {
      const unlisteners = await Promise.all([
        safeListen<{ request_id: string; delta: string }>(
          'assistant:action-delta',
          (event) => {
            if (
              generationRef.current !== generation
              || event.payload.request_id !== requestId
            ) return
            setResult((current) => current
              ? { ...current, content: current.content + event.payload.delta }
              : current)
          },
        ),
        safeListen<{ request_id: string; result: BackendActionResult }>(
          'assistant:action-done',
          (event) => {
            if (
              generationRef.current !== generation
              || event.payload.request_id !== requestId
            ) return
            requestIdRef.current = null
            setResult(mapActionResult(event.payload.result))
            setStatus('completed')
            cleanupListeners()
          },
        ),
        safeListen<{ request_id: string; error: string }>(
          'assistant:action-error',
          (event) => {
            if (
              generationRef.current !== generation
              || event.payload.request_id !== requestId
            ) return
            requestIdRef.current = null
            setError(event.payload.error)
            setStatus('error')
            cleanupListeners()
          },
        ),
      ])

      if (generationRef.current !== generation) {
        unlisteners.forEach((unlisten) => unlisten())
        return false
      }
      unlistenersRef.current = unlisteners
      await invoke('assistant_stream_action', {
        requestId,
        sessionId: input.sessionId,
        action: input.action,
        content: input.content,
        question: input.question ?? null,
        interpretMode: input.interpretMode ?? null,
        targetLang: input.targetLang ?? null,
        terminologyStyle: input.terminologyStyle ?? null,
        localKnowledgeEnabled: input.localKnowledgeEnabled ?? false,
        knowledgeThemeId: input.knowledgeThemeId ?? null,
        history: input.history ?? [],
        includeCaptureContext: input.includeCaptureContext ?? true,
      })
      return true
    } catch (startError) {
      if (generationRef.current !== generation) return false
      requestIdRef.current = null
      cleanupListeners()
      setError(startError instanceof Error ? startError.message : String(startError))
      setStatus('error')
      return false
    }
  }, [cleanupListeners])

  const stop = useCallback(async () => {
    const requestId = requestIdRef.current
    if (!requestId) return
    generationRef.current += 1
    requestIdRef.current = null
    cleanupListeners()
    setStatus('stopped')
    try {
      await invoke('assistant_cancel_action', { requestId })
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : String(cancelError))
    }
  }, [cleanupListeners])

  const reset = useCallback(() => {
    const requestId = requestIdRef.current
    generationRef.current += 1
    requestIdRef.current = null
    cleanupListeners()
    if (requestId) {
      void invoke('assistant_cancel_action', { requestId }).catch(() => {
        // 窗口关闭或切换来源时尽力取消，后端任务表会继续兜底。
      })
    }
    setResult(null)
    setStatus('idle')
    setError(null)
  }, [cleanupListeners])

  useEffect(() => () => {
    const requestId = requestIdRef.current
    generationRef.current += 1
    requestIdRef.current = null
    cleanupListeners()
    if (requestId) {
      void invoke('assistant_cancel_action', { requestId }).catch(() => {
        // 组件卸载时不再向界面暴露取消错误。
      })
    }
  }, [cleanupListeners])

  return {
    result,
    status,
    error,
    start,
    stop,
    reset,
  }
}
