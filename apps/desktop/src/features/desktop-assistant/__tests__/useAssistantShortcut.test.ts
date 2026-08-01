import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { getInvokeMock, resetInvokeMock } from '../../../__tests__/mocks/tauri'
import { useAssistantShortcut } from '../hooks/useAssistantShortcut'

describe('useAssistantShortcut', () => {
  beforeEach(() => resetInvokeMock())

  it('loads and updates the registered shortcut', async () => {
    getInvokeMock().mockImplementation(async (command: string, args?: unknown) => {
      if (command === 'assistant_get_shortcut') return 'Alt+Space'
      if (command === 'assistant_get_shortcut_diagnostic') {
        return {
          status: 'healthy',
          requested_shortcut: 'Alt+Space',
          active_shortcut: 'Alt+Space',
          message: '',
          updated_at: '2026-07-29T00:00:00Z',
        }
      }
      if (command === 'assistant_set_shortcut') {
        expect(args).toEqual({ shortcut: 'Command+Shift+Y' })
        return 'Command+Shift+Y'
      }
      throw new Error(`Unmocked invoke: ${command}`)
    })

    const { result } = renderHook(() => useAssistantShortcut())
    await waitFor(() => expect(result.current.loading).toBe(false))

    let saved = false
    await act(async () => {
      saved = await result.current.save('Command+Shift+Y')
    })

    expect(saved).toBe(true)
    expect(result.current.shortcut).toBe('Command+Shift+Y')
    expect(result.current.error).toBeNull()
  })

  it('keeps the previous shortcut when registration fails', async () => {
    getInvokeMock().mockImplementation(async (command: string) => {
      if (command === 'assistant_get_shortcut') return 'Alt+Space'
      if (command === 'assistant_get_shortcut_diagnostic') {
        return {
          status: 'degraded',
          requested_shortcut: 'Command+Shift+Y',
          active_shortcut: 'Alt+Space',
          message: '快捷键已被占用',
          updated_at: '2026-07-29T00:00:00Z',
        }
      }
      if (command === 'assistant_set_shortcut') {
        throw new Error('快捷键已被占用')
      }
      throw new Error(`Unmocked invoke: ${command}`)
    })

    const { result } = renderHook(() => useAssistantShortcut())
    await waitFor(() => expect(result.current.loading).toBe(false))

    let saved = true
    await act(async () => {
      saved = await result.current.save('Command+Shift+Y')
    })

    expect(saved).toBe(false)
    expect(result.current.shortcut).toBe('Alt+Space')
    expect(result.current.error).toContain('已被占用')
    expect(result.current.diagnostic?.status).toBe('degraded')
  })

  it('retries the requested shortcut and clears the diagnostic state', async () => {
    getInvokeMock().mockImplementation(async (command: string) => {
      if (command === 'assistant_get_shortcut') return 'Alt+Space'
      if (command === 'assistant_get_shortcut_diagnostic') {
        return {
          status: 'degraded',
          requested_shortcut: 'Command+Shift+Y',
          active_shortcut: 'Alt+Space',
          message: '快捷键已被占用',
          updated_at: '2026-07-29T00:00:00Z',
        }
      }
      if (command === 'assistant_retry_shortcut') return 'Command+Shift+Y'
      throw new Error(`Unmocked invoke: ${command}`)
    })

    const { result } = renderHook(() => useAssistantShortcut())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.retry()
    })

    expect(result.current.shortcut).toBe('Command+Shift+Y')
    expect(result.current.diagnostic?.status).toBe('healthy')
  })
})
