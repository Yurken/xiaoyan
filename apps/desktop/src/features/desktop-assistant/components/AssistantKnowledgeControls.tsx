import { Select } from '@research-copilot/ui'
import type { AssistantKnowledgeTheme } from '../shared'

interface AssistantKnowledgeControlsProps {
  themes: AssistantKnowledgeTheme[]
  enabled: boolean
  selectedThemeId: string
  loading?: boolean
  error?: string | null
  onEnabledChange: (enabled: boolean) => void
  onThemeChange: (themeId: string) => void
}

export function AssistantKnowledgeControls({
  themes,
  enabled,
  selectedThemeId,
  loading = false,
  error,
  onEnabledChange,
  onThemeChange,
}: AssistantKnowledgeControlsProps) {
  return (
    <div
      className="mb-4 rounded-2xl border p-3"
      style={{
        background: 'var(--rc-control-bg)',
        borderColor: 'var(--rc-control-border)',
      }}
    >
      <label className="flex cursor-pointer items-start gap-2">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4"
          checked={enabled}
          disabled={loading}
          onChange={(event) => onEnabledChange(event.target.checked)}
        />
        <span className="min-w-0">
          <span className="block text-xs font-medium" style={{ color: 'var(--rc-text)' }}>
            使用本地知识
          </span>
          <span className="mt-0.5 block text-[10px] leading-4" style={{ color: 'var(--rc-text-muted)' }}>
            仅检索所选主题，不额外调用 embedding 服务；只用于解读和追问。
          </span>
        </span>
      </label>

      {enabled && (
        <div className="mt-2">
          <Select
            value={selectedThemeId}
            onChange={onThemeChange}
            options={themes.map((theme) => ({
              value: theme.id,
              label: `${theme.name} · ${theme.asset_count} 项资料`,
            }))}
            className="w-full"
          />
        </div>
      )}

      {loading && (
        <p className="mt-2 text-[10px]" style={{ color: 'var(--rc-text-muted)' }}>
          正在读取本地研究主题…
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-[10px]" style={{ color: 'var(--rc-badge-danger-text)' }}>
          {error}
        </p>
      )}
    </div>
  )
}
