import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getInvokeMock, resetInvokeMock } from '../../../__tests__/mocks/tauri'
import { useAssistantFileCandidates } from '../hooks/useAssistantFileCandidates'

type DropEvent = {
  payload:
    | { type: 'enter' | 'over' }
    | { type: 'leave' }
    | { type: 'drop'; paths: string[] }
}

const dragMocks = vi.hoisted(() => ({
  handler: null as ((event: DropEvent) => void) | null,
  cleanup: vi.fn(),
}))

vi.mock('../../../lib/tauriEvent', () => ({
  safeOnDragDrop: vi.fn(async (handler: (event: DropEvent) => void) => {
    dragMocks.handler = handler
    return dragMocks.cleanup
  }),
}))

const candidate = {
  id: '9f13b5d6-cf3e-4b89-9cf5-a5f53a4b2107',
  file_name: 'paper.pdf',
  kind: 'pdf',
  media_type: 'application/pdf',
  size_bytes: 1024,
  recommended_target: 'paper',
} as const

describe('useAssistantFileCandidates', () => {
  beforeEach(() => {
    resetInvokeMock()
    dragMocks.handler = null
    dragMocks.cleanup.mockReset()
  })

  it('inspects a native file drop and confirms only after user action', async () => {
    getInvokeMock().mockImplementation(async (command: string, args?: unknown) => {
      if (command === 'assistant_create_file_candidates') {
        expect(args).toEqual({ paths: ['/tmp/paper.pdf'] })
        return { candidates: [candidate], rejected: [] }
      }
      if (command === 'assistant_confirm_file_candidates') {
        expect(args).toEqual({ candidateIds: [candidate.id] })
        return [candidate]
      }
      throw new Error(`Unmocked invoke: ${command}`)
    })

    const { result } = renderHook(() => useAssistantFileCandidates())
    await waitFor(() => expect(dragMocks.handler).not.toBeNull())

    act(() => dragMocks.handler?.({ payload: { type: 'enter' } }))
    expect(result.current.dragActive).toBe(true)

    act(() => {
      dragMocks.handler?.({
        payload: { type: 'drop', paths: ['/tmp/paper.pdf'] },
      })
    })
    await waitFor(() => expect(result.current.inspection?.candidates).toEqual([candidate]))
    expect(getInvokeMock()).not.toHaveBeenCalledWith(
      'assistant_confirm_file_candidates',
      expect.anything(),
    )

    await act(async () => {
      expect(await result.current.confirm()).toBe(true)
    })
    expect(result.current.inspection).toBeNull()
    expect(result.current.confirmedCandidates).toEqual([candidate])
  })

  it('discards preview candidates when the user cancels', async () => {
    getInvokeMock().mockImplementation(async (command: string, args?: unknown) => {
      if (command === 'assistant_create_file_candidates') {
        return { candidates: [candidate], rejected: [] }
      }
      if (command === 'assistant_discard_file_candidates') {
        expect(args).toEqual({ candidateIds: [candidate.id] })
        return 1
      }
      throw new Error(`Unmocked invoke: ${command}`)
    })

    const { result } = renderHook(() => useAssistantFileCandidates())
    await act(async () => {
      await result.current.inspect(['/tmp/paper.pdf'])
    })
    await act(async () => {
      await result.current.cancel()
    })

    expect(result.current.inspection).toBeNull()
  })

  it('clears local preview and confirmation state after a privacy clear signal', async () => {
    getInvokeMock().mockImplementation(async (command: string) => {
      if (command === 'assistant_create_file_candidates') {
        return { candidates: [candidate], rejected: [] }
      }
      if (command === 'assistant_confirm_file_candidates') return [candidate]
      throw new Error(`Unmocked invoke: ${command}`)
    })
    const { result } = renderHook(() => useAssistantFileCandidates())
    await act(async () => {
      await result.current.inspect(['/tmp/paper.pdf'])
      await result.current.confirm()
    })
    expect(result.current.confirmedCandidates).toEqual([candidate])
    act(() => result.current.clearTemporaryState())
    expect(result.current.inspection).toBeNull()
    expect(result.current.confirmedCandidates).toBeNull()
    expect(result.current.error).toBeNull()
  })
})
