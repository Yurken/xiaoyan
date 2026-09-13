import { useState } from 'react'
import {
  Accessibility,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardPaste,
  MonitorUp,
  ShieldCheck,
} from 'lucide-react'
import { Button, Card } from '@research-copilot/ui'
import { useAssistantPermissions } from '../hooks/useAssistantPermissions'

interface AssistantPermissionGuideProps {
  saving?: boolean
  error?: string | null
  onFinish: () => Promise<void> | void
}

const STEPS = [
  {
    key: 'accessibility',
    title: '辅助功能：读取你主动选择的文字',
    description:
      '仅在你点击来源按钮、桌面小妍或快捷键时读取当前选区，不监听键盘输入，也不会后台轮询其他应用。',
    fallback: '不授权仍可使用剪贴板快照和手动粘贴。',
    icon: Accessibility,
  },
  {
    key: 'screen',
    title: '屏幕录制：由你框选需要解读的区域',
    description:
      '只在你选择“截图”后启动系统框选，不录制连续画面，不保存未导入的截图正文。',
    fallback: '不授权仍可使用选区、剪贴板和手动粘贴。',
    icon: MonitorUp,
  },
] as const

export function AssistantPermissionGuide({
  saving = false,
  error,
  onFinish,
}: AssistantPermissionGuideProps) {
  const permissions = useAssistantPermissions()
  const [step, setStep] = useState(0)
  const current = STEPS[step]
  const granted = current.key === 'accessibility'
    ? permissions.status?.accessibility
    : permissions.status?.screen_recording
  const request = current.key === 'accessibility'
    ? permissions.requestAccessibility
    : permissions.requestScreenRecording
  const Icon = current.icon

  return (
    <Card padding="md" className="space-y-4" aria-label="桌面助手权限引导">
      <div className="flex items-start gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ background: 'rgba(52,199,89,0.14)', color: '#34C759' }}
        >
          <ShieldCheck className="h-5 w-5" />
        </span>
        <div>
          <p className="text-xs font-medium text-[var(--rc-accent)]">
            权限说明 {step + 1} / {STEPS.length}
          </p>
          <h2 className="mt-1 text-base font-semibold text-ink-primary">
            只在你主动触发时获取上下文
          </h2>
        </div>
      </div>

      <div
        className="rounded-3xl px-4 py-4"
        style={{
          background: 'var(--rc-chip-inset-bg)',
          boxShadow: 'var(--rc-chip-inset-shadow)',
        }}
      >
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-[var(--rc-accent)]" />
          <h3 className="text-sm font-semibold text-ink-primary">{current.title}</h3>
        </div>
        <p className="mt-2 text-xs leading-5 text-ink-secondary">{current.description}</p>
        <p className="mt-2 flex items-center gap-2 text-xs leading-5 text-ink-secondary">
          <ClipboardPaste className="h-4 w-4 shrink-0" />
          {current.fallback}
        </p>
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-xs text-ink-secondary">
            {granted && <CheckCircle2 className="h-4 w-4 text-green-500" />}
            {permissions.loading ? '正在检查权限…' : granted ? '已授权' : '尚未授权'}
          </span>
          {!permissions.loading && !granted && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => void request()}
            >
              去授权
            </Button>
          )}
        </div>
      </div>

      {(permissions.error || error) && (
        <p role="alert" className="text-xs text-red-500">
          {permissions.error || error}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          loading={saving}
          onClick={() => void onFinish()}
        >
          仅用剪贴板/粘贴继续
        </Button>
        <div className="flex gap-2">
          {step > 0 && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setStep((currentStep) => currentStep - 1)}
            >
              <ArrowLeft className="h-4 w-4" />
              上一步
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button
              type="button"
              size="sm"
              onClick={() => setStep((currentStep) => currentStep + 1)}
            >
              下一步
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              loading={saving}
              onClick={() => void onFinish()}
            >
              完成并继续
            </Button>
          )}
        </div>
      </div>
    </Card>
  )
}
