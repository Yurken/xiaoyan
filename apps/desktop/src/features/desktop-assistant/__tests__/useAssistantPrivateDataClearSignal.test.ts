import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAssistantPrivateDataClearSignal } from '../hooks/useAssistantPrivateDataClearSignal'

const eventMock = vi.hoisted(() => ({
  handler: null as null | (() => void),
  listen: vi.fn(),
  unlisten: vi.fn(),
}))

vi.mock('@tauri-apps/api/event', () => ({
  listen: eventMock.listen,
}))

describe('useAssistantPrivateDataClearSignal', () => {
  beforeEach(() => {
    eventMock.handler = null
    eventMock.listen.mockReset()
    eventMock.unlisten.mockReset()
    eventMock.listen.mockImplementation(async (event: string, handler: () => void) => {
      expect(event).toBe('assistant://private-data-cleared')
      eventMock.handler = handler
      return eventMock.unlisten
    })
  })

  it('resets the current assistant window and unregisters on unmount', async () => {
    const first = vi.fn()
    const second = vi.fn()
    const { rerender, unmount } = renderHook(
      ({ onClear }) => useAssistantPrivateDataClearSignal(onClear),
      { initialProps: { onClear: first } },
    )
    await waitFor(() => expect(eventMock.handler).not.toBeNull())
    rerender({ onClear: second })
    act(() => eventMock.handler?.())
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledOnce()
    unmount()
    expect(eventMock.unlisten).toHaveBeenCalledOnce()
  })
})
