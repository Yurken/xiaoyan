import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import DesktopAssistantSettingsSection from '../../settings/DesktopAssistantSettingsSection'

const mocks = vi.hoisted(() => ({
  showDock: vi.fn().mockResolvedValue(undefined),
  completeGuide: vi.fn().mockResolvedValue(true),
  refreshVisibility: vi.fn().mockResolvedValue(undefined),
  resetDockPlacement: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../hooks', () => ({
  useAssistantPermissions: () => ({
    status: { accessibility: false, screen_recording: false, clipboard: true },
    loading: false,
    error: null,
    requestAccessibility: vi.fn(),
    requestScreenRecording: vi.fn(),
  }),
  useAssistantWindow: () => ({
    isDockVisible: false,
    isPanelVisible: false,
    showDock: mocks.showDock,
    hideDock: vi.fn(),
    showPanel: vi.fn(),
    hidePanel: vi.fn(),
    refreshVisibility: mocks.refreshVisibility,
    resetDockPlacement: mocks.resetDockPlacement,
  }),
  useAssistantShortcut: () => ({
    shortcut: 'Alt+Space',
    diagnostic: {
      status: 'healthy',
      requested_shortcut: 'Alt+Space',
      active_shortcut: 'Alt+Space',
      message: '',
      updated_at: '2026-07-29T00:00:00Z',
    },
    loading: false,
    saving: false,
    error: null,
    save: vi.fn(),
    retry: vi.fn(),
  }),
  useAssistantOnboarding: () => ({
    onboarding: { permission_guide_completed: false },
    loading: false,
    saving: false,
    error: null,
    completePermissionGuide: mocks.completeGuide,
  }),
  useAssistantRuntimePreferences: () => ({
    preferences: { enabled: true, diagnostic_logging_enabled: false },
    loading: false,
    saving: false,
    error: null,
    save: vi.fn(),
  }),
}))

vi.mock('../components', () => ({
  AssistantPermissionGuide: ({ onFinish }: { onFinish: () => void }) => (
    <button onClick={onFinish}>完成测试引导</button>
  ),
  AssistantPrivacyRulesSection: () => <div>应用规则</div>,
  AssistantDataPolicySection: () => <div>数据策略</div>,
  AssistantRuntimeSettingsSection: () => <div>运行设置</div>,
  AssistantDirectShortcutsSection: () => <div>直达快捷键</div>,
}))

describe('DesktopAssistantSettingsSection', () => {
  it('opens the first-use guide before showing the desktop dock', async () => {
    const user = userEvent.setup()
    render(<DesktopAssistantSettingsSection />)

    await user.click(screen.getByRole('button', { name: '让小妍走到桌面' }))
    expect(screen.getByRole('button', { name: '完成测试引导' })).toBeInTheDocument()
    expect(mocks.showDock).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: '完成测试引导' }))
    await waitFor(() => expect(mocks.showDock).toHaveBeenCalledOnce())
    expect(mocks.completeGuide).toHaveBeenCalledOnce()
  })

  it('resets the dock placement from the settings entry', async () => {
    const user = userEvent.setup()
    render(<DesktopAssistantSettingsSection />)

    await user.click(screen.getByRole('button', { name: '重置小妍位置' }))
    await waitFor(() => expect(mocks.resetDockPlacement).toHaveBeenCalledOnce())
  })
})
