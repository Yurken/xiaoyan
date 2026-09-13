import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AssistantRuntimeSettingsSection } from '../components/AssistantRuntimeSettingsSection'

describe('AssistantRuntimeSettingsSection', () => {
  it('applies the total switch and diagnostics choices independently', async () => {
    const onChange = vi.fn().mockResolvedValue(true)
    const user = userEvent.setup()
    render(
      <AssistantRuntimeSettingsSection
        preferences={{ enabled: true, diagnostic_logging_enabled: false }}
        loading={false}
        saving={false}
        error={null}
        onChange={onChange}
      />,
    )

    await user.click(screen.getByRole('button', { name: '关闭桌面助手' }))
    expect(onChange).toHaveBeenCalledWith({
      enabled: false,
      diagnostic_logging_enabled: false,
    })

    await user.click(screen.getByRole('checkbox', {
      name: '记录桌面助手诊断日志',
    }))
    expect(onChange).toHaveBeenCalledWith({
      enabled: true,
      diagnostic_logging_enabled: true,
    })
    expect(screen.getByText(/不写入正文、窗口标题、OCR 文本或截图内容/))
      .toBeInTheDocument()
  })
})
