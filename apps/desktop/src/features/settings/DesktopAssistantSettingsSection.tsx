/**
 * 桌面助手设置分区
 */
import { MonitorDot, Keyboard, MousePointerClick, Shield } from 'lucide-react'
import { Card, Button } from '@research-copilot/ui'
import { launchDesktopAssistant } from '../desktop-assistant/launch'

export default function DesktopAssistantSettingsSection() {
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
              在任何应用上方通过悬浮球或快捷键唤起小妍，解读、翻译、追问或导入研究材料。
            </p>
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
              可拖动的小妍悬浮球，单击打开动作面板。位置和显隐可在后续版本中配置。
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
        </div>

        <Button variant="primary" size="sm" onClick={() => void launchDesktopAssistant()}>
          打开桌面助手
        </Button>
      </Card>
    </div>
  )
}
