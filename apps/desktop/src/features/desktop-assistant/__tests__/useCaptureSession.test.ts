import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { getInvokeMock, resetInvokeMock } from '../../../__tests__/mocks/tauri'
import { useCaptureSession } from '../hooks/useCaptureSession'

const emptyCapture = {
  session_id: 'selection-session',
  content: null,
  sanitized_content: null,
  source_app: 'Preview',
  source_app_bundle_id: 'com.apple.Preview',
  window_title: 'Paper.pdf',
  status: 'ready',
  privacy_check: null,
}

const blockedConfirmation = {
  confirmed: false,
  content: null,
  reason: '旧内容包含敏感字段',
  privacy_check: {
    allowed: false,
    content_sensitive: true,
    content_redacted: false,
    redaction_kinds: [],
  },
}

function mockPendingConfirmation() {
  let resolve!: (value: unknown) => void
  let reject!: (reason: Error) => void
  const response = new Promise<unknown>((resolveResponse, rejectResponse) => {
    resolve = resolveResponse
    reject = rejectResponse
  })
  let captures = 0
  let confirmations = 0
  getInvokeMock().mockImplementation(async (command: string) => {
    if (command === 'assistant_get_clipboard') {
      captures += 1
      return { ...emptyCapture, session_id: `capture-${captures}`, content: `content ${captures}` }
    }
    if (command === 'assistant_confirm_capture') {
      confirmations += 1
      return confirmations === 1 ? response : undefined
    }
    if (command === 'assistant_discard_capture') return undefined
    throw new Error(`Unmocked invoke: ${command}`)
  })
  return { resolve, reject }
}

