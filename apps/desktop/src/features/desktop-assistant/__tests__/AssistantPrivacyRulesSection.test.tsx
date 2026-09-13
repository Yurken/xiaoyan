import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { getInvokeMock, resetInvokeMock } from '../../../__tests__/mocks/tauri'
import { AssistantPrivacyRulesSection } from '../components/AssistantPrivacyRulesSection'

describe('AssistantPrivacyRulesSection', () => {
  beforeEach(() => resetInvokeMock())

  it('lets the user add and persist allow and block rules', async () => {
    getInvokeMock().mockImplementation(async (command: string, args?: unknown) => {
      if (command === 'assistant_get_privacy_preferences') {
        return { allowed_apps: [], blocked_apps: [], window_title_enabled: false }
      }
      if (command === 'assistant_set_privacy_preferences') {
        expect(args).toEqual({
          allowedApps: ['com.apple.Safari'],
          blockedApps: ['com.example.private'],
          windowTitleEnabled: true,
        })
        return {
          allowed_apps: ['com.apple.Safari'],
          blocked_apps: ['com.example.private'],
          window_title_enabled: true,
        }
      }
      throw new Error(`Unmocked invoke: ${command}`)
    })

    render(<AssistantPrivacyRulesSection />)
    await waitFor(() => expect(screen.queryByText('正在读取规则…')).not.toBeInTheDocument())

    const user = userEvent.setup()
    await user.type(screen.getByLabelText('允许读取的应用'), 'com.apple.Safari')
    await user.click(screen.getByRole('button', { name: '添加到允许读取的应用' }))
    await user.type(screen.getByLabelText('禁止应用'), 'com.example.private')
    await user.click(screen.getByRole('button', { name: '添加到禁止应用' }))
    await user.click(screen.getByRole('checkbox', { name: '记录来源窗口标题' }))
    await user.click(screen.getByRole('button', { name: '保存隐私规则' }))

    expect(await screen.findByText('隐私规则已保存')).toBeInTheDocument()
  })
})
