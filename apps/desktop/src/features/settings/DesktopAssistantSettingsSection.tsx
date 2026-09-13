/**
 * 桌面助手设置分区
 */
import { useEffect, useState } from 'react'
import {
  MonitorDot,
  Keyboard,
  MousePointerClick,
  Shield,
  CheckCircle2,
  AlertCircle,
  PanelTopOpen,
} from 'lucide-react'
import { Card, Button } from '@research-copilot/ui'
import {
  useAssistantPermissions,
  useAssistantOnboarding,
  useAssistantRuntimePreferences,
  useAssistantShortcut,
  useAssistantWindow,
} from '../desktop-assistant/hooks'
import {
  AssistantDataPolicySection,
  AssistantDirectShortcutsSection,
  AssistantPermissionGuide,
  AssistantPrivacyRulesSection,
  AssistantRuntimeSettingsSection,
} from '../desktop-assistant/components'
import { formatAssistantShortcut } from '../desktop-assistant/shared'

export default function DesktopAssistantSettingsSection() {
  const permissions = useAssistantPermissions()
  const assistant = useAssistantWindow()
  const assistantShortcut = useAssistantShortcut()
  const onboarding = useAssistantOnboarding()
  const runtime = useAssistantRuntimePreferences()
  const [pendingAction, setPendingAction] = useState<'dock' | 'panel' | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [shortcutDraft, setShortcutDraft] = useState('')
  const [permissionGuideOpen, setPermissionGuideOpen] = useState(false)

  useEffect(() => {
    setShortcutDraft(assistantShortcut.shortcut)
  }, [assistantShortcut.shortcut])

  const toggleDock = async () => {
    if (!runtime.preferences.enabled) {
      setActionError('桌面助手已关闭，请先启用总开关')
      return
    }
    if (onboarding.loading) return
    if (
      !assistant.isDockVisible
      && !onboarding.onboarding.permission_guide_completed
    ) {
      setPermissionGuideOpen(true)
      return
    }
    setPendingAction('dock')
    setActionError(null)
    try {
      if (assistant.isDockVisible) {
        await Promise.all([assistant.hideDock(), assistant.hidePanel()])
      } else {
        await assistant.showDock()
      }
      await assistant.refreshVisibility()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error))
    } finally {
      setPendingAction(null)
    }
  }

  const togglePanel = async () => {
    if (!runtime.preferences.enabled) {
      setActionError('桌面助手已关闭，请先启用总开关')
      return
    }
    setPendingAction('panel')
    setActionError(null)
    try {
      if (assistant.isPanelVisible) await assistant.hidePanel()
      else await assistant.showPanel()
      await assistant.refreshVisibility()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error))
    } finally {
      setPendingAction(null)
    }
  }

  const saveShortcut = async () => {
    const saved = await assistantShortcut.save(shortcutDraft)
    if (!saved) setShortcutDraft(assistantShortcut.shortcut)
  }

  const resetDockPosition = async () => {
    setActionError(null)
    try {
      await assistant.resetDockPlacement()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error))
    }
  }

  const applyRuntimePreferences = async (
    next: typeof runtime.preferences,
  ) => {
    const saved = await runtime.save(next)
    await Promise.all([
      assistant.refreshVisibility(),
      assistantShortcut.refresh(),
    ])
    return saved
  }

  const finishPermissionGuide = async () => {
    const completed = await onboarding.completePermissionGuide()
    if (!completed) return
    setPermissionGuideOpen(false)
    if (runtime.preferences.enabled && !assistant.isDockVisible) {
      setPendingAction('dock')
      await assistant.showDock()
      await assistant.refreshVisibility()
      setPendingAction(null)
    }
  }

  return (
    <div className="space-y-4">
      <AssistantRuntimeSettingsSection
        preferences={runtime.preferences}
        loading={runtime.loading}
        saving={runtime.saving}
        error={runtime.error}
        onChange={applyRuntimePreferences}
      />
      <Card padding="md" className="space-y-4">
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: 'rgba(52,199,89,0.14)', color: '#34C759' }}
          >
            <MonitorDot className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-ink-primary">小妍桌面助手</h2>
            <p className="text-xs leading-5 text-ink-tertiary">
              让主窗口右下角的小妍走到桌面上，在任何应用旁边陪你解读、翻译与整理材料。
            </p>
          </div>
          <span
            className="ml-auto rounded-full px-2.5 py-1 text-xs font-medium"
            style={{
              background: runtime.preferences.enabled && assistant.isDockVisible
                ? 'var(--rc-badge-success-bg)'
                : 'var(--rc-badge-bg)',
              color: runtime.preferences.enabled && assistant.isDockVisible
                ? 'var(--rc-badge-success-text)'
                : 'var(--rc-badge-text)',
            }}
          >
            {!runtime.preferences.enabled
              ? '已关闭'
              : assistant.isDockVisible ? '在桌面上' : '在主窗口内'}
          </span>
        </div>

        <div
          className="rounded-3xl px-4 py-4"
          style={{ background: 'var(--rc-chip-inset-bg)', boxShadow: 'var(--rc-chip-inset-shadow)' }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink-primary">显示状态</p>
              <p className="mt-1 text-xs leading-5 text-ink-secondary">
                桌面小妍可直接拖动；关闭后会回到主窗口，不会退出应用。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={assistant.isDockVisible ? 'secondary' : 'primary'}
                size="sm"
                loading={pendingAction === 'dock'}
                disabled={
                  !runtime.preferences.enabled
                  || (!assistant.isDockVisible && onboarding.loading)
                }
                onClick={() => void toggleDock()}
              >
                {assistant.isDockVisible ? '让小妍回到窗口' : '让小妍走到桌面'}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                loading={pendingAction === 'panel'}
                disabled={!runtime.preferences.enabled}
                onClick={() => void togglePanel()}
              >
                {assistant.isPanelVisible ? '关闭动作面板' : '打开动作面板'}
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div
            className="rounded-3xl px-4 py-4"
            style={{ background: 'var(--rc-chip-inset-bg)', boxShadow: 'var(--rc-chip-inset-shadow)' }}
          >
            <div className="flex items-center gap-2">
              <Keyboard className="h-4 w-4 text-[var(--rc-accent)]" />
              <p className="text-sm font-semibold text-ink-primary">全局快捷键</p>
            </div>
            <p className="mt-1 text-xs leading-5 text-ink-secondary">
              点击输入框后按下新的组合键；若与其他应用冲突，会保留原快捷键。
            </p>
            <div className="mt-3 flex gap-2">
              <input
                aria-label="桌面助手全局快捷键"
                readOnly
                disabled={!runtime.preferences.enabled}
                value={assistantShortcut.loading ? '读取中…' : shortcutDraft}
                onKeyDown={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  const shortcut = formatAssistantShortcut(event)
                  if (shortcut) setShortcutDraft(shortcut)
                }}
                onFocus={(event) => event.currentTarget.select()}
                className="min-w-0 flex-1 rounded-2xl border px-3 py-2 text-sm outline-none"
                style={{
                  background: 'var(--rc-control-bg)',
                  borderColor: 'var(--rc-control-border)',
                  color: 'var(--rc-text)',
                  boxShadow: 'var(--rc-control-shadow)',
                }}
              />
              <Button
                variant="secondary"
                size="sm"
                loading={assistantShortcut.saving}
                disabled={
                  assistantShortcut.loading
                  || !runtime.preferences.enabled
                  || !shortcutDraft
                  || shortcutDraft === assistantShortcut.shortcut
                }
                onClick={() => void saveShortcut()}
              >
                应用
              </Button>
            </div>
            {assistantShortcut.diagnostic
              && assistantShortcut.diagnostic.status !== 'healthy'
              && assistantShortcut.diagnostic.status !== 'disabled' && (
              <div
                role="status"
                className="mt-3 rounded-2xl px-3 py-2 text-xs leading-5"
                style={{
                  background: 'var(--rc-badge-warning-bg)',
                  color: 'var(--rc-badge-warning-text)',
                }}
              >
                <p className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{assistantShortcut.diagnostic.message}</span>
                </p>
                <p className="mt-1">
                  请求：{assistantShortcut.diagnostic.requested_shortcut}
                  {assistantShortcut.diagnostic.active_shortcut
                    ? `；当前可用：${assistantShortcut.diagnostic.active_shortcut}`
                    : '；当前没有可用的全局快捷键'}
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  loading={assistantShortcut.saving}
                  className="mt-2"
                  onClick={() => void assistantShortcut.retry()}
                >
                  重试注册
                </Button>
              </div>
            )}
          </div>

          <div
            className="rounded-3xl px-4 py-4"
            style={{ background: 'var(--rc-chip-inset-bg)', boxShadow: 'var(--rc-chip-inset-shadow)' }}
          >
            <div className="flex items-center gap-2">
              <MousePointerClick className="h-4 w-4 text-[var(--rc-accent)]" />
              <p className="text-sm font-semibold text-ink-primary">桌面小妍</p>
            </div>
            <p className="mt-1 text-xs leading-5 text-ink-secondary">
              小妍本体就是拖动区域。单击打开动作面板，拖动后吸附到最近的屏幕边缘并记住位置，换显示器后会自动迁移。
            </p>
            <div className="mt-3">
              <Button
                variant="secondary"
                size="sm"
                disabled={!runtime.preferences.enabled}
                onClick={() => void resetDockPosition()}
              >
                重置小妍位置
              </Button>
            </div>
          </div>

          <div
            className="rounded-3xl px-4 py-4"
            style={{ background: 'var(--rc-chip-inset-bg)', boxShadow: 'var(--rc-chip-inset-shadow)' }}
          >
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-[var(--rc-accent)]" />
              <p className="text-sm font-semibold text-ink-primary">隐私安全</p>
            </div>
            <p className="mt-1 text-xs leading-5 text-ink-secondary">
              默认不采集密码管理器、金融与系统安全应用，并在发送前展示完整预览。
            </p>
          </div>

          <div
            className="rounded-3xl px-4 py-4"
            style={{ background: 'var(--rc-chip-inset-bg)', boxShadow: 'var(--rc-chip-inset-shadow)' }}
          >
            <div className="flex items-center gap-2">
              <PanelTopOpen className="h-4 w-4 text-[var(--rc-accent)]" />
              <p className="text-sm font-semibold text-ink-primary">动作面板</p>
            </div>
            <p className="mt-1 text-xs leading-5 text-ink-secondary">
              面板与小妍分开控制。关闭面板不会隐藏桌面小妍，按 Esc 也可随时收起。
            </p>
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          {[
            {
              key: 'accessibility',
              label: '辅助功能',
              granted: permissions.status?.accessibility,
              request: permissions.requestAccessibility,
            },
            {
              key: 'screen',
              label: '屏幕录制',
              granted: permissions.status?.screen_recording,
              request: permissions.requestScreenRecording,
            },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between rounded-2xl bg-[var(--rc-control-bg)] px-3 py-2">
              <span className="flex items-center gap-2 text-xs text-ink-secondary">
                {item.granted ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <AlertCircle className="h-4 w-4 text-amber-500" />}
                {item.label}：{permissions.loading ? '检查中' : item.granted ? '已授权' : '未授权'}
              </span>
              {!permissions.loading && !item.granted && (
                <Button variant="secondary" size="sm" onClick={() => void item.request()}>
                  去授权
                </Button>
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setPermissionGuideOpen((open) => !open)}
          >
            {permissionGuideOpen ? '收起权限说明' : '查看权限用途说明'}
          </Button>
        </div>

        {(permissions.error || onboarding.error || assistantShortcut.error || actionError) && (
          <p role="alert" className="text-xs text-red-500">
            {permissions.error || onboarding.error || assistantShortcut.error || actionError}
          </p>
        )}
      </Card>
      {permissionGuideOpen && (
        <AssistantPermissionGuide
          saving={onboarding.saving}
          error={onboarding.error}
          onFinish={finishPermissionGuide}
        />
      )}
      <AssistantPrivacyRulesSection />
      <AssistantDataPolicySection />
      <AssistantDirectShortcutsSection />
    </div>
  )
}
