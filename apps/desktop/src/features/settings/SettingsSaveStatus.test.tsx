import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import SettingsSaveStatus from './SettingsSaveStatus'

afterEach(cleanup)

describe('settings recovery status', () => {
  it('keeps an uncertain backup result distinct from an acknowledged restore', () => {
    const retry = vi.fn()
    const error = '备份恢复结果尚未确认：连接已中断。请重新读取后继续编辑。'
    render(<SettingsSaveStatus state="error" error={error} reloadRequired replacementActive onRetry={retry} />)
    expect(screen.getByRole('alert')).toHaveTextContent(error)
    expect(screen.queryByText(/备份已恢复|配置已导入/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '重新读取' }))
    expect(retry).toHaveBeenCalledOnce()
    expect(screen.queryByRole('button', { name: '重试保存' })).not.toBeInTheDocument()
  })

  it('shows acknowledged restore readback failures without claiming the restore must be repeated', () => {
    const error = '备份已恢复，但读取最新设置失败：数据库暂不可读。请重新读取后继续编辑。'
    render(<SettingsSaveStatus state="error" error={error} reloadRequired replacementActive />)
    expect(screen.getByRole('alert')).toHaveTextContent(error)
  })

  it('shows that editing remains paused while readback is running', () => {
    render(<SettingsSaveStatus state="saving" reloadRequired replacementActive />)
    expect(screen.getByRole('status')).toHaveTextContent('正在重新读取设置，完成前暂停编辑')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
