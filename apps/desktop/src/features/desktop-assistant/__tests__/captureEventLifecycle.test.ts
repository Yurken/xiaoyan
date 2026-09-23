import { act, renderHook, waitFor } from '@testing-library/react'
import { listen } from '@tauri-apps/api/event'
import { describe, expect, it, vi } from 'vitest'
import { getInvokeMock, resetInvokeMock } from '../../../__tests__/mocks/tauri'
import { useCaptureSession } from '../hooks/useCaptureSession'

describe('capture event lifecycle', () => {
  it('keeps native subscriptions while using the latest capture-start callback', async () => {
    resetInvokeMock()
    getInvokeMock().mockResolvedValue({
      session_id: 'native-selection',
      content: 'Selected research text',
      sanitized_content: null,
      source_app: 'Preview',
      source_app_bundle_id: 'com.apple.Preview',
      window_title: 'Paper.pdf',
      status: 'ready',
      privacy_check: null,
    })
    const handlers = new Map<string, (event: { payload: string }) => void>()
    const unlisten = vi.fn()
    const listenMock = listen as unknown as ReturnType<typeof vi.fn>
    listenMock.mockReset()
    listenMock.mockImplementation(async (
      event: string,
      handler: (event: { payload: string }) => void,
    ) => {
      handlers.set(event, handler)
      return () => {
        unlisten(event)
        if (handlers.get(event) === handler) handlers.delete(event)
      }
    })
    const initialCallback = vi.fn()
    const latestCallback = vi.fn()
    const { result, rerender, unmount } = renderHook(
      ({ onCaptureStart }) => useCaptureSession(true, true, onCaptureStart),
      { initialProps: { onCaptureStart: initialCallback } },
    )
    await waitFor(() => expect(listenMock).toHaveBeenCalledTimes(2))

    rerender({ onCaptureStart: latestCallback })
    await act(async () => { await Promise.resolve() })
    expect(unlisten).not.toHaveBeenCalled()
    expect(listenMock).toHaveBeenCalledTimes(2)

    act(() => handlers.get('assistant://capture-request')?.({ payload: 'selection' }))
    await waitFor(() => expect(result.current.session?.id).toBe('native-selection'))
    expect(initialCallback).not.toHaveBeenCalled()
    expect(latestCallback).toHaveBeenCalledTimes(1)
    expect(unlisten).not.toHaveBeenCalled()
    expect(listenMock).toHaveBeenCalledTimes(2)

    unmount()
    expect(unlisten).toHaveBeenCalledTimes(2)
    expect(handlers.size).toBe(0)
  })
})
