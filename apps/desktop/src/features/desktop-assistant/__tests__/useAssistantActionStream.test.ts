import { act, renderHook } from '@testing-library/react'
import { listen } from '@tauri-apps/api/event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getInvokeMock, resetInvokeMock } from '../../../__tests__/mocks/tauri'
import { useAssistantActionStream } from '../hooks/useAssistantActionStream'

type TestEvent = { payload: unknown }
type TestEventHandler = (event: TestEvent) => void

const handlers = new Map<string, TestEventHandler>()

function emit(event: string, payload: TestEvent['payload']) {
  handlers.get(event)?.({ payload })
}

describe('useAssistantActionStream', () => {
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
      throw new Error(`Unmocked invoke: ${command}`)
    })
  })

  it('appends deltas and keeps partial output after stop', async () => {
    const { result } = renderHook(() => useAssistantActionStream())

    await act(async () => {
      await result.current.start({
        action: 'interpret',
        sessionId: 'session-1',
        content: 'research context',
      })
    })
    const startCall = getInvokeMock().mock.calls.find(
      ([command]) => command === 'assistant_stream_action',
    )
    const requestId = startCall?.[1]?.requestId as string

    act(() => {
      emit('assistant:action-delta', { request_id: requestId, delta: '第一段' })
      emit('assistant:action-delta', { request_id: requestId, delta: '第二段' })
    })
    expect(result.current.result?.content).toBe('第一段第二段')

    await act(async () => {
      await result.current.stop()
    })
    expect(result.current.status).toBe('stopped')
    expect(result.current.result?.content).toBe('第一段第二段')
    expect(getInvokeMock()).toHaveBeenCalledWith('assistant_cancel_action', {
      requestId,
    })
  })

  it('maps completion metadata and replaces partial output with the canonical result', async () => {
    const { result } = renderHook(() => useAssistantActionStream())
    await act(async () => {
      await result.current.start({
        action: 'translate',
        sessionId: 'session-2',
        content: 'A paper',
        targetLang: 'zh',
      })
    })
    const requestId = getInvokeMock().mock.calls.find(
      ([command]) => command === 'assistant_stream_action',
    )?.[1]?.requestId as string

    act(() => {
      emit('assistant:action-delta', { request_id: requestId, delta: '部分' })
      emit('assistant:action-done', {
        request_id: requestId,
        result: {
          id: 'result-2',
          session_id: 'session-2',
          action: 'translate',
          content: '完整译文',
          format: 'markdown',
          metadata: {
            model: 'research-model',
            token_usage: 120,
            input_tokens: 70,
            output_tokens: 50,
            token_usage_estimated: true,
            duration_ms: 840,
            knowledge_theme: 'Graph RAG',
            source_details: [{
              source_type: 'paper',
              source_id: 'paper-1',
              title: 'Graph Retrieval',
              url: null,
            }],
          },
        },
      })
    })

    expect(result.current.status).toBe('completed')
    expect(result.current.result).toMatchObject({
      id: 'result-2',
      content: '完整译文',
      metadata: {
        model: 'research-model',
        tokenUsage: 120,
        inputTokens: 70,
        outputTokens: 50,
        tokenUsageEstimated: true,
        duration: 840,
        knowledgeTheme: 'Graph RAG',
        sourceDetails: [{
          sourceType: 'paper',
          sourceId: 'paper-1',
          title: 'Graph Retrieval',
        }],
      },
    })
  })

  it('sends local knowledge only through explicit start options', async () => {
    const { result } = renderHook(() => useAssistantActionStream())
    await act(async () => {
      await result.current.start({
        action: 'interpret',
        sessionId: 'session-knowledge',
        content: 'graph retrieval',
        localKnowledgeEnabled: true,
        knowledgeThemeId: 'theme-1',
      })
    })

    expect(getInvokeMock()).toHaveBeenCalledWith(
      'assistant_stream_action',
      expect.objectContaining({
        localKnowledgeEnabled: true,
        knowledgeThemeId: 'theme-1',
      }),
    )
  })

  it('keeps received output when the backend reports an error', async () => {
    const { result } = renderHook(() => useAssistantActionStream())
    await act(async () => {
      await result.current.start({
        action: 'chat',
        sessionId: 'session-3',
        content: 'context',
        question: 'why',
      })
    })
    const requestId = getInvokeMock().mock.calls.find(
      ([command]) => command === 'assistant_stream_action',
    )?.[1]?.requestId as string

    act(() => {
      emit('assistant:action-delta', { request_id: requestId, delta: '已有回答' })
      emit('assistant:action-error', {
        request_id: requestId,
        error: 'provider disconnected',
      })
    })

    expect(result.current.status).toBe('error')
    expect(result.current.error).toBe('provider disconnected')
    expect(result.current.result?.content).toBe('已有回答')
  })
})
