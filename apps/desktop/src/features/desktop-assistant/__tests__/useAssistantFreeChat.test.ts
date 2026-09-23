import { act, renderHook, waitFor } from '@testing-library/react'
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

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
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

  it('prevents duplicate session creation before React commits the busy state', async () => {
    const creation = deferred<{ session_id: string }>()
    getInvokeMock().mockImplementation(async (command: string) => {
      if (command === 'assistant_create_paste_session') return creation.promise
      if (command === 'assistant_confirm_capture') return confirmedResponse
      throw new Error(`Unmocked invoke: ${command}`)
    })
    const { result } = renderHook(() => useAssistantFreeChat())
    let first!: ReturnType<typeof result.current.startFreeChat>
    let duplicate!: ReturnType<typeof result.current.startFreeChat>
    act(() => {
      first = result.current.startFreeChat({ question: '第一次提问' })
      duplicate = result.current.startFreeChat({ question: '重复点击' })
    })

    expect(getInvokeMock()).toHaveBeenCalledTimes(1)
    await expect(duplicate).resolves.toBeNull()
    await act(async () => {
      creation.resolve({ session_id: 'single-session' })
      await expect(first).resolves.toEqual(expect.objectContaining({
        sessionId: 'single-session', question: '第一次提问',
      }))
    })
  })

  it('discards sessions created after reset without confirming the abandoned question', async () => {
    const creation = deferred<{ session_id: string }>()
    getInvokeMock().mockImplementation(async (command: string) => {
      if (command === 'assistant_create_paste_session') return creation.promise
      if (command === 'assistant_discard_capture') return undefined
      throw new Error(`Unmocked invoke: ${command}`)
    })
    const { result } = renderHook(() => useAssistantFreeChat())
    let pending!: ReturnType<typeof result.current.startFreeChat>
    act(() => { pending = result.current.startFreeChat({ question: '已关闭的提问' }) })
    act(() => result.current.reset())
    expect(result.current.starting).toBe(false)

    await act(async () => {
      creation.resolve({ session_id: 'abandoned-session' })
      await expect(pending).resolves.toBeNull()
    })
    expect(getInvokeMock()).toHaveBeenCalledWith('assistant_discard_capture', {
      sessionId: 'abandoned-session',
    })
    expect(getInvokeMock()).not.toHaveBeenCalledWith('assistant_confirm_capture', expect.anything())
    expect(result.current.error).toBeNull()
  })

  it.each(['resolve', 'reject'] as const)(
    'keeps the new preparation active when an abandoned confirmation %ss',
    async (outcome) => {
      const oldConfirmation = deferred<typeof confirmedResponse>()
      const newConfirmation = deferred<typeof confirmedResponse>()
      let creationCount = 0
      getInvokeMock().mockImplementation(async (command: string, args?: { sessionId?: string }) => {
        if (command === 'assistant_create_paste_session') {
          creationCount += 1
          return { session_id: creationCount === 1 ? 'old-session' : 'new-session' }
        }
        if (command === 'assistant_confirm_capture') {
          return args?.sessionId === 'old-session' ? oldConfirmation.promise : newConfirmation.promise
        }
        if (command === 'assistant_discard_capture') return undefined
        throw new Error(`Unmocked invoke: ${command}`)
      })
      const { result } = renderHook(() => useAssistantFreeChat())
      let oldPending!: ReturnType<typeof result.current.startFreeChat>
      let newPending!: ReturnType<typeof result.current.startFreeChat>
      act(() => { oldPending = result.current.startFreeChat({ question: '旧问题' }) })
      await waitFor(() => expect(getInvokeMock()).toHaveBeenCalledWith('assistant_confirm_capture', {
        sessionId: 'old-session', content: '旧问题',
      }))
      act(() => {
        result.current.reset()
        newPending = result.current.startFreeChat({ question: '新问题' })
      })
      await waitFor(() => expect(getInvokeMock()).toHaveBeenCalledWith('assistant_confirm_capture', {
        sessionId: 'new-session', content: '新问题',
      }))

      await act(async () => {
        if (outcome === 'resolve') oldConfirmation.resolve(confirmedResponse)
        else oldConfirmation.reject(new Error('旧会话确认失败'))
        await expect(oldPending).resolves.toBeNull()
      })
      expect(result.current.starting).toBe(true)
      expect(result.current.error).toBeNull()
      expect(getInvokeMock()).toHaveBeenCalledWith('assistant_discard_capture', {
        sessionId: 'old-session',
      })

      await act(async () => {
        newConfirmation.resolve(confirmedResponse)
        await expect(newPending).resolves.toEqual(expect.objectContaining({
          sessionId: 'new-session', question: '新问题',
        }))
      })
      expect(result.current.starting).toBe(false)
    },
  )

  it('discards a redacted session when reset happens during its second confirmation', async () => {
    const confirmation = deferred<typeof confirmedResponse>()
    getInvokeMock().mockImplementation(async (command: string, args?: { content?: string }) => {
      if (command === 'assistant_create_paste_session') return { session_id: 'redacted-session' }
      if (command === 'assistant_confirm_capture') {
        if (args?.content === '联系 researcher@example.com') {
          return { ...confirmedResponse, confirmed: false, content: '联系 [EMAIL]' }
        }
        return confirmation.promise
      }
      if (command === 'assistant_discard_capture') return undefined
      throw new Error(`Unmocked invoke: ${command}`)
    })
    const { result } = renderHook(() => useAssistantFreeChat())
    let pending!: ReturnType<typeof result.current.startFreeChat>
    act(() => { pending = result.current.startFreeChat({ question: '联系 researcher@example.com' }) })
    await waitFor(() => expect(getInvokeMock()).toHaveBeenCalledWith('assistant_confirm_capture', {
      sessionId: 'redacted-session', content: '联系 [EMAIL]',
    }))
    act(() => result.current.reset())
    await act(async () => {
      confirmation.resolve(confirmedResponse)
      await expect(pending).resolves.toBeNull()
    })
    expect(getInvokeMock()).toHaveBeenCalledWith('assistant_discard_capture', {
      sessionId: 'redacted-session',
    })
  })

  it('returns no chat input and discards the session after unmount', async () => {
    const confirmation = deferred<typeof confirmedResponse>()
    getInvokeMock().mockImplementation(async (command: string) => {
      if (command === 'assistant_create_paste_session') return { session_id: 'unmounted-session' }
      if (command === 'assistant_confirm_capture') return confirmation.promise
      if (command === 'assistant_discard_capture') return undefined
      throw new Error(`Unmocked invoke: ${command}`)
    })
    const { result, unmount } = renderHook(() => useAssistantFreeChat())
    let pending!: ReturnType<typeof result.current.startFreeChat>
    act(() => { pending = result.current.startFreeChat({ question: '离开面板' }) })
    await waitFor(() => expect(getInvokeMock()).toHaveBeenCalledWith('assistant_confirm_capture', {
      sessionId: 'unmounted-session', content: '离开面板',
    }))
    unmount()
    confirmation.resolve(confirmedResponse)
    await expect(pending).resolves.toBeNull()
    expect(getInvokeMock()).toHaveBeenCalledWith('assistant_discard_capture', {
      sessionId: 'unmounted-session',
    })
  })
})
