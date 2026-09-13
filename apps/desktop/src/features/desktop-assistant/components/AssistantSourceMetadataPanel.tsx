import { useEffect, useState } from 'react'
import { Camera, ChevronDown, ChevronUp, Link2, Loader2, Pencil, Save, X } from 'lucide-react'
import type { AssistantSourceMetadata, AssistantSourceMetadataDraft } from '../shared'
import type { UseAssistantSourceMetadata } from '../hooks/useAssistantSourceMetadata'

interface AssistantSourceMetadataPanelProps {
  controller: UseAssistantSourceMetadata
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function draftFrom(metadata: AssistantSourceMetadata | null): AssistantSourceMetadataDraft {
  return {
    sourceApp: metadata?.source_app ?? '',
    windowTitle: metadata?.window_title ?? '',
    sourceTitle: metadata?.source_title ?? '',
    sourceUrl: metadata?.source_url ?? '',
  }
}

export function AssistantSourceMetadataPanel({ controller }: AssistantSourceMetadataPanelProps) {
  const { metadata } = controller
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<AssistantSourceMetadataDraft>(() => draftFrom(metadata))

  useEffect(() => {
    if (!editing) setDraft(draftFrom(metadata))
  }, [metadata, editing])

  if (controller.loading && !metadata) {
    return (
      <div className="flex items-center gap-2 border-b px-5 py-2 text-xs text-ink-tertiary" style={{ borderColor: 'var(--rc-border)' }}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" />正在读取来源…
      </div>
    )
  }
  if (!metadata && !controller.error) return null

  const source = metadata
  return (
    <section className="border-b px-5 py-2.5" style={{ borderColor: 'var(--rc-border)', background: 'var(--rc-control-bg)' }} aria-label="来源信息">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          className="flex min-w-0 items-center gap-2 text-left text-xs font-medium text-ink-secondary"
          onClick={() => setExpanded((value) => !value)}
        >
          <Link2 className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            来源：{source?.source_title || source?.window_title || source?.source_app || source?.source_type || '未命名来源'}
          </span>
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
        {source && expanded && !editing ? (
          <button type="button" className="flex items-center gap-1 text-xs text-[var(--rc-accent)]" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" />编辑来源
          </button>
        ) : null}
      </div>

      {expanded && source ? (
        <div className="mt-3 space-y-3">
          {editing ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {([
                ['来源标题', 'sourceTitle'],
                ['来源链接', 'sourceUrl'],
                ['来源应用', 'sourceApp'],
                ['窗口标题', 'windowTitle'],
              ] as const).map(([label, key]) => (
                <label key={key} className="space-y-1 text-xs text-ink-tertiary">
                  <span>{label}</span>
                  <input
                    aria-label={label}
                    value={draft[key]}
                    onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))}
                    className="w-full rounded-xl border px-3 py-2 text-xs text-ink-primary outline-none"
                    style={{ background: 'var(--rc-surface)', borderColor: 'var(--rc-border)' }}
                  />
                </label>
              ))}
              <div className="flex items-center gap-2 sm:col-span-2">
                <button
                  type="button"
                  disabled={controller.saving}
                  onClick={() => { void controller.save(draft).then((saved) => { if (saved) setEditing(false) }) }}
                  className="flex items-center gap-1 rounded-xl bg-[var(--rc-accent)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                >
                  {controller.saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}保存来源
                </button>
                <button type="button" onClick={() => { setEditing(false); setDraft(draftFrom(metadata)) }} className="flex items-center gap-1 px-2 py-1.5 text-xs text-ink-tertiary">
                  <X className="h-3.5 w-3.5" />取消
                </button>
              </div>
            </div>
          ) : (
            <dl className="grid gap-x-6 gap-y-1.5 text-xs sm:grid-cols-2">
              {source.source_app ? <><dt className="text-ink-tertiary">应用</dt><dd className="text-ink-secondary">{source.source_app}</dd></> : null}
              {source.window_title ? <><dt className="text-ink-tertiary">窗口</dt><dd className="truncate text-ink-secondary" title={source.window_title}>{source.window_title}</dd></> : null}
              {source.source_title ? <><dt className="text-ink-tertiary">标题</dt><dd className="text-ink-secondary">{source.source_title}</dd></> : null}
              {source.source_url ? <><dt className="text-ink-tertiary">链接</dt><dd className="truncate text-ink-secondary" title={source.source_url}>{source.source_url}</dd></> : null}
              {source.capture_region ? <><dt className="text-ink-tertiary">截图范围</dt><dd className="text-ink-secondary">{source.capture_region.width} × {source.capture_region.height} 像素{source.capture_region.x == null ? '（系统未提供全局坐标）' : ` · (${source.capture_region.x}, ${source.capture_region.y})`}</dd></> : null}
              {source.captured_at ? <><dt className="text-ink-tertiary">捕获时间</dt><dd className="text-ink-secondary">{new Date(source.captured_at).toLocaleString('zh-CN')}</dd></> : null}
            </dl>
          )}
          {source.attachments.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {source.attachments.map((attachment) => (
                <span key={attachment.id} className="flex items-center gap-1 rounded-full bg-black/[0.05] px-2.5 py-1 text-[11px] text-ink-secondary dark:bg-white/[0.07]">
                  <Camera className="h-3 w-3" />原始截图附件 · {formatBytes(attachment.size_bytes)}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      {controller.error ? <p role="alert" className="mt-2 text-xs text-apple-red">{controller.error}</p> : null}
    </section>
  )
}