describe('useCaptureSession', () => {
  beforeEach(() => resetInvokeMock())

  it('falls back from an empty selection to clipboard and records the real source', async () => {
    getInvokeMock().mockImplementation(async (command: string) => {
      if (command === 'assistant_get_selection') return emptyCapture
      if (command === 'assistant_get_clipboard') {
        return {
          ...emptyCapture,
          session_id: 'clipboard-session',
          content: 'clipboard text',
        }
      }
      if (command === 'assistant_discard_capture') return undefined
      throw new Error(`Unmocked invoke: ${command}`)
    })

    const { result } = renderHook(() => useCaptureSession())
    await act(async () => {
      await result.current.startCapture('selection')
    })

    expect(result.current.session?.id).toBe('clipboard-session')
    expect(result.current.session?.sourceType).toBe('clipboard')
    expect(result.current.session?.content).toBe('clipboard text')
  })

  it('falls back to editable paste input when selection and clipboard are empty', async () => {
    getInvokeMock().mockImplementation(async (command: string) => {
      if (command === 'assistant_get_selection') return emptyCapture
      if (command === 'assistant_get_clipboard') {
        return { ...emptyCapture, session_id: 'clipboard-session' }
      }
      if (command === 'assistant_create_paste_session') {
        return {
          ...emptyCapture,
          session_id: 'paste-session',
          source_app: null,
          source_app_bundle_id: null,
          window_title: null,
        }
      }
      if (command === 'assistant_discard_capture') return undefined
      throw new Error(`Unmocked invoke: ${command}`)
    })

    const { result } = renderHook(() => useCaptureSession())
    await act(async () => {
      await result.current.startCapture('selection')
    })

    expect(result.current.session?.sourceType).toBe('paste')
    expect(result.current.session?.status).toBe('ready')

    act(() => result.current.updateContent('manually entered text'))
    await waitFor(() => {
      expect(result.current.session?.content).toBe('manually entered text')
    })
  })

  it('discards a cancelled selection without reading the clipboard fallback', async () => {
    let resolveSelection!: (capture: typeof emptyCapture) => void
    const selection = new Promise<typeof emptyCapture>((resolve) => { resolveSelection = resolve })
    getInvokeMock().mockImplementation(async (command: string) => {
      if (command === 'assistant_get_selection') return selection
      if (command === 'assistant_get_clipboard') return { ...emptyCapture, session_id: 'clipboard-session' }
      if (command === 'assistant_create_paste_session') return { ...emptyCapture, session_id: 'paste-session' }
      if (command === 'assistant_discard_capture') return undefined
      throw new Error(`Unmocked invoke: ${command}`)
    })
    const { result } = renderHook(() => useCaptureSession())
    let capture!: Promise<void>
    act(() => { capture = result.current.startCapture('selection') })
    await waitFor(() => expect(getInvokeMock()).toHaveBeenCalledWith('assistant_get_selection', undefined))
    act(() => result.current.cancelCapture())

    await act(async () => {
      resolveSelection(emptyCapture)
      await capture
    })
    expect(getInvokeMock()).toHaveBeenCalledWith('assistant_discard_capture', { sessionId: 'selection-session' })
    expect(getInvokeMock().mock.calls.map(([command]) => command)).toEqual([
      'assistant_get_selection', 'assistant_discard_capture',
    ])
    expect(result.current.session).toBeNull()
    expect(result.current.status).toBe('idle')
    expect(result.current.privacyError).toBeNull()
  })

  it('reads the clipboard only once before paste when the selection request fails', async () => {
    getInvokeMock().mockImplementation(async (command: string) => {
      if (command === 'assistant_get_selection') throw new Error('Selection unavailable')
      if (command === 'assistant_get_clipboard') return { ...emptyCapture, session_id: 'clipboard-session' }
      if (command === 'assistant_create_paste_session') return { ...emptyCapture, session_id: 'paste-session' }
      if (command === 'assistant_discard_capture') return undefined
      throw new Error(`Unmocked invoke: ${command}`)
    })
    const { result } = renderHook(() => useCaptureSession())
    await act(async () => { await result.current.startCapture('selection') })

    expect(getInvokeMock().mock.calls.map(([command]) => command)).toEqual([
      'assistant_get_selection', 'assistant_get_clipboard',
      'assistant_discard_capture', 'assistant_create_paste_session',
    ])
    expect(result.current.session).toMatchObject({
      id: 'paste-session', sourceType: 'paste', status: 'ready', userConfirmed: false,
    })
    expect(result.current.privacyError).toBeNull()
  })

  it('uses the sanitized preview returned by the backend', async () => {
    getInvokeMock().mockResolvedValue({
      ...emptyCapture,
      session_id: 'clipboard-session',
      content: 'email: researcher@example.com',
      sanitized_content: 'email: [EMAIL]',
    })

    const { result } = renderHook(() => useCaptureSession())
    await act(async () => {
      await result.current.startCapture('clipboard')
    })

    expect(result.current.session?.content).toBe('email: [EMAIL]')
  })

  it('keeps the verified screenshot pixel range in the preview session', async () => {
    getInvokeMock().mockResolvedValue({
      ...emptyCapture,
      session_id: 'screenshot-session',
      content: 'data:image/png;base64,iVBORw0KGgo=',
      capture_region: { x: -1280, y: 40, width: 1280, height: 720 },
    })
    const { result } = renderHook(() => useCaptureSession())
    await act(async () => {
      await result.current.startCapture('screenshot')
    })
    // 系统交互式截图不返回坐标，须走自有跨显示器选区层命令。
    expect(
      getInvokeMock().mock.calls.some(
        ([command]) => command === 'assistant_capture_screen_overlay',
      ),
    ).toBe(true)
    expect(result.current.session?.captureRegion).toEqual({
      x: -1280,
      y: 40,
      width: 1280,
      height: 720,
    })
  })

  it('persists confirmation and discards metadata when the user cancels', async () => {
    getInvokeMock().mockImplementation(async (command: string, args?: unknown) => {
      if (command === 'assistant_get_clipboard') {
        return {
          ...emptyCapture,
          session_id: 'clipboard-session',
          content: 'confirmed content',
        }
      }
      if (command === 'assistant_confirm_capture') {
        expect(args).toEqual({
          sessionId: 'clipboard-session',
          content: 'confirmed content',
        })
        return undefined
      }
      if (command === 'assistant_discard_capture') {
        expect(args).toEqual({ sessionId: 'clipboard-session' })
        return undefined
      }
      throw new Error(`Unmocked invoke: ${command}`)
    })

    const { result } = renderHook(() => useCaptureSession())
    await act(async () => {
      await result.current.startCapture('clipboard')
    })
    await act(async () => {
      await result.current.confirmCapture()
    })
    expect(result.current.session?.userConfirmed).toBe(true)

    act(() => result.current.cancelCapture())
    expect(result.current.session).toBeNull()
    await waitFor(() => {
      expect(getInvokeMock()).toHaveBeenCalledWith('assistant_discard_capture', {
        sessionId: 'clipboard-session',
      })
    })
  })

  it('auto-confirms captured content when full preview is explicitly disabled', async () => {
    getInvokeMock().mockImplementation(async (command: string, args?: unknown) => {
      if (command === 'assistant_get_clipboard') {
        return {
          ...emptyCapture,
          session_id: 'auto-confirm-session',
          content: 'captured content',
        }
      }
      if (command === 'assistant_confirm_capture') {
        expect(args).toEqual({
          sessionId: 'auto-confirm-session',
          content: 'captured content',
        })
        return undefined
      }
      throw new Error(`Unmocked invoke: ${command}`)
    })

    const { result } = renderHook(() => useCaptureSession(false))
    await act(async () => {
      await result.current.startCapture('clipboard')
    })

    await waitFor(() => expect(result.current.session?.userConfirmed).toBe(true))
  })

  it('keeps manual paste editable even when full preview is disabled', async () => {
    getInvokeMock().mockImplementation(async (command: string) => {
      if (command === 'assistant_create_paste_session') {
        return {
          ...emptyCapture,
          session_id: 'paste-session',
          source_app: null,
          source_app_bundle_id: null,
          window_title: null,
        }
      }
      throw new Error(`Unmocked invoke: ${command}`)
    })

    const { result } = renderHook(() => useCaptureSession(false))
    await act(async () => {
      await result.current.startCapture('paste')
    })
    act(() => result.current.updateContent('still editing'))

    await waitFor(() => expect(result.current.session?.content).toBe('still editing'))
    expect(result.current.session?.userConfirmed).toBe(false)
    expect(getInvokeMock()).not.toHaveBeenCalledWith(
      'assistant_confirm_capture',
      expect.anything(),
    )
  })

  it('limits manually pasted text to fifty thousand Unicode characters', async () => {
    getInvokeMock().mockImplementation(async (command: string) => {
      if (command === 'assistant_create_paste_session') {
        return {
          ...emptyCapture,
          session_id: 'long-paste-session',
          source_app: null,
          source_app_bundle_id: null,
          window_title: null,
        }
      }
      throw new Error(`Unmocked invoke: ${command}`)
    })

    const { result } = renderHook(() => useCaptureSession())
    await act(async () => {
      await result.current.startCapture('paste')
    })
    act(() => result.current.updateContent('研'.repeat(50_001)))

    expect(Array.from(result.current.session?.content ?? '')).toHaveLength(50_000)
    expect(result.current.session?.originalCharacterCount).toBe(50_001)
    expect(result.current.session?.contentTruncated).toBe(true)
  })

  it('keeps detected PII redacted and requires an extra confirmation', async () => {
    getInvokeMock().mockImplementation(async (command: string, args?: unknown) => {
      if (command === 'assistant_get_clipboard') {
        return {
          ...emptyCapture,
          session_id: 'redacted-session',
          content: '联系 [EMAIL]',
          sanitized_content: '联系 [EMAIL]',
          privacy_check: {
            allowed: true,
            reason: null,
            app_blocked: false,
            app_not_allowed: false,
            window_blocked: false,
            content_sensitive: false,
            content_redacted: true,
            redaction_kinds: ['邮箱'],
          },
        }
      }
      if (command === 'assistant_confirm_capture') {
        expect(args).toEqual({
          sessionId: 'redacted-session',
          content: '联系 [EMAIL]',
        })
        return {
          confirmed: true,
          content: '联系 [EMAIL]',
          reason: null,
          privacy_check: {
            allowed: true,
            content_redacted: false,
            redaction_kinds: [],
          },
        }
      }
      throw new Error(`Unmocked invoke: ${command}`)
    })
    const { result } = renderHook(() => useCaptureSession(false))
    await act(async () => {
      await result.current.startCapture('clipboard')
    })
    expect(result.current.session?.content).toBe('联系 [EMAIL]')
    expect(result.current.session?.userConfirmed).toBe(false)
    expect(getInvokeMock()).not.toHaveBeenCalledWith(
      'assistant_confirm_capture',
      expect.anything(),
    )

    act(() => { void result.current.confirmCapture() })
    expect(result.current.session?.sensitiveConfirmationArmed).toBe(true)
    await act(async () => {
      await result.current.confirmCapture()
    })
    expect(result.current.session?.userConfirmed).toBe(true)
  })

  it('rechecks edited paste content and clears explicitly blocked credentials', async () => {
    getInvokeMock().mockImplementation(async (command: string) => {
      if (command === 'assistant_create_paste_session') {
        return {
          ...emptyCapture,
          session_id: 'paste-sensitive',
          source_app: null,
          source_app_bundle_id: null,
          window_title: null,
        }
      }
      if (command === 'assistant_confirm_capture') {
        return {
          confirmed: false,
          content: null,
          reason: '内容包含敏感字段',
          privacy_check: {
            allowed: false,
            content_sensitive: true,
            content_redacted: false,
            redaction_kinds: [],
          },
        }
      }
      throw new Error(`Unmocked invoke: ${command}`)
    })
    const { result } = renderHook(() => useCaptureSession())
    await act(async () => {
      await result.current.startCapture('paste')
    })
    act(() => result.current.updateContent('password: correct-horse'))
    await act(async () => {
      await result.current.confirmCapture()
    })
    expect(result.current.session?.content).toBeNull()
    expect(result.current.session?.status).toBe('error')
    expect(result.current.privacyError).toBe('内容包含敏感字段')
    expect(result.current.session?.userConfirmed).toBe(false)
  })

  it.each(['rejected', 'blocked'] as const)(
    'ignores a %s confirmation after another capture replaces the session',
    async (outcome) => {
      const pending = mockPendingConfirmation()
      const { result } = renderHook(() => useCaptureSession())
      await act(async () => { await result.current.startCapture('clipboard') })
      let confirmation!: Promise<void>
      act(() => { confirmation = result.current.confirmCapture() })
      await waitFor(() => expect(getInvokeMock()).toHaveBeenCalledWith(
        'assistant_confirm_capture', { sessionId: 'capture-1', content: 'content 1' },
      ))
      await act(async () => { await result.current.startCapture('clipboard') })

      await act(async () => {
        if (outcome === 'rejected') pending.reject(new Error('旧确认请求失败'))
        else pending.resolve(blockedConfirmation)
        await confirmation
      })

      expect(result.current.session).toMatchObject({
        id: 'capture-2', content: 'content 2', status: 'ready', userConfirmed: false,
      })
      expect(result.current.status).toBe('ready')
      expect(result.current.privacyError).toBeNull()
      expect(result.current.confirming).toBe(false)
    },
  )

  it('requires a fresh confirmation of edited content after an older confirmation succeeds', async () => {
    const pending = mockPendingConfirmation()
    const { result } = renderHook(() => useCaptureSession())
    await act(async () => { await result.current.startCapture('clipboard') })
    let confirmation!: Promise<void>
    act(() => { confirmation = result.current.confirmCapture() })
    await waitFor(() => expect(getInvokeMock()).toHaveBeenCalledWith(
      'assistant_confirm_capture', { sessionId: 'capture-1', content: 'content 1' },
    ))

    act(() => result.current.updateContent('edited content'))
    await act(async () => {
      pending.resolve(undefined)
      await confirmation
    })
    expect(result.current.session).toMatchObject({
      content: 'edited content', userConfirmed: false, status: 'ready',
    })
    expect(result.current.confirming).toBe(false)

    await act(async () => { await result.current.confirmCapture() })
    expect(getInvokeMock()).toHaveBeenLastCalledWith('assistant_confirm_capture', {
      sessionId: 'capture-1', content: 'edited content',
    })
    expect(result.current.session?.userConfirmed).toBe(true)
  })

  it.each([
    ['cancelCapture', 'resolved'], ['cancelCapture', 'rejected'], ['cancelCapture', 'blocked'],
    ['clearSession', 'resolved'], ['clearSession', 'rejected'], ['clearSession', 'blocked'],
  ] as const)('keeps %s idle when a pending confirmation is %s', async (clear, outcome) => {
    const pending = mockPendingConfirmation()
    const { result } = renderHook(() => useCaptureSession())
    await act(async () => { await result.current.startCapture('clipboard') })
    let confirmation!: Promise<void>
    act(() => { confirmation = result.current.confirmCapture() })
    await waitFor(() => expect(getInvokeMock()).toHaveBeenCalledWith(
      'assistant_confirm_capture', { sessionId: 'capture-1', content: 'content 1' },
    ))
    act(() => result.current[clear]())

    await act(async () => {
      if (outcome === 'rejected') pending.reject(new Error('已关闭会话的确认失败'))
      else pending.resolve(outcome === 'blocked' ? blockedConfirmation : undefined)
      await confirmation
    })
    expect(result.current.session).toBeNull()
    expect(result.current.status).toBe('idle')
    expect(result.current.privacyError).toBeNull()
    expect(result.current.confirming).not.toBe(true)
  })

  it.each(['resolved', 'rejected', 'blocked'] as const)(
    'does not resume a capture after unmount when its confirmation is %s',
    async (outcome) => {
      const pending = mockPendingConfirmation()
      let renders = 0
      const { result, unmount } = renderHook(() => {
        renders += 1
        return useCaptureSession()
      })
      await act(async () => { await result.current.startCapture('clipboard') })
      let confirmation!: Promise<void>
      act(() => { confirmation = result.current.confirmCapture() })
      await waitFor(() => expect(getInvokeMock()).toHaveBeenCalledWith(
        'assistant_confirm_capture', { sessionId: 'capture-1', content: 'content 1' },
      ))
      unmount()
      const rendersAtUnmount = renders
      const callsAtUnmount = getInvokeMock().mock.calls.length

      await act(async () => {
        if (outcome === 'rejected') pending.reject(new Error('已卸载会话的确认失败'))
        else pending.resolve(outcome === 'blocked' ? blockedConfirmation : undefined)
        await confirmation
      })
      expect(renders).toBe(rendersAtUnmount)
      expect(getInvokeMock()).toHaveBeenCalledTimes(callsAtUnmount)
    },
  )

  it('submits once for two confirmations in the same tick and exposes pending state', async () => {
    const pending = mockPendingConfirmation()
    const { result } = renderHook(() => useCaptureSession())
    await act(async () => { await result.current.startCapture('clipboard') })
    let confirmations!: Promise<void>[]
    await act(async () => {
      confirmations = [result.current.confirmCapture(), result.current.confirmCapture()]
      await confirmations[1]
    })
    expect(getInvokeMock().mock.calls.filter(
      ([command]) => command === 'assistant_confirm_capture',
    )).toHaveLength(1)
    expect(result.current.confirming).toBe(true)
    expect(result.current.session?.userConfirmed).toBe(false)

    await act(async () => {
      pending.resolve(undefined)
      await Promise.all(confirmations)
    })
    expect(result.current.session?.userConfirmed).toBe(true)
    expect(result.current.confirming).toBe(false)
  })
})
