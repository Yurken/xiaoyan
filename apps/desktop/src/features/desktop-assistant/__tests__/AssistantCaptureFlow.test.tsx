import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AssistantPanelWindow from '../windows/AssistantPanelWindow'

const { invokeMock, eventHandlers } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  eventHandlers: new Map<string, (event: { payload: unknown }) => void>(),
}))

vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock }))
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async (
    event: string,
    handler: (event: { payload: unknown }) => void,
  ) => {
    eventHandlers.set(event, handler)
    return () => {
      if (eventHandlers.get(event) === handler) eventHandlers.delete(event)
    }
  }),
  TauriEvent: {
    DRAG_ENTER: 'tauri://drag-enter',
    DRAG_OVER: 'tauri://drag-over',
    DRAG_DROP: 'tauri://drag-drop',
    DRAG_LEAVE: 'tauri://drag-leave',
  },
}))

const imageDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg=='
const selectedText = '新的研究段落，已替换截图上下文'

function expectNoModelRequests() {
  const modelCommands = ['assistant_stream_action', 'assistant_extract_text']
  expect(invokeMock.mock.calls.some(([command]) => modelCommands.includes(command))).toBe(false)
}

describe('Assistant capture preview flow', () => {
  beforeEach(() => {
    eventHandlers.clear()
    invokeMock.mockReset()
    invokeMock.mockImplementation(async (command: string, args?: Record<string, unknown>) => {
      if (command === 'assistant_is_panel_visible' || command === 'assistant_is_dock_visible') {
        return false
      }
      if (command === 'assistant_get_data_policy') {
        return { preview_required: true, inbox_retention_days: 7 }
      }
      if (command === 'assistant_get_onboarding') {
        return { permission_guide_completed: true }
      }
      if (command === 'assistant_get_translation_preferences') {
        return { target_language: 'zh', terminology_style: 'bilingual' }
      }
      if (command === 'assistant_list_terminology_preferences'
        || command === 'assistant_list_knowledge_themes') return []
      if (command === 'assistant_capture_screen_overlay' || command === 'assistant_get_selection') {
        const isScreenshot = command === 'assistant_capture_screen_overlay'
        return {
          session_id: isScreenshot ? 'screenshot-session' : 'text-session',
          content: isScreenshot ? imageDataUrl : selectedText,
          sanitized_content: isScreenshot ? null : selectedText,
          source_app: 'Preview',
          source_app_bundle_id: 'com.apple.Preview',
          window_title: '论文.pdf',
          capture_region: isScreenshot ? { x: -1280, y: 40, width: 1280, height: 720 } : null,
          status: 'ready',
          privacy_check: { allowed: true },
        }
      }
      if (command === 'assistant_confirm_capture') {
        return {
          confirmed: true,
          content: args?.content,
          reason: null,
          privacy_check: { allowed: true, redaction_kinds: [] },
        }
      }
      return undefined
    })
  })

  it.each(['text capture', 'private data clear'])(
    'keeps the confirmed screenshot visible until %s replaces it', async (transition) => {
      const user = userEvent.setup()
      render(<AssistantPanelWindow />)
      await user.click(await screen.findByRole('button', { name: '截图' }))

      const capturePreview = await screen.findByRole('img', { name: '截图预览' })
      expect(capturePreview).toHaveAttribute('src', imageDataUrl)
      expect(screen.getByRole('button', { name: '确认使用' })).toBeEnabled()
      expect(invokeMock.mock.calls.some(([command]) => command === 'assistant_confirm_capture')).toBe(false)
      expectNoModelRequests()

      await user.click(screen.getByRole('button', { name: '确认使用' }))

      const panelPreview = await screen.findByRole('img', { name: '当前截图预览' })
      expect(panelPreview).toHaveAttribute('src', capturePreview.getAttribute('src'))
      expect(screen.getByText('选择动作')).toBeInTheDocument()
      expect(screen.queryByText(imageDataUrl)).not.toBeInTheDocument()
      expect(screen.queryByRole('img', { name: '截图预览' })).not.toBeInTheDocument()
      expect(invokeMock).toHaveBeenCalledWith('assistant_confirm_capture', {
        sessionId: 'screenshot-session', content: imageDataUrl,
      })
      expectNoModelRequests()

      if (transition === 'text capture') {
        await user.click(screen.getByRole('button', { name: '选中文本' }))
        expect(await screen.findByRole('textbox', { name: '预览内容（可编辑）' }))
          .toHaveValue(selectedText)
        expect(screen.queryByRole('img', { name: '当前截图预览' })).not.toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: '确认使用' }))
        expect(await screen.findByText(selectedText)).toBeInTheDocument()
      } else {
        await waitFor(() => expect(eventHandlers.has('assistant://private-data-cleared')).toBe(true))
        act(() => { eventHandlers.get('assistant://private-data-cleared')?.({ payload: {} }) })
        expect(await screen.findByText('请先获取内容...')).toBeInTheDocument()
      }

      expect(screen.queryByRole('img', { name: '当前截图预览' })).not.toBeInTheDocument()
      expect(screen.queryByRole('img', { name: '截图预览' })).not.toBeInTheDocument()
      expectNoModelRequests()
    },
  )
})
