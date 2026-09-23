import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { getInvokeMock, resetInvokeMock } from '../../../__tests__/mocks/tauri'
import { useAssistantExtractText } from '../hooks/useAssistantExtractText'
import { useCaptureSession } from '../hooks/useCaptureSession'

const screenshotCapture = {
  session_id: 'screenshot-session',
  content: 'data:image/png;base64,iVBORw0KGgo=',
  sanitized_content: null,
  source_app: 'Preview',
  source_app_bundle_id: 'com.apple.Preview',
  window_title: null,
  status: 'ready',
  privacy_check: null,
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

describe('useAssistantExtractText', () => {
  beforeEach(() => resetInvokeMock())

  it('returns trimmed text from the backend vision channel', async () => {
    getInvokeMock().mockImplementation(async (command: string, args?: unknown) => {
      if (command === 'assistant_extract_text') {
        expect(args).toEqual({
          sessionId: 'screenshot-session',
          content: screenshotCapture.content,
        })
        return {
          id: 'result-1',
          session_id: 'screenshot-session',
          action: 'extract_text',
          content: '  提取出的文字\n第二行  ',
          format: 'text',
          metadata: null,
        }
      }
      throw new Error(`Unmocked invoke: ${command}`)
    })

    const { result } = renderHook(() => useAssistantExtractText())
    let text: string | null = null
    await act(async () => {
      text = await result.current.extractText(
        'screenshot-session',
        screenshotCapture.content,
      )
    })

    expect(text).toBe('提取出的文字\n第二行')
    expect(result.current.error).toBeNull()
    expect(result.current.extracting).toBe(false)
  })

  it('rejects non-image content without calling the backend', async () => {
    const { result } = renderHook(() => useAssistantExtractText())
    let text: string | null = 'initial'
    await act(async () => {
      text = await result.current.extractText('session', 'plain text')
    })

    expect(text).toBeNull()
    expect(result.current.error).toContain('仅支持截图')
    expect(getInvokeMock()).not.toHaveBeenCalled()
  })

  it('shows a next-step hint when OCR returns empty text', async () => {
    getInvokeMock().mockResolvedValue({
      id: 'result-1',
      session_id: 'screenshot-session',
      action: 'extract_text',
      content: '   ',
      format: 'text',
      metadata: null,
    })

    const { result } = renderHook(() => useAssistantExtractText())
    let text: string | null = 'initial'
    await act(async () => {
      text = await result.current.extractText(
        'screenshot-session',
        screenshotCapture.content,
      )
    })

    expect(text).toBeNull()
    expect(result.current.error).toContain('未识别到文字')
  })

  it('surfaces backend errors such as missing vision model config', async () => {
    getInvokeMock().mockRejectedValue(
      new Error('截图操作需要视觉模型，请先在「设置 → 模型角色 → 视界·视觉」中完成配置。'),
    )

    const { result } = renderHook(() => useAssistantExtractText())
    let text: string | null = 'initial'
    await act(async () => {
      text = await result.current.extractText(
        'screenshot-session',
        screenshotCapture.content,
      )
    })

    expect(text).toBeNull()
    expect(result.current.error).toContain('视觉模型')
  })

  it('does not issue duplicate OCR requests before the busy state renders', async () => {
    const recognition = deferred<{ content: string }>()
    getInvokeMock().mockReturnValue(recognition.promise)
    const { result } = renderHook(() => useAssistantExtractText())
    let first!: Promise<string | null>
    let duplicate!: Promise<string | null>
    act(() => {
      first = result.current.extractText('screenshot-session', screenshotCapture.content)
      duplicate = result.current.extractText('screenshot-session', screenshotCapture.content)
    })
    await expect(duplicate).resolves.toBeNull()
    await waitFor(() => expect(getInvokeMock()).toHaveBeenCalledTimes(1))
    await act(async () => {
      recognition.resolve({ content: '只识别一次' })
      await expect(first).resolves.toBe('只识别一次')
    })
  })

  it('skips the backend call when reset before the native API becomes ready', async () => {
    const { result } = renderHook(() => useAssistantExtractText())
    let pending!: Promise<string | null>
    act(() => {
      pending = result.current.extractText('screenshot-session', screenshotCapture.content)
      result.current.reset()
    })
    await act(async () => { await expect(pending).resolves.toBeNull() })
    expect(getInvokeMock()).not.toHaveBeenCalled()
    expect(result.current.extracting).toBe(false)
  })

  it.each(['resolve', 'reject'] as const)(
    'isolates a new OCR request when an abandoned request %ss',
    async (outcome) => {
      const oldRecognition = deferred<{ content: string }>()
      const newRecognition = deferred<{ content: string }>()
      getInvokeMock().mockImplementation(async (_command: string, args?: { sessionId?: string }) => (
        args?.sessionId === 'old-session' ? oldRecognition.promise : newRecognition.promise
      ))
      const { result } = renderHook(() => useAssistantExtractText())
      let oldPending!: Promise<string | null>
      let newPending!: Promise<string | null>
      act(() => { oldPending = result.current.extractText('old-session', screenshotCapture.content) })
      await waitFor(() => expect(getInvokeMock()).toHaveBeenCalledTimes(1))
      act(() => {
        result.current.reset()
        newPending = result.current.extractText('new-session', screenshotCapture.content)
      })
      await waitFor(() => expect(getInvokeMock()).toHaveBeenCalledTimes(2))
      await act(async () => {
        if (outcome === 'resolve') oldRecognition.resolve({ content: '旧截图文字' })
        else oldRecognition.reject(new Error('旧截图识别失败'))
        await expect(oldPending).resolves.toBeNull()
      })
      expect(result.current.extracting).toBe(true)
      expect(result.current.error).toBeNull()
      await act(async () => {
        newRecognition.resolve({ content: '新截图文字' })
        await expect(newPending).resolves.toBe('新截图文字')
      })
      expect(result.current.extracting).toBe(false)
    },
  )

  it('returns no extracted text after the preview unmounts', async () => {
    const recognition = deferred<{ content: string }>()
    getInvokeMock().mockReturnValue(recognition.promise)
    const { result, unmount } = renderHook(() => useAssistantExtractText())
    let pending!: Promise<string | null>
    act(() => { pending = result.current.extractText('screenshot-session', screenshotCapture.content) })
    await waitFor(() => expect(getInvokeMock()).toHaveBeenCalledTimes(1))
    unmount()
    recognition.resolve({ content: '已关闭预览的文字' })
    await expect(pending).resolves.toBeNull()
  })

  it('clears a previous extraction error when reset', async () => {
    const { result } = renderHook(() => useAssistantExtractText())
    await act(async () => { await result.current.extractText('session', 'plain text') })
    expect(result.current.error).not.toBeNull()
    act(() => result.current.reset())
    expect(result.current.error).toBeNull()
    expect(result.current.extracting).toBe(false)
  })
})

describe('useCaptureSession applyExtractedText', () => {
  beforeEach(() => resetInvokeMock())

  it('replaces screenshot content with editable OCR text pending re-confirmation', async () => {
    getInvokeMock().mockImplementation(async (command: string) => {
      if (command === 'assistant_capture_screen_overlay') return screenshotCapture
      if (command === 'assistant_confirm_capture') return undefined
      throw new Error(`Unmocked invoke: ${command}`)
    })

    const { result } = renderHook(() => useCaptureSession())
    await act(async () => {
      await result.current.startCapture('screenshot')
    })
    await act(async () => {
      await result.current.confirmCapture()
    })
    expect(result.current.session?.userConfirmed).toBe(true)

    act(() => result.current.applyExtractedText('OCR 文本'))

    expect(result.current.session?.content).toBe('OCR 文本')
    // OCR 文本属于不可信内容：必须回到未确认状态，重新走预览与隐私检查。
    expect(result.current.session?.userConfirmed).toBe(false)
    expect(result.current.session?.status).toBe('ready')
    expect(result.current.extractedFromImage).toBe(true)

    await act(async () => {
      await result.current.confirmCapture()
    })
    await waitFor(() => expect(result.current.session?.userConfirmed).toBe(true))
    expect(getInvokeMock()).toHaveBeenLastCalledWith('assistant_confirm_capture', {
      sessionId: 'screenshot-session',
      content: 'OCR 文本',
    })
  })

  it('resets the OCR marker when a new capture starts', async () => {
    getInvokeMock().mockImplementation(async (command: string) => {
      if (command === 'assistant_capture_screen_overlay') return screenshotCapture
      if (command === 'assistant_get_clipboard') {
        return { ...screenshotCapture, session_id: 'clipboard-session', content: 'text' }
      }
      throw new Error(`Unmocked invoke: ${command}`)
    })

    const { result } = renderHook(() => useCaptureSession())
    await act(async () => {
      await result.current.startCapture('screenshot')
    })
    act(() => result.current.applyExtractedText('OCR 文本'))
    expect(result.current.extractedFromImage).toBe(true)

    await act(async () => {
      await result.current.startCapture('clipboard')
    })
    expect(result.current.extractedFromImage).toBe(false)
  })
})
