import { act, renderHook, waitFor } from '@testing-library/react'
import { listen } from '@tauri-apps/api/event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getInvokeMock, resetInvokeMock } from '../../../__tests__/mocks/tauri'
import {
  registerAssistantDirectActionStarter,
  startAssistantDirectAction,
} from '../directActionBridge'
import { useAssistantDirectShortcuts } from '../hooks/useAssistantDirectShortcuts'
import { useCaptureSession } from '../hooks/useCaptureSession'
import type { StartAssistantActionInput } from '../hooks/useAssistantActionStream'
import type { AssistantDirectShortcutStatus } from '../shared'

type EventHandler = (event: { payload: unknown }) => void

const listenMock = listen as unknown as ReturnType<typeof vi.fn>

function captureEventHandlers() {
  const handlers = new Map<string, EventHandler>()
  listenMock.mockImplementation(async (event: string, handler: EventHandler) => {
    handlers.set(event, handler)
    return () => {
      handlers.delete(event)
    }
  })
  return handlers
}

const PRIVACY_ALLOWED = {
  allowed: true,
  reason: null,
  app_blocked: false,
  app_not_allowed: false,
  window_blocked: false,
  content_sensitive: false,
  content_redacted: false,
  redaction_kinds: [],
}

function readyCaptureResponse(sessionId: string, content: string) {
  return {
    session_id: sessionId,
    content,
    sanitized_content: null,
    source_app: null,
    source_app_bundle_id: null,
    window_title: null,
    capture_region: null,
    original_character_count: content.length,
    content_truncated: false,
    status: 'ready',
    privacy_check: PRIVACY_ALLOWED,
  }
}

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

describe('directActionBridge', () => {
  it('routes direct action starts to the registered starter and releases it', async () => {
    expect(startAssistantDirectAction({
      action: 'interpret',
      sessionId: 'cap-0',
      content: 'x',
    })).toBeNull()

    const starter = vi.fn(async (_input: StartAssistantActionInput) => true)
    const unregister = registerAssistantDirectActionStarter(starter)
    const outcome = await startAssistantDirectAction({
      action: 'translate',
      sessionId: 'cap-0',
      content: 'x',
    })
    expect(outcome).toBe(true)
    expect(starter).toHaveBeenCalledWith({
      action: 'translate',
      sessionId: 'cap-0',
      content: 'x',
    })

    unregister()
    expect(startAssistantDirectAction({
      action: 'interpret',
      sessionId: 'cap-0',
      content: 'x',
    })).toBeNull()
  })
})

describe('useAssistantDirectShortcuts', () => {
  beforeEach(() => resetInvokeMock())

  it('loads statuses and enables an action with the recorded shortcut', async () => {
    getInvokeMock().mockImplementation(async (command: string, args?: unknown) => {
      if (command === 'assistant_get_direct_shortcuts') return allStatuses()
      if (command === 'assistant_set_direct_shortcut') {
        expect(args).toEqual({ action: 'translate', shortcut: 'Alt+2' })
        return directStatus('translate', {
          configured_shortcut: 'Alt+2',
          active_shortcut: 'Alt+2',
        })
      }
      throw new Error(`Unmocked invoke: ${command}`)
    })

    const { result } = renderHook(() => useAssistantDirectShortcuts())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.statuses).toHaveLength(3)
    expect(result.current.statuses[0].configured_shortcut).toBe('Alt+1')

    let saved = false
    await act(async () => {
      saved = await result.current.save('translate', 'Alt+2')
    })
    expect(saved).toBe(true)
    expect(
      result.current.statuses.find((status) => status.action === 'translate')
        ?.active_shortcut,
    ).toBe('Alt+2')
  })

  it('keeps the diagnostic visible and retries after a registration conflict', async () => {
    const diagnostic: AssistantDirectShortcutStatus['diagnostic'] = {
      status: 'error',
      requested_shortcut: 'Alt+2',
      active_shortcut: null,
      message: '快捷键注册失败，可能已被其他应用占用',
      updated_at: '2026-08-26T00:00:00Z',
    }
    let allowRegistration = false
    getInvokeMock().mockImplementation(async (command: string, args?: unknown) => {
      if (command === 'assistant_get_direct_shortcuts') {
        return [
          directStatus('interpret', {
            configured_shortcut: 'Alt+1',
            active_shortcut: 'Alt+1',
          }),
          directStatus('translate', {
            configured_shortcut: 'Alt+2',
            active_shortcut: allowRegistration ? 'Alt+2' : null,
            diagnostic: allowRegistration ? null : diagnostic,
          }),
          directStatus('screenshot'),
        ]
      }
      if (command === 'assistant_set_direct_shortcut') {
        throw new Error('快捷键注册失败，可能已被其他应用占用')
      }
      if (command === 'assistant_retry_direct_shortcut') {
        expect(args).toEqual({ action: 'translate' })
        allowRegistration = true
        return directStatus('translate', {
          configured_shortcut: 'Alt+2',
          active_shortcut: 'Alt+2',
        })
      }
      throw new Error(`Unmocked invoke: ${command}`)
    })

    const { result } = renderHook(() => useAssistantDirectShortcuts())
    await waitFor(() => expect(result.current.loading).toBe(false))

    let saved = true
    await act(async () => {
      saved = await result.current.save('translate', 'Alt+2')
    })
    expect(saved).toBe(false)
    expect(result.current.error).toContain('占用')

    let retried = false
    await act(async () => {
      retried = await result.current.retry('translate')
    })
    expect(retried).toBe(true)
    expect(
      result.current.statuses.find((status) => status.action === 'translate')
        ?.diagnostic,
    ).toBeNull()
  })
})

