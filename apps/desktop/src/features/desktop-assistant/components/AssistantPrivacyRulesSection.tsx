import { useEffect, useState, type KeyboardEvent } from 'react'
import { Plus, ScanText, ShieldCheck, X } from 'lucide-react'
import { Button, Card } from '@research-copilot/ui'
import { useAssistantPrivacyPreferences } from '../hooks/useAssistantPrivacyPreferences'

interface AppRuleEditorProps {
  id: string
  label: string
  description: string
  items: string[]
  onChange: (items: string[]) => void
}

function AppRuleEditor({
  id,
  label,
  description,
  items,
  onChange,
}: AppRuleEditorProps) {
  const [draft, setDraft] = useState('')

  const add = () => {
    const bundleId = draft.trim()
    if (!bundleId) return
    if (!items.some((item) => item.toLowerCase() === bundleId.toLowerCase())) {
      onChange([...items, bundleId])
    }
    setDraft('')
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    add()
  }

  return (
    <div
      className="rounded-3xl px-4 py-4"
      style={{
        background: 'var(--rc-chip-inset-bg)',
        boxShadow: 'var(--rc-chip-inset-shadow)',
      }}
    >
      <label htmlFor={id} className="text-sm font-semibold text-ink-primary">
        {label}
      </label>
      <p className="mt-1 text-xs leading-5 text-ink-secondary">{description}</p>

      <div className="mt-3 flex gap-2">
        <input
          id={id}
          value={draft}
          placeholder="例如 com.apple.Safari"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          className="min-w-0 flex-1 rounded-2xl border px-3 py-2 text-sm outline-none"
          style={{
            background: 'var(--rc-control-bg)',
            borderColor: 'var(--rc-control-border)',
            color: 'var(--rc-text)',
            boxShadow: 'var(--rc-control-shadow)',
          }}
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={!draft.trim()}
          onClick={add}
          aria-label={`添加到${label}`}
        >
          <Plus className="h-4 w-4" />
          添加
        </Button>
      </div>

      <div className="mt-3 flex min-h-8 flex-wrap gap-2" aria-live="polite">
        {items.length === 0 ? (
          <span className="text-xs text-ink-tertiary">尚未添加自定义规则</span>
        ) : (
          items.map((item) => (
            <span
              key={item.toLowerCase()}
              className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs text-ink-secondary"
              style={{ borderColor: 'var(--rc-control-border)' }}
            >
              {item}
              <button
                type="button"
                onClick={() => onChange(items.filter((entry) => entry !== item))}
                className="rounded-full p-0.5 hover:bg-black/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rc-accent)]"
                aria-label={`移除 ${item}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))
        )}
      </div>
    </div>
  )
}

export function AssistantPrivacyRulesSection() {
  const privacy = useAssistantPrivacyPreferences()
  const [allowedApps, setAllowedApps] = useState<string[]>([])
  const [blockedApps, setBlockedApps] = useState<string[]>([])
  const [windowTitleEnabled, setWindowTitleEnabled] = useState(false)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)

  useEffect(() => {
    setAllowedApps(privacy.preferences.allowed_apps)
    setBlockedApps(privacy.preferences.blocked_apps)
    setWindowTitleEnabled(privacy.preferences.window_title_enabled)
  }, [privacy.preferences])

  const changed =
    JSON.stringify(allowedApps) !== JSON.stringify(privacy.preferences.allowed_apps)
    || JSON.stringify(blockedApps) !== JSON.stringify(privacy.preferences.blocked_apps)
    || windowTitleEnabled !== privacy.preferences.window_title_enabled

  const save = async () => {
    setSavedMessage(null)
    const saved = await privacy.save({
      allowed_apps: allowedApps,
      blocked_apps: blockedApps,
      window_title_enabled: windowTitleEnabled,
    })
    if (saved) setSavedMessage('隐私规则已保存')
  }

  return (
    <Card padding="md" className="space-y-4">
      <div className="flex items-start gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ background: 'rgba(0,122,255,0.12)', color: '#007AFF' }}
        >
          <ShieldCheck className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-base font-semibold text-ink-primary">应用隐私规则</h2>
          <p className="text-xs leading-5 text-ink-tertiary">
            使用 macOS bundle ID 精确匹配。禁止规则始终优先，密码管理器、系统安全和金融应用的内置禁止规则不可覆盖。
          </p>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <AppRuleEditor
          id="assistant-allowed-app"
          label="允许读取的应用"
          description="留空表示允许除禁止项以外的应用；添加后，只从列表中的应用采集。"
          items={allowedApps}
          onChange={setAllowedApps}
        />
        <AppRuleEditor
          id="assistant-blocked-app"
          label="禁止应用"
          description="添加不希望桌面助手接触的应用；即使同时位于允许列表，也会阻止采集。"
          items={blockedApps}
          onChange={setBlockedApps}
        />
      </div>

      <label
        className="flex cursor-pointer items-start gap-3 rounded-3xl px-4 py-4"
        style={{
          background: 'var(--rc-chip-inset-bg)',
          boxShadow: 'var(--rc-chip-inset-shadow)',
        }}
      >
        <input
          type="checkbox"
          aria-label="记录来源窗口标题"
          checked={windowTitleEnabled}
          disabled={privacy.loading || privacy.saving}
          onChange={(event) => setWindowTitleEnabled(event.target.checked)}
          className="mt-1 h-4 w-4 rounded"
        />
        <span>
          <span className="flex items-center gap-2 text-sm font-semibold text-ink-primary">
            <ScanText className="h-4 w-4 text-[var(--rc-accent)]" />
            记录来源窗口标题
          </span>
          <span className="mt-1 block text-xs leading-5 text-ink-secondary">
            默认关闭。关闭时标题只在内存中用于敏感窗口拦截，不返回前端、不写入捕获或导入记录；保存关闭状态会清除已有来源标题。
          </span>
        </span>
      </label>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div aria-live="polite">
          {privacy.loading && <p className="text-xs text-ink-tertiary">正在读取规则…</p>}
          {privacy.error && <p role="alert" className="text-xs text-red-500">{privacy.error}</p>}
          {!privacy.error && savedMessage && (
            <p className="text-xs text-green-600">{savedMessage}</p>
          )}
        </div>
        <Button
          type="button"
          size="sm"
          loading={privacy.saving}
          disabled={privacy.loading || !changed}
          onClick={() => void save()}
        >
          保存隐私规则
        </Button>
      </div>
    </Card>
  )
}
