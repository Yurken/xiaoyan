/**
 * 桌面助手设置分区
 */
import { useState } from 'react'
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
import { useAssistantPermissions, useAssistantWindow } from '../desktop-assistant/hooks'

export default function DesktopAssistantSettingsSection() {
  const permissions = useAssistantPermissions()
  const assistant = useAssistantWindow()
  const [pendingAction, setPendingAction] = useState<'dock' | 'panel' | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const toggleDock = async () => {
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

  return (
    <div className="space-y-4">
      <Card padding="md" className="space-y-4">
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: 'rgba(52,199,89,0.14)', color: '#34C759' }}
          >
            <MonitorDot className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-ink-primary">桌面悬浮助手</h2>
            <p className="text-xs leading-5 text-ink-tertiary">
              让主窗口右下角的小妍走到桌面上，在任何应用旁边陪你解读、翻译与整理材料。
            </p>
          </div>
          <span
            className="ml-auto rounded-full px-2.5 py-1 text-xs font-medium"
            style={{
              background: assistant.isDockVisible
                ? 'var(--rc-badge-success-bg)'
                : 'var(--rc-badge-bg)',
              color: assistant.isDockVisible
                ? 'var(--rc-badge-success-text)'
                : 'var(--rc-badge-text)',
            }}
          >
            {assistant.isDockVisible ? '在桌面上' : '在主窗口内'}
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
                onClick={() => void toggleDock()}
              >
                {assistant.isDockVisible ? '让小妍回到窗口' : '让小妍走到桌面'}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                loading={pendingAction === 'panel'}
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
              默认 Alt + Space 唤起动作面板。首次使用需授权辅助功能与屏幕录制权限。
            </p>
          </div>

          <div
            className="rounded-3xl px-4 py-4"
            style={{ background: 'var(--rc-chip-inset-bg)', boxShadow: 'var(--rc-chip-inset-shadow)' }}
          >
            <div className="flex items-center gap-2">
              <MousePointerClick className="h-4 w-4 text-[var(--rc-accent)]" />
              <p className="text-sm font-semibold text-ink-primary">悬浮球</p>
            </div>
            <p className="mt-1 text-xs leading-5 text-ink-secondary">
              小妍本体就是拖动区域。单击打开动作面板，拖动后停在需要的位置，不带窗口背景或阴影。
            </p>
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
              默认不采集密码管理器、金融与系统安全应用。所有内容在发送前均需用户确认。
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

        {(permissions.error || actionError) && (
          <p role="alert" className="text-xs text-red-500">{permissions.error || actionError}</p>
        )}
      </Card>
    </div>
  )
}
