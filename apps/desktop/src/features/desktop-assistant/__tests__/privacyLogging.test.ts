/**
 * 前端日志脱敏抽样测试（PRD §7.2 F5）。
 * 用包含正文、OCR 文本、窗口标题、截图 data URL 与敏感片段的样例数据
 * 走一遍采集会话各记录路径，断言 console 输出与复制埋点不含内容载荷。
 */
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getInvokeMock, resetInvokeMock } from '../../../__tests__/mocks/tauri'
import { useCaptureSession } from '../hooks/useCaptureSession'
import { recordAssistantCopyMetric } from '../hooks/useAssistantMetrics'

const SENSITIVE_CONTENT = '正文：合同金额 100 万，联系人 researcher@example.com'
const SENSITIVE_OCR = 'OCR 识别结果：手机号 13800138000'
const SENSITIVE_WINDOW_TITLE = '机密文档 - 2026 工资表.xlsx'
const SENSITIVE_SCREENSHOT = 'data:image/png;base64,c2stbGl2ZS1zZWNyZXQ='
const FORBIDDEN_FRAGMENTS = [
  SENSITIVE_CONTENT,
  SENSITIVE_OCR,
  SENSITIVE_WINDOW_TITLE,
  SENSITIVE_SCREENSHOT,
  'researcher@example.com',
  '13800138000',
]

function consoleOutput(spy: ReturnType<typeof vi.spyOn>): string {
  return spy.mock.calls.map((args: unknown[]) => args.map(String).join(' ')).join('\n')
}

function expectNoSensitiveFragments(output: string) {
  for (const fragment of FORBIDDEN_FRAGMENTS) {
    expect(output).not.toContain(fragment)
  }
}

const sensitiveCapture = {
  session_id: 'sensitive-session',
  content: SENSITIVE_CONTENT,
  sanitized_content: '正文：合同金额 100 万，联系人 [EMAIL]',
  source_app: 'Preview',
  source_app_bundle_id: 'com.apple.Preview',
  window_title: SENSITIVE_WINDOW_TITLE,
  status: 'ready',
  privacy_check: null,
}

describe('assistant logging privacy', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>
  let errorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    resetInvokeMock()
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    warnSpy.mockRestore()
    errorSpy.mockRestore()
  })

  it('does not log content payloads when discarding a failed capture cleanup', async () => {
    getInvokeMock().mockImplementation(async (command: string) => {
      if (command === 'assistant_get_clipboard') return sensitiveCapture
      if (command === 'assistant_discard_capture') throw new Error('disk busy')
      throw new Error(`Unmocked invoke: ${command}`)
    })

    const { result } = renderHook(() => useCaptureSession())
    await act(async () => {
      await result.current.startCapture('clipboard')
    })
    expect(result.current.session?.windowTitle).toBe(SENSITIVE_WINDOW_TITLE)

    act(() => result.current.cancelCapture())
    await waitFor(() => expect(warnSpy).toHaveBeenCalled())

    expectNoSensitiveFragments(consoleOutput(warnSpy))
    expectNoSensitiveFragments(consoleOutput(errorSpy))
  })

  it('does not log previously captured content when a later capture fails', async () => {
    let captureAttempts = 0
    getInvokeMock().mockImplementation(async (command: string) => {
      if (command === 'assistant_get_clipboard') {
        captureAttempts += 1
        if (captureAttempts === 1) return sensitiveCapture
        throw new Error('需要辅助功能权限才能读取剪贴板')
      }
      throw new Error(`Unmocked invoke: ${command}`)
    })

    const { result } = renderHook(() => useCaptureSession())
    await act(async () => {
      await result.current.startCapture('clipboard')
    })
    await act(async () => {
      await result.current.retryCapture()
    })

    expect(result.current.status).toBe('error')
    expect(errorSpy).toHaveBeenCalled()
    expectNoSensitiveFragments(consoleOutput(errorSpy))
    expectNoSensitiveFragments(consoleOutput(warnSpy))
  })

  it('never logs screenshot data URLs from the preview session', async () => {
    getInvokeMock().mockImplementation(async (command: string) => {
      if (command === 'assistant_capture_screen_overlay') {
        return {
          ...sensitiveCapture,
          session_id: 'screenshot-session',
          content: SENSITIVE_SCREENSHOT,
          sanitized_content: null,
          capture_region: { x: 0, y: 0, width: 800, height: 600 },
        }
      }
      if (command === 'assistant_discard_capture') throw new Error('io error')
      throw new Error(`Unmocked invoke: ${command}`)
    })

    const { result } = renderHook(() => useCaptureSession())
    await act(async () => {
      await result.current.startCapture('screenshot')
    })
    expect(result.current.session?.screenshotPath).toBe(SENSITIVE_SCREENSHOT)

    act(() => result.current.cancelCapture())
    await waitFor(() => expect(warnSpy).toHaveBeenCalled())
    expectNoSensitiveFragments(consoleOutput(warnSpy))
  })

  it('records copy metrics through a parameterless command', async () => {
    getInvokeMock().mockResolvedValue(undefined)
    await recordAssistantCopyMetric()
    expect(getInvokeMock()).toHaveBeenCalledTimes(1)
    // 复制打点命令不带任何参数，前端无法借此写入内容载荷。
    expect(getInvokeMock()).toHaveBeenCalledWith('assistant_record_copy')
  })
})
