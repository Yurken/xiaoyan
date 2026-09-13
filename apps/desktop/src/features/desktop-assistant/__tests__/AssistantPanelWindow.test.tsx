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

describe('AssistantPanelWindow', () => {
  let previewRequired = true
  let permissionGuideCompleted = true
  let capturedContent = 'A selected research paragraph'
  let translationPreferences = {
    target_language: 'zh',
    terminology_style: 'bilingual',
  }
  let terminologyPreferences: Array<{
    source_term: string
    preferred_translation: string
    target_language: string
    updated_at: string
  }> = []

  beforeEach(() => {
    previewRequired = true
    permissionGuideCompleted = true
    capturedContent = 'A selected research paragraph'
    translationPreferences = {
      target_language: 'zh',
      terminology_style: 'bilingual',
    }
    terminologyPreferences = []
    eventHandlers.clear()
    invokeMock.mockReset()
    invokeMock.mockImplementation(async (command: string, args?: Record<string, unknown>) => {
      if (command === 'assistant_is_panel_visible') return false
      if (command === 'assistant_get_data_policy') {
        return { preview_required: previewRequired, inbox_retention_days: 7 }
      }
      if (command === 'assistant_get_onboarding') {
        return { permission_guide_completed: permissionGuideCompleted }
      }
      if (command === 'assistant_get_translation_preferences') {
        return translationPreferences
      }
      if (command === 'assistant_list_terminology_preferences') {
        return terminologyPreferences
      }
      if (command === 'assistant_save_terminology_preference') {
        terminologyPreferences = [{
          source_term: args?.sourceTerm as string,
          preferred_translation: args?.preferredTranslation as string,
          target_language: args?.targetLanguage as string,
          updated_at: '2026-07-29T00:00:00Z',
        }]
        return terminologyPreferences
      }
      if (command === 'assistant_list_knowledge_themes') {
        return [{ id: 'theme-1', name: 'Graph RAG', asset_count: 3 }]
      }
      if (command === 'assistant_set_translation_preferences') {
        translationPreferences = {
          target_language: args?.targetLanguage as string,
          terminology_style: args?.terminologyStyle as string,
        }
        return translationPreferences
      }
      if (command === 'assistant_complete_permission_guide') {
        permissionGuideCompleted = true
        return { permission_guide_completed: true }
      }
      if (command === 'assistant_check_permissions') {
        return { accessibility: false, screen_recording: false, clipboard: true }
      }
      if (command === 'assistant_get_selection') {
        return {
          session_id: 'session-1',
          content: capturedContent,
          sanitized_content: capturedContent,
          source_app: 'Safari',
          source_app_bundle_id: 'com.apple.Safari',
          window_title: 'Paper',
          status: 'ready',
          privacy_check: { allowed: true },
        }
      }
      if (command === 'assistant_get_clipboard') {
        return {
          session_id: 'session-1',
          content: capturedContent,
          sanitized_content: capturedContent,
          source_app: 'Safari',
          source_app_bundle_id: 'com.apple.Safari',
          window_title: 'Paper',
          status: 'ready',
          privacy_check: { allowed: true },
        }
      }
      if (command === 'assistant_stream_action') {
        const requestId = args?.requestId as string
        eventHandlers.get('assistant:action-delta')?.({
          payload: { request_id: requestId, delta: 'Model explanation' },
        })
        eventHandlers.get('assistant:action-done')?.({
          payload: {
            request_id: requestId,
            result: {
              id: 'result-1',
              session_id: 'session-1',
              action: args?.action,
              content: 'Model explanation',
              format: 'markdown',
              metadata: {
                model: 'research-model',
                token_usage: 42,
                token_usage_estimated: true,
                duration_ms: 1200,
                ...(args?.localKnowledgeEnabled
                  ? {
                      knowledge_theme: 'Graph RAG',
                      source_details: [{
                        source_type: 'paper',
                        source_id: 'paper-1',
                        title: 'Graph Retrieval',
                        url: null,
                      }],
                    }
                  : {}),
              },
            },
          },
        })
        return requestId
      }
      if (command === 'assistant_cancel_action') return undefined
      if (command === 'assistant_promote_session') {
        return {
          conversation_id: (args?.input as { temporarySessionId: string }).temporarySessionId,
          already_promoted: false,
        }
      }
      if (command === 'assistant_open_conversation') return undefined
      if (command === 'assistant_import') {
        return {
          id: 'note-1',
          session_id: 'session-1',
          action: 'import',
          content: 'Imported',
          format: 'text',
        }
      }
      if (command === 'assistant_create_paste_session') {
        return {
          session_id: 'free-session',
          content: null,
          sanitized_content: null,
          source_app: null,
          source_app_bundle_id: null,
          window_title: null,
          status: 'ready',
          privacy_check: { allowed: true },
        }
      }
      if (command === 'assistant_confirm_capture') {
        return {
          confirmed: true,
          content: (args?.content as string) ?? null,
          reason: null,
          privacy_check: {
            allowed: true,
            reason: null,
            app_blocked: false,
            app_not_allowed: false,
            window_blocked: false,
            content_sensitive: false,
            content_redacted: false,
            redaction_kinds: [],
          },
        }
      }
      return undefined
    })
  })

  it('drops capture and temporary conversation state after the privacy clear event', async () => {
    const user = userEvent.setup()
    render(<AssistantPanelWindow />)
    await waitFor(() => expect(eventHandlers.has('assistant://private-data-cleared')).toBe(true))
    await user.click(screen.getByRole('button', { name: '剪贴板' }))
    await user.click(await screen.findByRole('button', { name: '确认使用' }))
    await user.click(await screen.findByRole('button', { name: /^解读/ }))
    expect(await screen.findByText('Model explanation')).toBeInTheDocument()

    act(() => {
      eventHandlers.get('assistant://private-data-cleared')?.({
        payload: {
          capture_sessions: 1,
          image_assets: 1,
          file_previews: 0,
          cancelled_actions: 0,
        },
      })
    })
    await waitFor(() => expect(screen.queryByText('Model explanation')).not.toBeInTheDocument())
    expect(screen.queryByDisplayValue('A selected research paragraph')).not.toBeInTheDocument()
  })

  it('moves from capture preview to actions, result and confirmed import', async () => {
    const user = userEvent.setup()
    render(<AssistantPanelWindow />)

    await user.click(screen.getByRole('button', { name: '剪贴板' }))
    const previewTitle = await screen.findByText('内容预览')
    expect(previewTitle).toHaveAttribute('data-tauri-drag-region')
    expect(screen.getByDisplayValue('A selected research paragraph')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '确认使用' }))
    expect(await screen.findByText('选择动作')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '小妍' })).toHaveAttribute(
      'src',
      '/xiaoyan-avatar.png'
    )
    expect(screen.getByText('小妍')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^解读/ }))
    expect(await screen.findByText('Model explanation')).toBeInTheDocument()
    expect(screen.getByText('模型：research-model')).toBeInTheDocument()
    expect(screen.getByText('约 42 Token')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^导入/ }))
    expect(await screen.findByRole('heading', { name: '确认导入' })).toBeInTheDocument()
    expect(screen.queryByText('图片资产')).not.toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: '研究主题' })).toHaveValue('theme-1')
    expect(screen.getByText(/预计占用：约/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '确认导入' }))

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(
        'assistant_import',
        expect.objectContaining({
          sessionId: 'session-1',
          content: 'Model explanation',
          target: 'note',
          researchThemeId: 'theme-1',
          preserveOriginal: false,
          originalContent: null,
          retentionPolicy: 'permanent',
        })
      )
    })

  })

  it('skips the full preview only after the user disables it in settings', async () => {
    previewRequired = false
    const user = userEvent.setup()
    render(<AssistantPanelWindow />)

    await user.click(screen.getByRole('button', { name: '剪贴板' }))

    expect(await screen.findByText('选择动作')).toBeInTheDocument()
    expect(screen.queryByText('内容预览')).not.toBeInTheDocument()
    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('assistant_confirm_capture', {
        sessionId: 'session-1',
        content: 'A selected research paragraph',
      })
    })
  })

  it('shows the permission guide once and preserves fallback paths when declined', async () => {
    permissionGuideCompleted = false
    const user = userEvent.setup()
    render(<AssistantPanelWindow />)

    expect(await screen.findByText('权限说明 1 / 2')).toBeInTheDocument()
    expect(screen.getByText(/不授权仍可使用剪贴板快照和手动粘贴/)).toBeInTheDocument()
    expect(invokeMock).not.toHaveBeenCalledWith('assistant_get_selection')

    await user.click(screen.getByRole('button', { name: '仅用剪贴板/粘贴继续' }))

    expect(await screen.findByText('内容预览')).toBeInTheDocument()
    expect(invokeMock).toHaveBeenCalledWith('assistant_complete_permission_guide')
    expect(invokeMock).toHaveBeenCalledWith('assistant_get_selection', undefined)
  })

  it('shows action limits and only sends the allowed interpret characters', async () => {
    capturedContent = '研'.repeat(12_005)
    const user = userEvent.setup()
    render(<AssistantPanelWindow />)

    await user.click(screen.getByRole('button', { name: '剪贴板' }))
    await user.click(await screen.findByRole('button', { name: '确认使用' }))

    expect(screen.getByText(/超过所选动作上限的部分不会发送/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^解读 · 12,000 字符/ }))

    await waitFor(() => {
      const call = invokeMock.mock.calls.find(([command]) => command === 'assistant_stream_action')
      expect(call).toBeDefined()
      expect(Array.from(call?.[1]?.content as string)).toHaveLength(12_000)
    })
  })

  it('sends the selected interpret mode to the streaming backend', async () => {
    previewRequired = false
    const user = userEvent.setup()
    render(<AssistantPanelWindow />)

    await user.click(screen.getByRole('button', { name: '剪贴板' }))
    expect(await screen.findByText('选择动作')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '图表' }))
    await user.click(screen.getByRole('button', { name: /^解读/ }))

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(
        'assistant_stream_action',
        expect.objectContaining({
          action: 'interpret',
          interpretMode: 'figure',
        }),
      )
    })
  })

  it('persists translation preferences and sends them with the action', async () => {
    previewRequired = false
    const user = userEvent.setup()
    render(<AssistantPanelWindow />)

    await user.click(screen.getByRole('button', { name: '剪贴板' }))
    expect(await screen.findByText('选择动作')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'English' }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute(
        'aria-pressed',
        'true',
      )
    })
    await user.click(screen.getByRole('button', { name: '原文术语' }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '原文术语' })).toHaveAttribute(
        'aria-pressed',
        'true',
      )
    })
    await user.click(screen.getByRole('button', { name: /^翻译/ }))

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(
        'assistant_stream_action',
        expect.objectContaining({
          action: 'translate',
          targetLang: 'en',
          terminologyStyle: 'original',
        }),
      )
    })

    await user.type(screen.getByRole('textbox', { name: '原术语' }), 'agent')
    await user.type(screen.getByRole('textbox', { name: '选定译法' }), 'Agentensystem')
    await user.click(screen.getByRole('button', { name: '保存术语偏好' }))
    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(
        'assistant_save_terminology_preference',
        {
          sourceTerm: 'agent',
          preferredTranslation: 'Agentensystem',
          targetLanguage: 'en',
        },
      )
    })
  })

  it('uses the selected local theme only after explicit opt-in and displays sources', async () => {
    previewRequired = false
    const user = userEvent.setup()
    render(<AssistantPanelWindow />)

    await user.click(screen.getByRole('button', { name: '剪贴板' }))
    expect(await screen.findByText('选择动作')).toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: /使用本地知识/ }))
    await user.click(screen.getByRole('button', { name: /^解读/ }))

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(
        'assistant_stream_action',
        expect.objectContaining({
          action: 'interpret',
          localKnowledgeEnabled: true,
          knowledgeThemeId: 'theme-1',
        }),
      )
    })
    expect(await screen.findAllByText('本地知识 · Graph RAG')).toHaveLength(2)
    expect(screen.getByText('Graph Retrieval')).toBeInTheDocument()
  })

  it('continues a temporary conversation and promotes it only on explicit save', async () => {
    previewRequired = false
    const user = userEvent.setup()
    render(<AssistantPanelWindow />)

    await user.click(screen.getByRole('button', { name: '剪贴板' }))
    await user.click(await screen.findByRole('button', { name: /^解读/ }))
    expect(await screen.findByText('Model explanation')).toBeInTheDocument()
    expect(invokeMock).not.toHaveBeenCalledWith(
      'assistant_promote_session',
      expect.anything(),
    )

    await user.click(screen.getByRole('button', { name: '移除捕获内容' }))
    expect(screen.getByText(/不包含捕获内容/)).toBeInTheDocument()
    await user.type(screen.getByRole('textbox', { name: '继续追问' }), '证据是什么？')
    await user.click(screen.getByRole('button', { name: '发送追问' }))
    await waitFor(() => {
      const streamCalls = invokeMock.mock.calls.filter(
        ([command]) => command === 'assistant_stream_action',
      )
      expect(streamCalls).toHaveLength(2)
      expect(streamCalls[1]?.[1]).toEqual(expect.objectContaining({
        action: 'chat',
        content: '',
        question: '证据是什么？',
        includeCaptureContext: false,
        history: [
          { role: 'user', content: '解读当前内容' },
          { role: 'assistant', content: 'Model explanation' },
        ],
      }))
    })

    await user.click(screen.getByRole('button', { name: '保存为正式会话' }))
    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(
        'assistant_promote_session',
        expect.objectContaining({
          input: expect.objectContaining({
            captureSessionId: 'session-1',
            context: '',
            includeCaptureContext: false,
          }),
        }),
      )
    })
    expect(await screen.findByText('已保存为正式会话')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '在主窗口继续' }))
    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(
        'assistant_open_conversation',
        expect.objectContaining({ conversationId: expect.any(String) }),
      )
    })
  })

  it('starts a temporary chat from free input without captured content', async () => {
    const user = userEvent.setup()
    render(<AssistantPanelWindow />)

    const input = await screen.findByRole('textbox', { name: '输入问题，直接开始对话' })
    await user.type(input, '什么是图检索？')
    await user.click(screen.getByRole('button', { name: '直接提问' }))

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('assistant_create_paste_session')
      expect(invokeMock).toHaveBeenCalledWith('assistant_confirm_capture', {
        sessionId: 'free-session',
        content: '什么是图检索？',
      })
      expect(invokeMock).toHaveBeenCalledWith(
        'assistant_stream_action',
        expect.objectContaining({
          action: 'chat',
          sessionId: 'free-session',
          content: '',
          question: '什么是图检索？',
          includeCaptureContext: false,
        }),
      )
    })
    expect(await screen.findByText('Model explanation')).toBeInTheDocument()

    // 自由会话的追问不依赖采集内容
    await user.type(screen.getByRole('textbox', { name: '继续追问' }), '展开讲讲')
    await user.click(screen.getByRole('button', { name: '发送追问' }))
    await waitFor(() => {
      const streamCalls = invokeMock.mock.calls.filter(
        ([command]) => command === 'assistant_stream_action',
      )
      expect(streamCalls).toHaveLength(2)
      expect(streamCalls[1]?.[1]).toEqual(expect.objectContaining({
        action: 'chat',
        sessionId: 'free-session',
        content: '',
        question: '展开讲讲',
        includeCaptureContext: false,
      }))
    })

    // 无采集内容也可保存为正式会话
    await user.click(screen.getByRole('button', { name: '保存为正式会话' }))
    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(
        'assistant_promote_session',
        expect.objectContaining({
          input: expect.objectContaining({
            captureSessionId: 'free-session',
            context: '',
            includeCaptureContext: false,
          }),
        }),
      )
    })
  })

  it('imports a free-chat result through its own confirmed backend session', async () => {
    const user = userEvent.setup()
    render(<AssistantPanelWindow />)

    const input = await screen.findByRole('textbox', { name: '输入问题，直接开始对话' })
    await user.type(input, '什么是图检索？')
    await user.click(screen.getByRole('button', { name: '直接提问' }))
    expect(await screen.findByText('Model explanation')).toBeInTheDocument()

    // 自由会话没有采集内容，导入按钮也必须能打开导入弹窗，
    // 且绑定自由会话自己已确认的后端 session_id，而不是误用旧捕获。
    await user.click(screen.getByRole('button', { name: /^导入/ }))
    expect(await screen.findByRole('heading', { name: '确认导入' })).toBeInTheDocument()
    expect(screen.getByText('来源：自由提问')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '确认导入' }))

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(
        'assistant_import',
        expect.objectContaining({
          sessionId: 'free-session',
          content: 'Model explanation',
          target: 'note',
          originalContent: null,
        }),
      )
    })
  })
})
