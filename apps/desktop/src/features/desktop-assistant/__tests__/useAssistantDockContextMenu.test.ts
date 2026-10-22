import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MenuOptions } from '@tauri-apps/api/menu'
import { getInvokeMock, resetInvokeMock } from '../../../__tests__/mocks/tauri'
import { useAssistantDockContextMenu } from '../hooks/useAssistantDockContextMenu'

const native = vi.hoisted(() => ({ create: vi.fn(), popup: vi.fn(), close: vi.fn() }))
vi.mock('@tauri-apps/api/menu', () => ({ Menu: { new: native.create } }))

type Action = { id: string; text: string; action: () => void }
function action(id: string) {
  const options = native.create.mock.calls[0]?.[0] as MenuOptions
  return (options.items as Action[]).find((item) => item.id === id)?.action
}

describe('companion native context menu', () => {
  beforeEach(() => {
    resetInvokeMock()
    getInvokeMock().mockResolvedValue(undefined)
    native.create.mockReset().mockResolvedValue({ popup: native.popup, close: native.close })
    native.popup.mockReset().mockResolvedValue(undefined)
    native.close.mockReset().mockResolvedValue(undefined)
  })

  it('opens a native menu and keeps actions separate until selected', async () => {
    const showPanel = vi.fn().mockResolvedValue(undefined)
    const pasteFiles = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useAssistantDockContextMenu({ showPanel, pasteFiles }))
    await act(async () => { await result.current.open() })
    expect(native.popup).toHaveBeenCalledOnce()
    expect(native.close).toHaveBeenCalledOnce()
    expect(showPanel).not.toHaveBeenCalled()
    expect(pasteFiles).not.toHaveBeenCalled()
    await act(async () => { action('assistant-panel')?.(); action('assistant-paste')?.(); action('assistant-settings')?.() })
    expect(showPanel).toHaveBeenCalledOnce()
    expect(pasteFiles).toHaveBeenCalledOnce()
    expect(getInvokeMock()).toHaveBeenCalledWith('assistant_open_settings')
  })

  it('persists disabling while retaining the diagnostic preference', async () => {
    getInvokeMock().mockImplementation(async (command: string) => command === 'assistant_get_runtime_preferences'
      ? { enabled: true, diagnostic_logging_enabled: true } : undefined)
    const { result } = renderHook(() => useAssistantDockContextMenu({ showPanel: vi.fn(), pasteFiles: vi.fn() }))
    await act(async () => { await result.current.open() })
    await act(async () => { action('assistant-close')?.() })
    expect(getInvokeMock()).toHaveBeenCalledWith('assistant_set_runtime_preferences', { enabled: false, diagnosticLoggingEnabled: true })
  })

  it('reports menu errors without triggering an action', async () => {
    native.popup.mockRejectedValue(new Error('menu unavailable'))
    const { result } = renderHook(() => useAssistantDockContextMenu({ showPanel: vi.fn(), pasteFiles: vi.fn() }))
    await act(async () => { await result.current.open() })
    expect(result.current.error).toBe('menu unavailable')
    expect(native.close).toHaveBeenCalledOnce()
    expect(getInvokeMock()).not.toHaveBeenCalled()
  })
})
