import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getInvokeMock, resetInvokeMock } from '../../../__tests__/mocks/tauri'
import { useAssistantRuntimePreferences } from '../hooks/useAssistantRuntimePreferences'

const runtimeEvent = vi.hoisted(() => ({
  handler: null as null | ((event: {
    payload: { enabled: boolean; diagnostic_logging_enabled: boolean }
  }) => void),
  listen: vi.fn(),
}))

vi.mock('@tauri-apps/api/event', () => ({
  listen: runtimeEvent.listen,
}))

describe('useAssistantRuntimePreferences', () => {
  beforeEach(() => {
    resetInvokeMock()
    runtimeEvent.handler = null
    runtimeEvent.listen.mockReset()
    runtimeEvent.listen.mockImplementation(async (_event, handler) => {
      runtimeEvent.handler = handler
      return vi.fn()
    })
  })

  it('persists the total switch and assistant-only diagnostics setting', async () => {
    getInvokeMock().mockImplementation(async (command: string, args?: unknown) => {
      if (command === 'assistant_get_runtime_preferences') {
        return { enabled: true, diagnostic_logging_enabled: false }
      }
      if (command === 'assistant_set_runtime_preferences') {
        expect(args).toEqual({
          enabled: false,
          diagnosticLoggingEnabled: true,
        })
        return { enabled: false, diagnostic_logging_enabled: true }
      }
      throw new Error(`Unmocked invoke: ${command}`)
    })

    const { result } = renderHook(() => useAssistantRuntimePreferences())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.save({
        enabled: false,
        diagnostic_logging_enabled: true,
      })
    })
    expect(result.current.preferences).toEqual({
      enabled: false,
      diagnostic_logging_enabled: true,
    })
  })

  it('adopts runtime changes from another window', async () => {
    getInvokeMock().mockResolvedValue({
      enabled: true,
      diagnostic_logging_enabled: false,
    })
    const { result } = renderHook(() => useAssistantRuntimePreferences())
    await waitFor(() => expect(result.current.loading).toBe(false))
    await waitFor(() => expect(runtimeEvent.handler).not.toBeNull())

    act(() => {
      runtimeEvent.handler?.({
        payload: { enabled: false, diagnostic_logging_enabled: true },
      })
    })
    expect(result.current.preferences.enabled).toBe(false)
    expect(result.current.preferences.diagnostic_logging_enabled).toBe(true)
  })
})
