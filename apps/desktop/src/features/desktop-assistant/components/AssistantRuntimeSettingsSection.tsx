import { FileWarning, Power } from 'lucide-react'
import { Button, Card } from '@research-copilot/ui'
import type { AssistantRuntimePreferences } from '../shared'

interface AssistantRuntimeSettingsSectionProps {
  preferences: AssistantRuntimePreferences
  loading: boolean
  saving: boolean
  error: string | null
  onChange: (preferences: AssistantRuntimePreferences) => Promise<boolean>
}

export function AssistantRuntimeSettingsSection({
  preferences,
  loading,
  saving,
  error,
  onChange,
}: AssistantRuntimeSettingsSectionProps) {
  return (
    <Card padding="md" className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{
              background: preferences.enabled
                ? 'rgba(52,199,89,0.14)'
                : 'var(--rc-chip-inset-bg)',
              color: preferences.enabled ? '#34C759' : 'var(--rc-text-muted)',
            }}
          >
            <Power className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-ink-primary">桌面助手总开关</h2>
            <p className="text-xs leading-5 text-ink-tertiary">
              关闭后隐藏桌面小妍和动作面板、注销全局快捷键，并阻止新的采集与模型动作。
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant={preferences.enabled ? 'secondary' : 'primary'}
          size="sm"
          loading={loading || saving}
          aria-pressed={preferences.enabled}
          onClick={() => void onChange({
            ...preferences,
            enabled: !preferences.enabled,
          })}
        >
          {preferences.enabled ? '关闭桌面助手' : '启用桌面助手'}
        </Button>
      </div>

      <div
        className="rounded-3xl px-4 py-4"
        style={{
          background: 'var(--rc-chip-inset-bg)',
          boxShadow: 'var(--rc-chip-inset-shadow)',
        }}
      >
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            aria-label="记录桌面助手诊断日志"
            checked={preferences.diagnostic_logging_enabled}
            disabled={loading || saving}
            onChange={(event) => void onChange({
              ...preferences,
              diagnostic_logging_enabled: event.target.checked,
            })}
            className="mt-0.5 h-4 w-4 rounded"
          />
          <span>
            <span className="flex items-center gap-2 text-sm font-semibold text-ink-primary">
              <FileWarning className="h-4 w-4 text-[var(--rc-accent)]" />
              记录桌面助手诊断日志
            </span>
            <span className="mt-1 block text-xs leading-5 text-ink-secondary">
              仅记录窗口、快捷键和清理错误，不写入正文、窗口标题、OCR 文本或截图内容；默认关闭。
            </span>
          </span>
        </label>
      </div>

      {error && <p role="alert" className="text-xs text-red-500">{error}</p>}
    </Card>
  )
}
