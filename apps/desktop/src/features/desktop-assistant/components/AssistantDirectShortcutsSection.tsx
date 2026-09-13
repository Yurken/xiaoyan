/**
 * 直达动作快捷键设置小节（P1-1，PRD §16.2）
 * 三个可选快捷键默认不注册；开启后立即注册，录制新组合键后需手动应用。
 * 注册冲突复用主快捷键模式：展示按动作的持久诊断并提供重试入口。
 */
import { useEffect, useState } from 'react'
import { AlertCircle, Zap } from 'lucide-react'
import { Button, Card } from '@research-copilot/ui'
import { useAssistantDirectShortcuts } from '../hooks/useAssistantDirectShortcuts'
import {
  ASSISTANT_DIRECT_ACTIONS,
  formatAssistantShortcut,
  type AssistantDirectAction,
} from '../shared'

function suggestedShortcut(action: AssistantDirectAction): string {
  return ASSISTANT_DIRECT_ACTIONS.find((config) => config.id === action)?.suggestedShortcut
    ?? ''
}

export function AssistantDirectShortcutsSection() {
  const directShortcuts = useAssistantDirectShortcuts()
  const [drafts, setDrafts] = useState<Record<AssistantDirectAction, string>>(() => ({
    interpret: suggestedShortcut('interpret'),
    translate: suggestedShortcut('translate'),
    screenshot: suggestedShortcut('screenshot'),
  }))

  useEffect(() => {
    setDrafts((current) => {
      const next = { ...current }
      for (const status of directShortcuts.statuses) {
        next[status.action] = status.configured_shortcut ?? suggestedShortcut(status.action)
      }
      return next
    })
  }, [directShortcuts.statuses])

  const toggle = async (action: AssistantDirectAction, enabled: boolean) => {
    if (enabled) {
      await directShortcuts.save(action, null)
    } else {
      await directShortcuts.save(action, drafts[action] || suggestedShortcut(action))
    }
  }

  const apply = async (action: AssistantDirectAction) => {
    const saved = await directShortcuts.save(action, drafts[action])
    if (!saved) {
      const configured = directShortcuts.statuses.find(
        (status) => status.action === action,
      )?.configured_shortcut
      setDrafts((current) => ({
        ...current,
        [action]: configured ?? suggestedShortcut(action),
      }))
    }
  }

  return (
    <Card padding="md" className="space-y-4">
      <div className="flex items-start gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ background: 'rgba(255,149,0,0.12)', color: '#FF9500' }}
        >
          <Zap className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-base font-semibold text-ink-primary">直达动作快捷键</h2>
          <p className="text-xs leading-5 text-ink-tertiary">
            可选快捷键，默认不注册。开启后按下组合键即读取当前选区并直接进入动作，跳过面板中的动作选择；仍需发送前预览时会先停在预览页。
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {ASSISTANT_DIRECT_ACTIONS.map((config) => {
          const status = directShortcuts.statuses.find((item) => item.action === config.id)
          const enabled = Boolean(status?.configured_shortcut)
          const saving = directShortcuts.savingAction === config.id
          const controlsLocked = directShortcuts.loading || directShortcuts.busy
          const diagnostic = status?.diagnostic
          const showDiagnostic = Boolean(
            diagnostic
            && diagnostic.status !== 'healthy'
            && diagnostic.status !== 'disabled',
          )
          return (
            <div
              key={config.id}
              className="rounded-3xl px-4 py-4"
              style={{
                background: 'var(--rc-chip-inset-bg)',
                boxShadow: 'var(--rc-chip-inset-shadow)',
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink-primary">{config.label}</p>
                  <p className="mt-1 text-xs leading-5 text-ink-secondary">
                    {config.description}
                  </p>
                </div>
                <Button
                  variant={enabled ? 'secondary' : 'primary'}
                  size="sm"
                  loading={saving}
                  disabled={controlsLocked}
                  onClick={() => void toggle(config.id, enabled)}
                >
                  {enabled ? '关闭' : `开启（${suggestedShortcut(config.id)}）`}
                </Button>
              </div>

              {enabled && (
                <div className="mt-3 flex gap-2">
                  <input
                    aria-label={`${config.label}快捷键`}
                    readOnly
                    disabled={controlsLocked}
                    value={directShortcuts.loading ? '读取中…' : drafts[config.id]}
                    onKeyDown={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      const shortcut = formatAssistantShortcut(event)
                      if (shortcut) {
                        setDrafts((current) => ({ ...current, [config.id]: shortcut }))
                      }
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
                    loading={saving}
                    disabled={
                      controlsLocked
                      || !drafts[config.id]
                      || drafts[config.id] === status?.configured_shortcut
                    }
                    onClick={() => void apply(config.id)}
                  >
                    应用
                  </Button>
                </div>
              )}

              {showDiagnostic && diagnostic && (
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
                    <span>{diagnostic.message}</span>
                  </p>
                  <p className="mt-1">
                    请求：{diagnostic.requested_shortcut || '（空）'}
                    {diagnostic.active_shortcut
                      ? `；当前可用：${diagnostic.active_shortcut}`
                      : '；当前该动作没有可用的全局快捷键'}
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    loading={saving}
                    disabled={controlsLocked}
                    className="mt-2"
                    onClick={() => void directShortcuts.retry(config.id)}
                  >
                    重试注册
                  </Button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {directShortcuts.error && (
        <p role="alert" className="text-xs text-red-500">{directShortcuts.error}</p>
      )}
    </Card>
  )
}