describe('useCaptureSession 直达动作', () => {
  beforeEach(() => {
    resetInvokeMock()
    listenMock.mockReset()
  })

  it('auto-starts the preset translate action once the capture is confirmed', async () => {
    const handlers = captureEventHandlers()
    getInvokeMock().mockImplementation(async (command: string) => {
      if (command === 'assistant_get_selection') {
        return readyCaptureResponse('cap-1', 'Bonjour le monde')
      }
      if (command === 'assistant_confirm_capture') {
        return {
          confirmed: true,
          content: 'Bonjour le monde',
          reason: null,
          privacy_check: PRIVACY_ALLOWED,
        }
      }
      if (command === 'assistant_get_translation_preferences') {
        return { target_language: 'en', terminology_style: 'original' }
      }
      throw new Error(`Unmocked invoke: ${command}`)
    })
    const starter = vi.fn(async (_input: StartAssistantActionInput) => true)
    const unregister = registerAssistantDirectActionStarter(starter)

    renderHook(() => useCaptureSession(false, true))
    await waitFor(() => expect(handlers.has('assistant://direct-action')).toBe(true))

    await act(async () => {
      handlers.get('assistant://direct-action')?.({ payload: 'translate' })
    })

    await waitFor(() => expect(starter).toHaveBeenCalled())
    expect(starter).toHaveBeenCalledWith(expect.objectContaining({
      action: 'translate',
      sessionId: 'cap-1',
      content: 'Bonjour le monde',
      targetLang: 'en',
      terminologyStyle: 'original',
    }))
    unregister()
  })

  it('waits for the preview confirmation before starting the preset action', async () => {
    const handlers = captureEventHandlers()
    getInvokeMock().mockImplementation(async (command: string) => {
      if (command === 'assistant_get_selection') {
        return readyCaptureResponse('cap-2', '一段需要解读的文字')
      }
      if (command === 'assistant_confirm_capture') {
        return {
          confirmed: true,
          content: '一段需要解读的文字',
          reason: null,
          privacy_check: PRIVACY_ALLOWED,
        }
      }
      throw new Error(`Unmocked invoke: ${command}`)
    })
    const starter = vi.fn(async (_input: StartAssistantActionInput) => true)
    const unregister = registerAssistantDirectActionStarter(starter)

    const { result } = renderHook(() => useCaptureSession(true, true))
    await waitFor(() => expect(handlers.has('assistant://direct-action')).toBe(true))

    await act(async () => {
      handlers.get('assistant://direct-action')?.({ payload: 'interpret' })
    })

    await waitFor(() => expect(result.current.session?.status).toBe('ready'))
    expect(starter).not.toHaveBeenCalled()

    await act(async () => {
      await result.current.confirmCapture()
    })
    await waitFor(() => expect(starter).toHaveBeenCalled())
    expect(starter).toHaveBeenCalledWith(expect.objectContaining({
      action: 'interpret',
      sessionId: 'cap-2',
      content: '一段需要解读的文字',
    }))
    unregister()
  })

  it('starts the capture overlay for the screenshot direct action without presetting an action', async () => {
    const handlers = captureEventHandlers()
    getInvokeMock().mockImplementation(async (command: string) => {
      if (command === 'assistant_capture_screen_overlay') {
        return readyCaptureResponse('cap-3', 'data:image/png;base64,xxxx')
      }
      throw new Error(`Unmocked invoke: ${command}`)
    })
    const starter = vi.fn(async (_input: StartAssistantActionInput) => true)
    const unregister = registerAssistantDirectActionStarter(starter)

    const { result } = renderHook(() => useCaptureSession(false, true))
    await waitFor(() => expect(handlers.has('assistant://direct-action')).toBe(true))

    await act(async () => {
      handlers.get('assistant://direct-action')?.({ payload: 'screenshot' })
    })

    await waitFor(() => expect(result.current.session?.status).toBe('ready'))
    expect(result.current.session?.sourceType).toBe('screenshot')
    expect(starter).not.toHaveBeenCalled()
    unregister()
  })

  it('binds the direct action to the fresh capture instead of a previously confirmed session', async () => {
    const handlers = captureEventHandlers()
    let captureSessionId = 'cap-old'
    let captureContent = '旧采集内容'
    getInvokeMock().mockImplementation(async (command: string, args?: unknown) => {
      if (command === 'assistant_get_selection') {
        return readyCaptureResponse(captureSessionId, captureContent)
      }
      if (command === 'assistant_confirm_capture') {
        return {
          confirmed: true,
          content: (args as { content: string }).content,
          reason: null,
          privacy_check: PRIVACY_ALLOWED,
        }
      }
      throw new Error(`Unmocked invoke: ${command}`)
    })
    const starter = vi.fn(async (_input: StartAssistantActionInput) => true)
    const unregister = registerAssistantDirectActionStarter(starter)

    const { result } = renderHook(() => useCaptureSession(false, true))
    await waitFor(() => expect(handlers.has('assistant://direct-action')).toBe(true))

    // 先完成一次旧采集并确认，模拟上次遗留的已确认会话。
    await act(async () => {
      await result.current.startCapture('selection')
    })
    await waitFor(() => expect(result.current.session?.userConfirmed).toBe(true))
    expect(result.current.session?.id).toBe('cap-old')

    // 直达动作到达后必须重新采集，动作只能绑定本次新会话与新内容。
    captureSessionId = 'cap-new'
    captureContent = '新采集内容'
    await act(async () => {
      handlers.get('assistant://direct-action')?.({ payload: 'interpret' })
    })

    await waitFor(() => expect(starter).toHaveBeenCalled())
    expect(starter).toHaveBeenCalledTimes(1)
    expect(starter).toHaveBeenCalledWith(expect.objectContaining({
      action: 'interpret',
      sessionId: 'cap-new',
      content: '新采集内容',
    }))
    expect(starter).not.toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 'cap-old' }),
    )
    unregister()
  })

  it('discards a stale capture response when a newer direct action supersedes it', async () => {
    const handlers = captureEventHandlers()
    const discarded: string[] = []
    let selectionCalls = 0
    let holdFirstSelection: ((value: unknown) => void) | null = null
    getInvokeMock().mockImplementation(async (command: string, args?: unknown) => {
      if (command === 'assistant_get_selection') {
        selectionCalls += 1
        if (selectionCalls === 1) {
          return new Promise((resolve) => {
            holdFirstSelection = resolve
          })
        }
        return readyCaptureResponse('cap-new', '第二次采集内容')
      }
      if (command === 'assistant_confirm_capture') {
        return {
          confirmed: true,
          content: (args as { content: string }).content,
          reason: null,
          privacy_check: PRIVACY_ALLOWED,
        }
      }
      if (command === 'assistant_get_translation_preferences') {
        return { target_language: 'en', terminology_style: 'original' }
      }
      if (command === 'assistant_discard_capture') {
        discarded.push((args as { sessionId: string }).sessionId)
        return undefined
      }
      throw new Error(`Unmocked invoke: ${command}`)
    })
    const starter = vi.fn(async (_input: StartAssistantActionInput) => true)
    const unregister = registerAssistantDirectActionStarter(starter)

    const { result } = renderHook(() => useCaptureSession(false, true))
    await waitFor(() => expect(handlers.has('assistant://direct-action')).toBe(true))

    await act(async () => {
      handlers.get('assistant://direct-action')?.({ payload: 'interpret' })
    })
    // 第一次采集尚未返回时，第二次直达动作到达并发起新采集。
    await act(async () => {
      handlers.get('assistant://direct-action')?.({ payload: 'translate' })
    })
    // 第一次（已过期）的采集响应随后才落地。
    await act(async () => {
      holdFirstSelection?.(readyCaptureResponse('cap-stale', '过期内容'))
    })

    await waitFor(() => expect(starter).toHaveBeenCalled())
    expect(discarded).toContain('cap-stale')
    expect(starter).toHaveBeenCalledTimes(1)
    expect(starter).toHaveBeenCalledWith(expect.objectContaining({
      action: 'translate',
      sessionId: 'cap-new',
      content: '第二次采集内容',
    }))
    expect(result.current.session?.id).toBe('cap-new')
    unregister()
  })

  it('keeps the confirmed session for manual action selection when the starter fails', async () => {
    const handlers = captureEventHandlers()
    getInvokeMock().mockImplementation(async (command: string, args?: unknown) => {
      if (command === 'assistant_get_selection') {
        return readyCaptureResponse('cap-fail', '需要解读的内容')
      }
      if (command === 'assistant_confirm_capture') {
        return {
          confirmed: true,
          content: (args as { content: string }).content,
          reason: null,
          privacy_check: PRIVACY_ALLOWED,
        }
      }
      throw new Error(`Unmocked invoke: ${command}`)
    })
    const starter = vi.fn(async (_input: StartAssistantActionInput) => false)
    const unregister = registerAssistantDirectActionStarter(starter)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { result } = renderHook(() => useCaptureSession(false, true))
    await waitFor(() => expect(handlers.has('assistant://direct-action')).toBe(true))

    await act(async () => {
      handlers.get('assistant://direct-action')?.({ payload: 'interpret' })
    })

    await waitFor(() => expect(starter).toHaveBeenCalled())
    // 启动失败：清除预设动作但保留已确认会话，用户仍可手动选择动作。
    await waitFor(() => expect(result.current.pendingAction).toBeNull())
    expect(result.current.session?.id).toBe('cap-fail')
    expect(result.current.session?.userConfirmed).toBe(true)
    unregister()
    warnSpy.mockRestore()
  })

  it('does not start a stale translate action after clearSession while waiting for preferences', async () => {
    const handlers = captureEventHandlers()
    let resolvePreferences: ((value: unknown) => void) | null = null
    getInvokeMock().mockImplementation(async (command: string, args?: unknown) => {
      if (command === 'assistant_get_selection') {
        return readyCaptureResponse('cap-clear', '清空前内容')
      }
      if (command === 'assistant_confirm_capture') {
        return {
          confirmed: true,
          content: (args as { content: string }).content,
          reason: null,
          privacy_check: PRIVACY_ALLOWED,
        }
      }
      if (command === 'assistant_get_translation_preferences') {
        return new Promise((resolve) => {
          resolvePreferences = resolve
        })
      }
      throw new Error(`Unmocked invoke: ${command}`)
    })
    const starter = vi.fn(async (_input: StartAssistantActionInput) => true)
    const unregister = registerAssistantDirectActionStarter(starter)

    const { result } = renderHook(() => useCaptureSession(false, true))
    await waitFor(() => expect(handlers.has('assistant://direct-action')).toBe(true))

    await act(async () => {
      handlers.get('assistant://direct-action')?.({ payload: 'translate' })
    })
    await waitFor(() => expect(result.current.session?.id).toBe('cap-clear'))

    await act(async () => {
      result.current.clearSession()
    })
    await act(async () => {
      resolvePreferences?.({ target_language: 'en', terminology_style: 'original' })
    })

    await waitFor(() => expect(result.current.session).toBeNull())
    expect(result.current.pendingAction).toBeNull()
    expect(starter).not.toHaveBeenCalled()
    unregister()
  })

  it('does not start a stale translate action after cancelCapture while waiting for preferences', async () => {
    const handlers = captureEventHandlers()
    let resolvePreferences: ((value: unknown) => void) | null = null
    getInvokeMock().mockImplementation(async (command: string, args?: unknown) => {
      if (command === 'assistant_get_selection') {
        return readyCaptureResponse('cap-cancel', '取消前内容')
      }
      if (command === 'assistant_confirm_capture') {
        return {
          confirmed: true,
          content: (args as { content: string }).content,
          reason: null,
          privacy_check: PRIVACY_ALLOWED,
        }
      }
      if (command === 'assistant_get_translation_preferences') {
        return new Promise((resolve) => {
          resolvePreferences = resolve
        })
      }
      throw new Error(`Unmocked invoke: ${command}`)
    })
    const starter = vi.fn(async (_input: StartAssistantActionInput) => true)
    const unregister = registerAssistantDirectActionStarter(starter)

    const { result } = renderHook(() => useCaptureSession(false, true))
    await waitFor(() => expect(handlers.has('assistant://direct-action')).toBe(true))

    await act(async () => {
      handlers.get('assistant://direct-action')?.({ payload: 'translate' })
    })
    await waitFor(() => expect(result.current.session?.id).toBe('cap-cancel'))

    await act(async () => {
      result.current.cancelCapture()
    })
    await act(async () => {
      resolvePreferences?.({ target_language: 'en', terminology_style: 'original' })
    })

    await waitFor(() => expect(result.current.session).toBeNull())
    expect(result.current.pendingAction).toBeNull()
    expect(starter).not.toHaveBeenCalled()
    unregister()
  })

  it('replaces a translate action waiting for preferences when a newer direct action arrives', async () => {
    const handlers = captureEventHandlers()
    let resolveFirstPreferences: ((value: unknown) => void) | null = null
    let selectionCalls = 0
    getInvokeMock().mockImplementation(async (command: string, args?: unknown) => {
      if (command === 'assistant_get_selection') {
        selectionCalls += 1
        if (selectionCalls === 1) {
          return readyCaptureResponse('cap-first', '第一次内容')
        }
        return readyCaptureResponse('cap-second', '第二次内容')
      }
      if (command === 'assistant_confirm_capture') {
        return {
          confirmed: true,
          content: (args as { content: string }).content,
          reason: null,
          privacy_check: PRIVACY_ALLOWED,
        }
      }
      if (command === 'assistant_get_translation_preferences') {
        return new Promise((resolve) => {
          resolveFirstPreferences = resolve
        })
      }
      throw new Error(`Unmocked invoke: ${command}`)
    })
    const starter = vi.fn(async (_input: StartAssistantActionInput) => true)
    const unregister = registerAssistantDirectActionStarter(starter)

    const { result } = renderHook(() => useCaptureSession(false, true))
    await waitFor(() => expect(handlers.has('assistant://direct-action')).toBe(true))

    await act(async () => {
      handlers.get('assistant://direct-action')?.({ payload: 'translate' })
    })
    await waitFor(() => expect(result.current.session?.id).toBe('cap-first'))

    await act(async () => {
      handlers.get('assistant://direct-action')?.({ payload: 'interpret' })
    })
    await waitFor(() => expect(starter).toHaveBeenCalled())

    expect(starter).toHaveBeenCalledTimes(1)
    expect(starter).toHaveBeenCalledWith(expect.objectContaining({
      action: 'interpret',
      sessionId: 'cap-second',
      content: '第二次内容',
    }))
    expect(starter).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: 'translate' }),
    )

    await act(async () => {
      resolveFirstPreferences?.({ target_language: 'en', terminology_style: 'original' })
    })
    expect(starter).toHaveBeenCalledTimes(1)
    expect(result.current.session?.id).toBe('cap-second')
    unregister()
  })
})
