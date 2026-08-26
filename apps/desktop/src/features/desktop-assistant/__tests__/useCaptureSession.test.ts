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
})
