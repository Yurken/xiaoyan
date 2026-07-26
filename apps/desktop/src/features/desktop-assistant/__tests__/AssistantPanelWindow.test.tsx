import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AssistantPanelWindow from '../windows/AssistantPanelWindow'

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }))

vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock }))
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(vi.fn()),
}))

describe('AssistantPanelWindow', () => {
  beforeEach(() => {
    invokeMock.mockReset()
    invokeMock.mockImplementation(async (command: string) => {
      if (command === 'assistant_is_panel_visible') return false
      if (command === 'assistant_get_clipboard') {
        return {
          session_id: 'session-1',
          content: 'A selected research paragraph',
          sanitized_content: 'A selected research paragraph',
          source_app: 'Safari',
          source_app_bundle_id: 'com.apple.Safari',
          window_title: 'Paper',
          status: 'ready',
          privacy_check: { allowed: true },
        }
      }
      if (command === 'assistant_interpret') {
        return {
          id: 'result-1',
          session_id: 'session-1',
          action: 'interpret',
          content: 'Model explanation',
          format: 'markdown',
        }
      }
      if (command === 'assistant_import') {
        return {
          id: 'note-1',
          session_id: 'session-1',
          action: 'import',
          content: 'Imported',
          format: 'text',
        }
      }
      return undefined
    })
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

    await user.click(screen.getByRole('button', { name: '解读' }))
    expect(await screen.findByText('Model explanation')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '导入' }))
    expect(await screen.findByText('导入内容')).toBeInTheDocument()
    expect(screen.queryByText('图片资产')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '确认导入' }))

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(
        'assistant_import',
        expect.objectContaining({
          sessionId: 'session-1',
          content: 'Model explanation',
          target: 'note',
        })
      )
    })
  })
})
