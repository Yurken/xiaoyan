import { invoke } from '@tauri-apps/api/core'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  ActionResult,
  AssistantSessionMessage,
  AssistantTemporarySession,
} from '../shared'
import { registerAssistantDirectActionStarter } from '../directActionBridge'
import {
  useAssistantActionStream,
  type StartAssistantActionInput,
} from './useAssistantActionStream'

interface FollowUpInput {
  captureSessionId: string
  content: string
  question: string
  localKnowledgeEnabled?: boolean
  knowledgeThemeId?: string
}

interface PromoteSessionInput {
  context: string
  title?: string
}

interface PromotionResponse {
  conversation_id: string
  already_promoted: boolean
}

function createTemporarySessionId() {
  return globalThis.crypto?.randomUUID?.()
    ?? `assistant-session-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function initialUserMessage(input: StartAssistantActionInput) {
  const question = input.question?.trim()
  if (question) return question
  if (input.action === 'translate') return '翻译当前内容'
  if (input.action === 'chat') return '请详细解释当前内容'
  return '解读当前内容'
}

function messageFromResult(result: ActionResult): AssistantSessionMessage {
  return {
    id: result.id,
    role: 'assistant',
    content: result.content,
    createdAt: result.createdAt,
    metadata: result.metadata,
  }
}

function messagesWithCurrentResult(
  session: AssistantTemporarySession,
  result: ActionResult | null,
) {
  if (!result?.content || session.messages.some((message) => message.id === result.id)) {
    return session.messages
  }
  return [...session.messages, messageFromResult(result)]
}

export function useAssistantSession() {
  const actionStream = useAssistantActionStream()
  const [session, setSession] = useState<AssistantTemporarySession | null>(null)
  const [promoting, setPromoting] = useState(false)
  const [promotionError, setPromotionError] = useState<string | null>(null)
  const appendedResultIdsRef = useRef(new Set<string>())
  const lastInputRef = useRef<StartAssistantActionInput | null>(null)

  useEffect(() => {
    const result = actionStream.result
    const terminal = actionStream.status === 'completed'
      || actionStream.status === 'stopped'
      || actionStream.status === 'error'

    setSession((current) => {
      if (!current) return current
      const nextStatus = actionStream.status === 'error'
        ? 'failed'
        : actionStream.status === 'idle'
          ? current.status
          : actionStream.status
      const messages = terminal
        && result?.content
        && !appendedResultIdsRef.current.has(result.id)
        ? [...current.messages, messageFromResult(result)]
        : current.messages
      if (messages !== current.messages && result) {
        appendedResultIdsRef.current.add(result.id)
      }
      if (messages === current.messages && nextStatus === current.status) return current
      return {
        ...current,
        status: nextStatus,
        messages,
      }
    })
  }, [actionStream.result, actionStream.status])

  const start = useCallback(async (input: StartAssistantActionInput) => {
    const temporarySessionId = createTemporarySessionId()
    appendedResultIdsRef.current.clear()
    lastInputRef.current = { ...input, history: [] }
    setPromotionError(null)
    setSession({
      id: temporarySessionId,
      captureSessionId: input.sessionId,
      action: input.action,
      status: 'streaming',
      researchThemeId: input.knowledgeThemeId,
      useLocalKnowledge: Boolean(input.localKnowledgeEnabled),
      // 自由输入（P1-3）等无采集上下文的会话显式传入 false。
      includeCaptureContext: input.includeCaptureContext ?? true,
      translationTargetLanguage: input.targetLang,
      messages: [{
        id: `${temporarySessionId}-user-1`,
        role: 'user',
        content: initialUserMessage(input),
        createdAt: Date.now(),
      }],
    })
    return actionStream.start({ ...input, history: [] })
  }, [actionStream])

  // 直达动作（P1-1）：把动作启动器注册到面板窗口级桥接模块，
  // 采集管线在直达快捷键采集确认后跳过动作选择直接调用 start。
  useEffect(() => registerAssistantDirectActionStarter(start), [start])

  const followUp = useCallback(async (input: FollowUpInput) => {
    const question = input.question.trim()
    if (!session || !question || actionStream.status === 'streaming') return false
    const completeMessages = messagesWithCurrentResult(session, actionStream.result)
    const history = completeMessages.map(({ role, content }) => ({ role, content }))
    const streamInput: StartAssistantActionInput = {
      action: 'chat',
      sessionId: input.captureSessionId,
      content: session.includeCaptureContext ? input.content : '',
      question,
      localKnowledgeEnabled: input.localKnowledgeEnabled,
      knowledgeThemeId: input.knowledgeThemeId,
      includeCaptureContext: session.includeCaptureContext,
      history,
    }
    lastInputRef.current = streamInput
    setPromotionError(null)
    setSession((current) => current ? {
      ...current,
      status: 'streaming',
      messages: [
        ...messagesWithCurrentResult(current, actionStream.result),
        {
          id: `${current.id}-user-${current.messages.length + 1}`,
          role: 'user',
          content: question,
          createdAt: Date.now(),
        },
      ],
    } : current)
    return actionStream.start(streamInput)
  }, [actionStream, session])

  const retry = useCallback(async () => {
    const input = lastInputRef.current
    if (!input || !session || actionStream.status === 'streaming') return false
    if (!session.includeCaptureContext && input.action !== 'chat') return false
    const resultId = actionStream.result?.id
    if (resultId) appendedResultIdsRef.current.delete(resultId)
    setSession((current) => current ? {
      ...current,
      status: 'streaming',
      messages: resultId
        ? current.messages.filter((message) => message.id !== resultId)
        : current.messages,
    } : current)
    setPromotionError(null)
    return actionStream.start(input)
  }, [actionStream, session])

  const promote = useCallback(async ({ context, title }: PromoteSessionInput) => {
    if (!session || actionStream.status === 'streaming') return null
    const messages = messagesWithCurrentResult(session, actionStream.result)
    setPromoting(true)
    setPromotionError(null)
    try {
      const response = await invoke<PromotionResponse>('assistant_promote_session', {
        input: {
          temporarySessionId: session.id,
          captureSessionId: session.captureSessionId,
          title: title?.trim() || null,
          context: session.includeCaptureContext ? context : '',
          includeCaptureContext: session.includeCaptureContext,
          researchThemeId: session.researchThemeId ?? null,
          messages: messages.map((message) => ({
            role: message.role,
            content: message.content,
            sources: message.metadata?.sourceDetails ?? [],
          })),
        },
      })
      setSession((current) => current ? {
        ...current,
        status: 'promoted',
        messages,
        promotedConversationId: response.conversation_id,
      } : current)
      return response.conversation_id
    } catch (error) {
      setPromotionError(error instanceof Error ? error.message : String(error))
      return null
    } finally {
      setPromoting(false)
    }
  }, [actionStream.result, actionStream.status, session])

  const openConversation = useCallback(async () => {
    const conversationId = session?.promotedConversationId
    if (!conversationId) return false
    try {
      await invoke('assistant_open_conversation', { conversationId })
      return true
    } catch (error) {
      setPromotionError(error instanceof Error ? error.message : String(error))
      return false
    }
  }, [session?.promotedConversationId])

  const removeCaptureContext = useCallback(() => {
    setSession((current) => {
      if (!current || current.status === 'streaming' || current.status === 'promoted') {
        return current
      }
      return { ...current, includeCaptureContext: false }
    })
    if (lastInputRef.current) {
      lastInputRef.current = {
        ...lastInputRef.current,
        content: '',
        includeCaptureContext: false,
      }
    }
  }, [])

  const removeLocalKnowledge = useCallback(() => {
    setSession((current) => {
      if (!current || current.status === 'streaming' || current.status === 'promoted') {
        return current
      }
      return { ...current, useLocalKnowledge: false }
    })
    if (lastInputRef.current) {
      lastInputRef.current = {
        ...lastInputRef.current,
        localKnowledgeEnabled: false,
      }
    }
  }, [])

  const reset = useCallback(() => {
    actionStream.reset()
    appendedResultIdsRef.current.clear()
    lastInputRef.current = null
    setSession(null)
    setPromoting(false)
    setPromotionError(null)
  }, [actionStream])

  const historyMessages = useMemo(() => {
    const currentResultId = actionStream.result?.id
    return session?.messages.filter((message) => message.id !== currentResultId) ?? []
  }, [actionStream.result?.id, session?.messages])

  return {
    ...actionStream,
    session,
    historyMessages,
    promoting,
    promotionError,
    start,
    followUp,
    retry,
    promote,
    openConversation,
    removeCaptureContext,
    removeLocalKnowledge,
    reset,
  }
}
