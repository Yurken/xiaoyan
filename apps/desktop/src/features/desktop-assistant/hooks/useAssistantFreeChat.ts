/**
 * 面板自由输入（P1-3）：无采集上下文时直接开启临时对话。
 *
 * 不新增数据面，全程复用现有命令管线：
 * - `assistant_create_paste_session` 建立后端会话（内含总开关校验）；
 * - `assistant_confirm_capture` 对问题文本做脱敏检查，命中不可发送内容时中止；
 * - 返回的输入交给 useAssistantSession.start，由 `assistant_stream_action`
 *   再次校验总开关并复用现有 chat 指标打点。
 */
import { invoke } from '@tauri-apps/api/core'
import { useCallback, useState } from 'react'
import type { StartAssistantActionInput } from './useAssistantActionStream'

interface CreatePasteSessionResponse {
  session_id: string
}

interface FreeChatConfirmationResponse {
  confirmed: boolean
  content: string | null
  reason: string | null
  privacy_check: {
    allowed: boolean
  }
}

export interface StartFreeChatOptions {
  question: string
  localKnowledgeEnabled?: boolean
  knowledgeThemeId?: string
}

export interface UseAssistantFreeChat {
  starting: boolean
  error: string | null
  startFreeChat: (
    options: StartFreeChatOptions,
  ) => Promise<StartAssistantActionInput | null>
  clearError: () => void
}

async function discardSession(sessionId: string): Promise<void> {
  try {
    await invoke<void>('assistant_discard_capture', { sessionId })
  } catch (error) {
    console.warn('[assistant] Failed to discard free-chat session:', error)
  }
}

export function useAssistantFreeChat(): UseAssistantFreeChat {
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const startFreeChat = useCallback(async ({
    question,
    localKnowledgeEnabled,
    knowledgeThemeId,
  }: StartFreeChatOptions): Promise<StartAssistantActionInput | null> => {
    const trimmed = question.trim()
    if (!trimmed || starting) return null
    setStarting(true)
    setError(null)
    let sessionId: string | null = null
    try {
      const created = await invoke<CreatePasteSessionResponse>(
        'assistant_create_paste_session',
      )
      sessionId = created.session_id
      // 问题文本即待发送内容，先走与采集内容一致的脱敏确认。
      let confirmation = await invoke<FreeChatConfirmationResponse>(
        'assistant_confirm_capture',
        { sessionId, content: trimmed },
      )
      if (!confirmation.privacy_check.allowed) {
        setError(confirmation.reason || '问题包含不可发送的敏感字段，请修改后重试')
        await discardSession(sessionId)
        return null
      }
      let question = trimmed
      if (!confirmation.confirmed) {
        // 普通 PII 已被遮盖：复用 confirmation.content 走二次确认（与采集预览一致），
        // 而不是直接丢弃会话让用户无路可走。
        const redacted = confirmation.content?.trim()
        if (redacted) {
          confirmation = await invoke<FreeChatConfirmationResponse>(
            'assistant_confirm_capture',
            { sessionId, content: redacted },
          )
          if (confirmation.privacy_check.allowed && confirmation.confirmed) {
            question = redacted
          } else {
            setError(confirmation.reason || '问题包含不可发送的敏感字段，请修改后重试')
            await discardSession(sessionId)
            return null
          }
        } else {
          setError(confirmation.reason || '问题包含不可发送的敏感字段，请修改后重试')
          await discardSession(sessionId)
          return null
        }
      }
      return {
        action: 'chat',
        sessionId,
        content: '',
        question,
        localKnowledgeEnabled,
        knowledgeThemeId,
        includeCaptureContext: false,
      }
    } catch (startError) {
      if (sessionId) await discardSession(sessionId)
      setError(startError instanceof Error ? startError.message : String(startError))
      return null
    } finally {
      setStarting(false)
    }
  }, [starting])

  const clearError = useCallback(() => setError(null), [])

  return { starting, error, startFreeChat, clearError }
}
