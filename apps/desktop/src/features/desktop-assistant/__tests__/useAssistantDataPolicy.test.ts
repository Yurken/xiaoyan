import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getInvokeMock, resetInvokeMock } from '../../../__tests__/mocks/tauri'
import { useAssistantDataPolicy } from '../hooks/useAssistantDataPolicy'

const policyEvent = vi.hoisted(() => ({
  handler: null as null | ((event: {
    payload: { preview_required: boolean; inbox_retention_days: 1 | 7 | 30 | null }
  }) => void),
  listen: vi.fn(),
}))

vi.mock('@tauri-apps/api/event', () => ({
  listen: policyEvent.listen,
}))

describe('useAssistantDataPolicy', () => {
  beforeEach(() => {
    resetInvokeMock()
    policyEvent.handler = null
    policyEvent.listen.mockReset()
    policyEvent.listen.mockImplementation(async (_event, handler) => {
      policyEvent.handler = handler
      return vi.fn()
    })
  })

  it('persists preview and inbox retention settings', async () => {
    getInvokeMock().mockImplementation(async (command: string, args?: unknown) => {
      if (command === 'assistant_get_data_policy') {
        return { preview_required: true, inbox_retention_days: 7 }
      }
      if (command === 'assistant_set_data_policy') {
        expect(args).toEqual({
          previewRequired: false,
          inboxRetentionDays: 30,
        })
        return { preview_required: false, inbox_retention_days: 30 }
      }
      if (command === 'assistant_clear_later_items') return 3
      if (command === 'assistant_clear_private_data') {
        return {
          capture_sessions: 2,
          image_assets: 1,
          file_previews: 1,
          cancelled_actions: 1,
        }
      }
      throw new Error(`Unmocked invoke: ${command}`)
    })

    const { result } = renderHook(() => useAssistantDataPolicy())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.save({
        preview_required: false,
        inbox_retention_days: 30,
      })
    })
    expect(result.current.policy).toEqual({
      preview_required: false,
      inbox_retention_days: 30,
    })

    let cleared: number | null = null
    await act(async () => {
      cleared = await result.current.clearLaterItems()
    })
    expect(cleared).toBe(3)

    await act(async () => {
      expect(await result.current.clearPrivateData()).toEqual({
        capture_sessions: 2,
        image_assets: 1,
        file_previews: 1,
        cancelled_actions: 1,
      })
    })
    expect(getInvokeMock()).toHaveBeenCalledWith('assistant_clear_private_data')
  })

  it('adopts policy changes broadcast from another app window', async () => {
    getInvokeMock().mockResolvedValue({
      preview_required: true,
      inbox_retention_days: 7,
    })
    const { result } = renderHook(() => useAssistantDataPolicy())
    await waitFor(() => expect(result.current.loading).toBe(false))
    await waitFor(() => expect(policyEvent.handler).not.toBeNull())

    act(() => {
      policyEvent.handler?.({
        payload: { preview_required: false, inbox_retention_days: 1 },
      })
    })

    expect(result.current.policy).toEqual({
      preview_required: false,
      inbox_retention_days: 1,
    })
  })
})
