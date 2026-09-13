import { createElement } from 'react'
import { act, render, renderHook, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { getInvokeMock, resetInvokeMock } from '../../../__tests__/mocks/tauri'
import { AssistantDirectShortcutsSection } from '../components/AssistantDirectShortcutsSection'
import { useAssistantDirectShortcuts } from '../hooks/useAssistantDirectShortcuts'
import type { AssistantDirectShortcutStatus } from '../shared'

function directStatus(
  action: string,
  overrides: Partial<AssistantDirectShortcutStatus> = {},
): AssistantDirectShortcutStatus {
  return {
    action: action as AssistantDirectShortcutStatus['action'],
    configured_shortcut: null,
    active_shortcut: null,
    diagnostic: null,
    ...overrides,
  }
}

function allStatuses(): AssistantDirectShortcutStatus[] {
  return [
    directStatus('interpret', {
      configured_shortcut: 'Alt+1',
      active_shortcut: 'Alt+1',
    }),
    directStatus('translate'),
    directStatus('screenshot'),
  ]
}

describe('直达快捷键 mutation 串行化', () => {
  beforeEach(() => resetInvokeMock())

  it('拒绝重叠 mutation，且在首个请求完成前保留忙碌状态', async () => {
    let resolveSave: ((value: AssistantDirectShortcutStatus) => void) | null = null
    getInvokeMock().mockImplementation(async (command: string, args?: unknown) => {
      if (command === 'assistant_get_direct_shortcuts') return allStatuses()
      if (command === 'assistant_set_direct_shortcut') {
        expect(args).toEqual({ action: 'translate', shortcut: 'Alt+2' })
        return new Promise<AssistantDirectShortcutStatus>((resolve) => {
          resolveSave = resolve
        })
      }
      throw new Error(`Unmocked invoke: ${command}`)
    })

    const { result } = renderHook(() => useAssistantDirectShortcuts())
    await waitFor(() => expect(result.current.loading).toBe(false))

    let firstSaved = false
    let firstPromise: Promise<boolean> | undefined
    await act(async () => {
      firstPromise = result.current.save('translate', 'Alt+2')
    })
    await waitFor(() => expect(result.current.savingAction).toBe('translate'))
    expect(result.current.busy).toBe(true)

    let overlappingSave = true
    let overlappingRetry = true
    await act(async () => {
      overlappingSave = await result.current.save('screenshot', 'Alt+3')
      overlappingRetry = await result.current.retry('interpret')
    })
    expect(overlappingSave).toBe(false)
    expect(overlappingRetry).toBe(false)
    expect(result.current.savingAction).toBe('translate')
    expect(result.current.busy).toBe(true)
    expect(
      getInvokeMock().mock.calls.filter(([command]) => command === 'assistant_set_direct_shortcut'),
    ).toHaveLength(1)
    expect(
      getInvokeMock().mock.calls.filter(([command]) => command === 'assistant_retry_direct_shortcut'),
    ).toHaveLength(0)

    await act(async () => {
      resolveSave?.(directStatus('translate', {
        configured_shortcut: 'Alt+2',
        active_shortcut: 'Alt+2',
      }))
      if (!firstPromise) {
        throw new Error('expected first save promise')
      }
      firstSaved = await firstPromise
    })
    expect(firstSaved).toBe(true)
    expect(result.current.savingAction).toBeNull()
    expect(result.current.busy).toBe(false)
    expect(
      result.current.statuses.find((status) => status.action === 'translate')
        ?.active_shortcut,
    ).toBe('Alt+2')
  })

  it('一个 mutation 进行中时锁定所有行控件，只显示当前行加载状态', async () => {
    const diagnostic: AssistantDirectShortcutStatus['diagnostic'] = {
      status: 'error',
      requested_shortcut: 'Alt+2',
      active_shortcut: null,
      message: '快捷键注册失败，可能已被其他应用占用',
      updated_at: '2026-08-26T00:00:00Z',
    }
    let resolveSave: ((value: AssistantDirectShortcutStatus) => void) | null = null
    getInvokeMock().mockImplementation(async (command: string) => {
      if (command === 'assistant_get_direct_shortcuts') {
        return [
          directStatus('interpret', {
            configured_shortcut: 'Alt+1',
            active_shortcut: 'Alt+1',
          }),
          directStatus('translate', {
            configured_shortcut: 'Alt+2',
            diagnostic,
          }),
          directStatus('screenshot'),
        ]
      }
      if (command === 'assistant_set_direct_shortcut') {
        return new Promise<AssistantDirectShortcutStatus>((resolve) => {
          resolveSave = resolve
        })
      }
      throw new Error(`Unmocked invoke: ${command}`)
    })

    render(createElement(AssistantDirectShortcutsSection))
    const closeButtons = await screen.findAllByRole('button', { name: '关闭' })
    expect(closeButtons).toHaveLength(2)

    const user = userEvent.setup()
    await user.click(closeButtons[0])

    await waitFor(() => {
      expect(closeButtons[0].querySelector('.animate-spin')).not.toBeNull()
    })
    expect(closeButtons[0]).toBeDisabled()
    expect(closeButtons[1]).toBeDisabled()
    expect(closeButtons[1].querySelector('.animate-spin')).toBeNull()
    expect(screen.getByRole('button', { name: '开启（Alt+3）' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '重试注册' })).toBeDisabled()
    expect(screen.getByLabelText('直接解读当前选区快捷键')).toBeDisabled()
    expect(screen.getByLabelText('直接翻译当前选区快捷键')).toBeDisabled()
    for (const apply of screen.getAllByRole('button', { name: '应用' })) {
      expect(apply).toBeDisabled()
    }
    expect(
      getInvokeMock().mock.calls.filter(([command]) => command === 'assistant_set_direct_shortcut'),
    ).toHaveLength(1)

    await act(async () => {
      resolveSave?.(directStatus('interpret'))
    })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '开启（Alt+1）' })).toBeEnabled()
    })
  })
})
