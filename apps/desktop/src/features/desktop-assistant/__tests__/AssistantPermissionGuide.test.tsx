import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getInvokeMock, resetInvokeMock } from '../../../__tests__/mocks/tauri'
import { AssistantPermissionGuide } from '../components/AssistantPermissionGuide'

describe('AssistantPermissionGuide', () => {
  beforeEach(() => resetInvokeMock())

  it('explains both permissions separately and keeps fallback choices visible', async () => {
    getInvokeMock().mockImplementation(async (command: string) => {
      if (command === 'assistant_check_permissions') {
        return { accessibility: false, screen_recording: false, clipboard: true }
      }
      if (command === 'assistant_request_screen_recording') return false
      throw new Error(`Unmocked invoke: ${command}`)
    })
    const onFinish = vi.fn()
    const user = userEvent.setup()
    render(<AssistantPermissionGuide onFinish={onFinish} />)

    expect(await screen.findByText(/辅助功能：读取你主动选择的文字/)).toBeInTheDocument()
    expect(screen.getByText(/不授权仍可使用剪贴板快照和手动粘贴/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '下一步' }))
    expect(screen.getByText(/屏幕录制：由你框选需要解读的区域/)).toBeInTheDocument()
    expect(screen.getByText(/不授权仍可使用选区、剪贴板和手动粘贴/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '去授权' }))
    expect(getInvokeMock()).toHaveBeenCalledWith('assistant_request_screen_recording')

    await user.click(screen.getByRole('button', { name: '完成并继续' }))
    expect(onFinish).toHaveBeenCalledOnce()
  })
})
