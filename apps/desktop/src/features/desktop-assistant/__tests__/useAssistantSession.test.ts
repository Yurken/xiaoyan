import { act, renderHook, waitFor } from '@testing-library/react'
import { listen } from '@tauri-apps/api/event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getInvokeMock, resetInvokeMock } from '../../../__tests__/mocks/tauri'
import { useAssistantSession } from '../hooks/useAssistantSession'

type TestEventHandler = (event: { payload: unknown }) => void
const handlers = new Map<string, TestEventHandler>()

function emit(event: string, payload: unknown) {
  handlers.get(event)?.({ payload })
}

describe('useAssistantSession', () => {
  beforeEach(() => {
    handlers.clear()
    resetInvokeMock()
    vi.mocked(listen).mockReset()
    vi.mocked(listen).mockImplementation(async (event, handler) => {
      const eventName = String(event)
      const testHandler = handler as unknown as TestEventHandler
      handlers.set(eventName, testHandler)
      return () => {
        if (handlers.get(eventName) === testHandler) handlers.delete(eventName)
      }
    })
    getInvokeMock().mockImplementation(async (command: string, args?: unknown) => {
      if (command === 'assistant_stream_action') {
        return (args as { requestId: string }).requestId
      }
      if (command === 'assistant_cancel_action') return undefined
      if (command === 'assistant_promote_session') {
        const input = (args as { input: { temporarySessionId: string } }).input
        return {
          conversation_id: input.temporarySessionId,
          already_promoted: false,
        }
      }
      if (command === 'assistant_open_conversation') return undefined
      throw new Error(`Unmocked invoke: ${command}`)
    })
  })

  it('keeps temporary multi-turn history and sends it with follow-up requests', async () => {
    const { result } = renderHook(() => useAssistantSession())
    await act(async () => {
      await result.current.start({
        action: 'interpret',
        sessionId: 'capture-1',
        content: 'graph context',
      })
    })
    const firstRequestId = getInvokeMock().mock.calls.find(
      ([command]) => command === 'assistant_stream_action',
    )?.[1]?.requestId as string
    act(() => {
      emit('assistant:action-done', {
        request_id: firstRequestId,
        result: {
          id: 'answer-1',
          session_id: 'capture-1',
          action: 'interpret',
          content: '第一轮回答',
          format: 'markdown',
        },
      })
    })
    await waitFor(() => expect(result.current.session?.messages).toHaveLength(2))

    await act(async () => {
      await result.current.followUp({
        captureSessionId: 'capture-1',
        content: 'graph context',
        question: '证据是什么？',
      })
    })

    const streamCalls = getInvokeMock().mock.calls.filter(
      ([command]) => command === 'assistant_stream_action',
    )
    expect(streamCalls).toHaveLength(2)
    expect(streamCalls[1]?.[1]).toEqual(expect.objectContaining({
      action: 'chat',
      question: '证据是什么？',
      history: [
        { role: 'user', content: '解读当前内容' },
        { role: 'assistant', content: '第一轮回答' },
      ],
    }))
  })

  it('promotes the confirmed context and messages, then opens the formal conversation', async () => {
    const { result } = renderHook(() => useAssistantSession())
    await act(async () => {
      await result.current.start({
        action: 'chat',
        sessionId: 'capture-2',
        content: 'confirmed context',
        question: '核心结论？',
        localKnowledgeEnabled: true,
        knowledgeThemeId: 'theme-1',
      })
    })
    const requestId = getInvokeMock().mock.calls.find(
      ([command]) => command === 'assistant_stream_action',
    )?.[1]?.requestId as string
    act(() => {
      emit('assistant:action-done', {
        request_id: requestId,
        result: {
          id: 'answer-2',
          session_id: 'capture-2',
          action: 'chat',
          content: '结论内容',
          format: 'markdown',
          metadata: {
            source_details: [{
              source_type: 'paper',
              source_id: 'paper-1',
              title: 'Graph Retrieval',
            }],
          },
        },
      })
    })
    await waitFor(() => expect(result.current.session?.messages).toHaveLength(2))

    let conversationId: string | null = null
    await act(async () => {
      conversationId = await result.current.promote({ context: 'confirmed context' })
    })
    expect(conversationId).toBe(result.current.session?.id)
    expect(result.current.session).toMatchObject({
      status: 'promoted',
      researchThemeId: 'theme-1',
      promotedConversationId: conversationId,
    })
    expect(getInvokeMock()).toHaveBeenCalledWith(
      'assistant_promote_session',
      expect.objectContaining({
        input: expect.objectContaining({
          captureSessionId: 'capture-2',
          context: 'confirmed context',
          researchThemeId: 'theme-1',
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'assistant', content: '结论内容' }),
          ]),
        }),
      }),
    )

    await act(async () => {
      expect(await result.current.openConversation()).toBe(true)
    })
    expect(getInvokeMock()).toHaveBeenCalledWith('assistant_open_conversation', {
      conversationId,
    })
  })

  it('removes capture content and local knowledge from subsequent requests', async () => {
    const { result } = renderHook(() => useAssistantSession())
    await act(async () => {
      await result.current.start({
        action: 'chat',
        sessionId: 'capture-3',
        content: 'sensitive context',
        question: '先回答一次',
        localKnowledgeEnabled: true,
        knowledgeThemeId: 'theme-1',
      })
    })
    const requestId = getInvokeMock().mock.calls.find(
      ([command]) => command === 'assistant_stream_action',
    )?.[1]?.requestId as string
    act(() => {
      emit('assistant:action-done', {
        request_id: requestId,
        result: {
          id: 'answer-3',
          session_id: 'capture-3',
          action: 'chat',
          content: '第一轮',
          format: 'markdown',
        },
      })
    })
    await waitFor(() => expect(result.current.status).toBe('completed'))

    act(() => {
      result.current.removeCaptureContext()
      result.current.removeLocalKnowledge()
    })
    expect(result.current.session).toMatchObject({
      includeCaptureContext: false,
      useLocalKnowledge: false,
      researchThemeId: 'theme-1',
    })

    await act(async () => {
      await result.current.followUp({
        captureSessionId: 'capture-3',
        content: 'sensitive context',
        question: '只根据会话历史回答',
      })
    })
    const streamCalls = getInvokeMock().mock.calls.filter(
      ([command]) => command === 'assistant_stream_action',
    )
    expect(streamCalls[1]?.[1]).toEqual(expect.objectContaining({
      content: '',
      includeCaptureContext: false,
      localKnowledgeEnabled: false,
      question: '只根据会话历史回答',
    }))
  })

  it('keeps free-input sessions context-free across follow-up, retry and promote', async () => {
    const { result } = renderHook(() => useAssistantSession())
    await act(async () => {
      await result.current.start({
        action: 'chat',
        sessionId: 'free-chat-session',
        content: '',
        question: '什么是图检索？',
        includeCaptureContext: false,
      })
    })
    expect(result.current.session).toMatchObject({
      captureSessionId: 'free-chat-session',
      includeCaptureContext: false,
    })
    const requestId = getInvokeMock().mock.calls.find(
      ([command]) => command === 'assistant_stream_action',
    )?.[1]?.requestId as string
    act(() => {
      emit('assistant:action-done', {
        request_id: requestId,
        result: {
          id: 'answer-free',
          session_id: 'free-chat-session',
          action: 'chat',
          content: '自由回答',
          format: 'markdown',
        },
      })
    })
    await waitFor(() => expect(result.current.status).toBe('completed'))

    await act(async () => {
      await result.current.followUp({
        captureSessionId: 'free-chat-session',
        content: '',
        question: '展开讲讲',
      })
    })
    const streamCalls = getInvokeMock().mock.calls.filter(
      ([command]) => command === 'assistant_stream_action',
    )
    expect(streamCalls[1]?.[1]).toEqual(expect.objectContaining({
      action: 'chat',
      content: '',
      question: '展开讲讲',
      includeCaptureContext: false,
    }))

    // 追问完成后才能重试；重试用最近一次的自由会话输入
    act(() => {
      emit('assistant:action-done', {
        request_id: streamCalls[1]?.[1]?.requestId as string,
        result: {
          id: 'answer-free-2',
          session_id: 'free-chat-session',
          action: 'chat',
          content: '追问回答',
          format: 'markdown',
        },
      })
    })
    await waitFor(() => expect(result.current.status).toBe('completed'))

    await act(async () => {
      expect(await result.current.retry()).toBe(true)
    })
    const retryCall = getInvokeMock().mock.calls.filter(
      ([command]) => command === 'assistant_stream_action',
    )[2]
    act(() => {
      emit('assistant:action-done', {
        request_id: retryCall?.[1]?.requestId as string,
        result: {
          id: 'answer-free-3',
          session_id: 'free-chat-session',
          action: 'chat',
          content: '重试回答',
          format: 'markdown',
        },
      })
    })
    await waitFor(() => expect(result.current.status).toBe('completed'))

    let conversationId: string | null = null
    await act(async () => {
      conversationId = await result.current.promote({ context: '' })
    })
    expect(conversationId).toBe(result.current.session?.id)
    expect(getInvokeMock()).toHaveBeenCalledWith(
      'assistant_promote_session',
      expect.objectContaining({
        input: expect.objectContaining({
          captureSessionId: 'free-chat-session',
          context: '',
          includeCaptureContext: false,
        }),
      }),
    )
  })
})
