import { X } from 'lucide-react'

interface AssistantSessionContextPanelProps {
  captureContextLabel: string
  includeCaptureContext: boolean
  useLocalKnowledge: boolean
  hadLocalKnowledge: boolean
  knowledgeThemeName?: string
  disabled?: boolean
  onRemoveCaptureContext: () => void
  onRemoveLocalKnowledge: () => void
}

export function AssistantSessionContextPanel({
  captureContextLabel,
  includeCaptureContext,
  useLocalKnowledge,
  hadLocalKnowledge,
  knowledgeThemeName,
  disabled = false,
  onRemoveCaptureContext,
  onRemoveLocalKnowledge,
}: AssistantSessionContextPanelProps) {
  return (
    <div
      className="mb-3 rounded-2xl border px-3 py-2"
      style={{ borderColor: 'var(--rc-border)' }}
    >
      <div className="mb-1.5 text-[10px] font-medium" style={{ color: 'var(--rc-text-muted)' }}>
        后续追问将使用
      </div>
      <div className="flex flex-wrap gap-1.5">
        {includeCaptureContext ? (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px]"
            style={{ background: 'var(--rc-info-chip-bg)', color: 'var(--rc-info-chip-text)' }}
          >
            {captureContextLabel}
            <button
              type="button"
              onClick={onRemoveCaptureContext}
              disabled={disabled}
              aria-label="移除捕获内容"
              className="rounded-full p-0.5 disabled:opacity-40"
            >
              <X size={10} />
            </button>
          </span>
        ) : (
          <span className="text-[10px]" style={{ color: 'var(--rc-text-muted)' }}>
            不包含捕获内容；已有回答仍保留
          </span>
        )}

        {useLocalKnowledge && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px]"
            style={{ background: 'var(--rc-info-chip-bg)', color: 'var(--rc-info-chip-text)' }}
          >
            本地知识{knowledgeThemeName ? ` · ${knowledgeThemeName}` : ''}
            <button
              type="button"
              onClick={onRemoveLocalKnowledge}
              disabled={disabled}
              aria-label="移除本地知识"
              className="rounded-full p-0.5 disabled:opacity-40"
            >
              <X size={10} />
            </button>
          </span>
        )}
        {!useLocalKnowledge && hadLocalKnowledge && (
          <span className="text-[10px]" style={{ color: 'var(--rc-text-muted)' }}>
            本地知识已从后续追问移除
          </span>
        )}
      </div>
    </div>
  )
}
