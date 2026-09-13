import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { getInvokeMock, resetInvokeMock } from '../../../__tests__/mocks/tauri'
import { useAssistantFreeChat } from '../hooks/useAssistantFreeChat'

const confirmedResponse = {
  confirmed: true,
  content: '什么是图检索？',
  reason: null,
  privacy_check: {
    allowed: true,
    reason: null,
    app_blocked: false,
    app_not_allowed: false,
    window_blocked: false,
    content_sensitive: false,
    content_redacted: false,
    redaction_kinds: [],
  },
}

describe('useAssistantFreeChat', () => {
  beforeEach(() => resetInvokeMock())

  it('creates a confirmed paste session and returns a context-free chat input', async () => {
    getInvokeMock().mockImplementation(async (command: string) => {
      if (command === 'assistant_create_paste_session') {
        return { session_id: 'free-chat-session' }
      }
      if (command === 'assistant_confirm_capture') return confirmedResponse
      throw new Error(`Unmocked invoke: ${command}`)
    })

    const { result } = renderHook(() => useAssistantFreeChat())
    let input: Awaited<ReturnType<typeof result.current.startFreeChat>> = null
    await act(async () => {
      input = await result.current.startFreeChat({
        question: '  什么是图检索？  ',
        localKnowledgeEnabled: true,
        knowledgeThemeId: 'theme-1',
      })
    })

    expect(getInvokeMock()).toHaveBeenCalledWith('assistant_confirm_capture', {
      sessionId: 'free-chat-session',
      content: '什么是图检索？',
    })
    expect(input).toEqual({
      action: 'chat',
      sessionId: 'free-chat-session',
      content: '',
      question: '什么是图检索？',
      localKnowledgeEnabled: true,
      knowledgeThemeId: 'theme-1',
      includeCaptureContext: false,
    })
    expect(result.current.error).toBeNull()
  })

  it('blocks questions rejected by the privacy check and discards the session', async () => {
    getInvokeMock().mockImplementation(async (command: string) => {
      if (command === 'assistant_create_paste_session') {
        return { session_id: 'blocked-session' }
      }
      if (command === 'assistant_confirm_capture') {
        return {
          ...confirmedResponse,
          confirmed: false,
          content: null,
          reason: '内容包含敏感字段',
          privacy_check: { ...confirmedResponse.privacy_check, allowed: false },
        }
      }
      if (command === 'assistant_discard_capture') return undefined
      throw new Error(`Unmocked invoke: ${command}`)
    })

    const { result } = renderHook(() => useAssistantFreeChat())
    let input: Awaited<ReturnType<typeof result.current.startFreeChat>> = null
    await act(async () => {
      input = await result.current.startFreeChat({ question: 'password: correct-horse' })
    })

    expect(input).toBeNull()
    expect(result.current.error).toBe('内容包含敏感字段')
    expect(getInvokeMock()).toHaveBeenCalledWith('assistant_discard_capture', {
      sessionId: 'blocked-session',
    })
  })

  it('re-confirms the redacted content and sends the masked question instead of blocking', async () => {
    getInvokeMock().mockImplementation(async (command: string, args?: unknown) => {
      if (command === 'assistant_create_paste_session') {
        return { session_id: 'redacted-session' }
      }
      if (command === 'assistant_confirm_capture') {
        const content = (args as { content: string }).content
        if (content === '联系 researcher@example.com') {
          return {
            ...confirmedResponse,
            confirmed: false,
            content: '联系 [EMAIL]',
            privacy_check: {
              ...confirmedResponse.privacy_check,
              content_redacted: true,
              redaction_kinds: ['邮箱'],
            },
          }
        }
        // 二次确认：遮盖后的内容与采集预览的再次确认一致。
        expect(content).toBe('联系 [EMAIL]')
        return { ...confirmedResponse, content: '联系 [EMAIL]' }
      }
      throw new Error(`Unmocked invoke: ${command}`)
    })

    const { result } = renderHook(() => useAssistantFreeChat())
    let input: Awaited<ReturnType<typeof result.current.startFreeChat>> = null
    await act(async () => {
      input = await result.current.startFreeChat({ question: '联系 researcher@example.com' })
    })

    expect(input).toEqual(expect.objectContaining({
      action: 'chat',
      sessionId: 'redacted-session',
      question: '联系 [EMAIL]',
      includeCaptureContext: false,
    }))
    expect(result.current.error).toBeNull()
    expect(getInvokeMock()).not.toHaveBeenCalledWith(
      'assistant_discard_capture',
      expect.anything(),
    )
  })

  it('discards the session when the redacted content is still rejected', async () => {
    getInvokeMock().mockImplementation(async (command: string, args?: unknown) => {
      if (command === 'assistant_create_paste_session') {
        return { session_id: 'redacted-session' }
      }
      if (command === 'assistant_confirm_capture') {
        const content = (args as { content: string }).content
        if (content === '联系 researcher@example.com') {
          return {
            ...confirmedResponse,
            confirmed: false,
            content: '联系 [EMAIL]',
            privacy_check: {
              ...confirmedResponse.privacy_check,
              content_redacted: true,
              redaction_kinds: ['邮箱'],
            },
          }
        }
        return {
          ...confirmedResponse,
          confirmed: false,
          content: null,
          reason: '内容包含敏感字段',
          privacy_check: { ...confirmedResponse.privacy_check, allowed: false },
        }
      }
      if (command === 'assistant_discard_capture') return undefined
      throw new Error(`Unmocked invoke: ${command}`)
    })

    const { result } = renderHook(() => useAssistantFreeChat())
    let input: Awaited<ReturnType<typeof result.current.startFreeChat>> = null
    await act(async () => {
      input = await result.current.startFreeChat({ question: '联系 researcher@example.com' })
    })

    expect(input).toBeNull()
    expect(result.current.error).toBe('内容包含敏感字段')
    expect(getInvokeMock()).toHaveBeenCalledWith('assistant_discard_capture', {
      sessionId: 'redacted-session',
    })
  })

  it('does nothing for blank questions', async () => {
    const { result } = renderHook(() => useAssistantFreeChat())
    let input: Awaited<ReturnType<typeof result.current.startFreeChat>> = null
    await act(async () => {
      input = await result.current.startFreeChat({ question: '   ' })
    })

    expect(input).toBeNull()
    expect(getInvokeMock()).not.toHaveBeenCalled()
  })

  it('surfaces backend failures such as the disabled master switch', async () => {
    getInvokeMock().mockImplementation(async (command: string) => {
      if (command === 'assistant_create_paste_session') {
        throw new Error('桌面助手已停用')
      }
      throw new Error(`Unmocked invoke: ${command}`)
    })

    const { result } = renderHook(() => useAssistantFreeChat())
    let input: Awaited<ReturnType<typeof result.current.startFreeChat>> = null
    await act(async () => {
      input = await result.current.startFreeChat({ question: '你好' })
    })

    expect(input).toBeNull()
    expect(result.current.error).toBe('桌面助手已停用')
  })
})
