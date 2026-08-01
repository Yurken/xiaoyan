import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { getInvokeMock, resetInvokeMock } from '../../../__tests__/mocks/tauri'
import { AssistantDataPolicySection } from '../components/AssistantDataPolicySection'

describe('AssistantDataPolicySection', () => {
  beforeEach(() => resetInvokeMock())

  it('requires an explicit choice to skip previews and confirmation before clearing', async () => {
    getInvokeMock().mockImplementation(async (command: string, args?: unknown) => {
      if (command === 'assistant_get_data_policy') {
        return { preview_required: true, inbox_retention_days: 7 }
      }
      if (command === 'assistant_set_data_policy') {
        expect(args).toEqual({
          previewRequired: false,
          inboxRetentionDays: null,
        })
        return { preview_required: false, inbox_retention_days: null }
      }
      if (command === 'assistant_clear_later_items') return 2
      throw new Error(`Unmocked invoke: ${command}`)
    })

    render(<AssistantDataPolicySection />)
    await waitFor(() => expect(screen.queryByText('正在读取策略…')).not.toBeInTheDocument())
    const user = userEvent.setup()

    await user.click(screen.getByRole('checkbox', {
      name: '每次发送前显示完整预览',
    }))
    expect(screen.getByText(/跳过完整预览会减少/)).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('稍后处理箱保留策略'), 'manual')
    await user.click(screen.getByRole('button', { name: '保存数据策略' }))
    expect(await screen.findByText('预览与保留策略已保存')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '立即清理稍后处理箱' }))
    expect(screen.getByText('再次点击以确认清空稍后处理箱')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '确认清空稍后处理箱' }))
    expect(await screen.findByText('已清理 2 条稍后处理内容')).toBeInTheDocument()
  })

  it('explains the private-data boundary and requires a second click', async () => {
    getInvokeMock().mockImplementation(async (command: string) => {
      if (command === 'assistant_get_data_policy') {
        return { preview_required: true, inbox_retention_days: 7 }
      }
      if (command === 'assistant_clear_private_data') {
        return {
          capture_sessions: 2,
          image_assets: 3,
          file_previews: 1,
          cancelled_actions: 1,
        }
      }
      throw new Error(`Unmocked invoke: ${command}`)
    })
    render(<AssistantDataPolicySection />)
    await waitFor(() => expect(screen.queryByText('正在读取策略…')).not.toBeInTheDocument())
    expect(screen.getByText(/不会删除稍后处理箱、知识笔记及附件、论文、正式聊天或你的原文件/)).toBeInTheDocument()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '一键清除助手私有数据' }))
    expect(getInvokeMock()).not.toHaveBeenCalledWith('assistant_clear_private_data')
    expect(screen.getByText(/再次点击以确认清除临时上下文/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '确认清除助手私有数据' }))
    expect(getInvokeMock()).toHaveBeenCalledWith('assistant_clear_private_data')
    expect(await screen.findByText(/已清除 2 个采集上下文、3 个图片资产，并停止 1 个生成任务/)).toBeInTheDocument()
  })
})
