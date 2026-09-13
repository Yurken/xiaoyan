import { useState } from 'react'
import {
  AlertTriangle,
  FileImage,
  Loader2,
  Pencil,
  RefreshCw,
  Save,
  Trash2,
  X,
} from 'lucide-react'
import type { AssistantImageAsset, AssistantSourceMetadataDraft } from '../shared'
import type { UseAssistantImageAssets } from '../hooks/useAssistantImageAssets'

interface AssistantImageAssetsPanelProps {
  controller: UseAssistantImageAssets
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatDate(value: string) {
  const date = new Date(value.endsWith('Z') || value.includes('+') ? value : `${value}Z`)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN')
}

function sourceDraft(asset: AssistantImageAsset): AssistantSourceMetadataDraft {
  return {
    sourceApp: asset.source_app ?? '',
    windowTitle: asset.window_title ?? '',
    sourceTitle: asset.source_title ?? '',
    sourceUrl: asset.source_url ?? '',
  }
}

function AssetCard({ asset, controller }: {
  asset: AssistantImageAsset
  controller: UseAssistantImageAssets
}) {
  const [editing, setEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [draft, setDraft] = useState(() => sourceDraft(asset))
  const busy = controller.activeAssetId !== null
  const title = asset.source_title || asset.window_title || asset.source_app || '未命名图片'

  return (
    <article className="rounded-2xl border border-black/[0.07] bg-white/70 p-4 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.035]">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-black/[0.04] p-2 text-ink-secondary dark:bg-white/[0.07]">
          <FileImage className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-medium text-ink-primary" title={title}>{title}</h3>
            {!asset.available ? (
              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-700 dark:text-amber-300">文件缺失</span>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-ink-tertiary">
            {asset.media_type} · {formatBytes(asset.size_bytes)} · {formatDate(asset.created_at)}
          </p>
          <dl className="mt-3 grid gap-x-5 gap-y-1 text-xs sm:grid-cols-2">
            {asset.source_app ? <><dt className="text-ink-tertiary">来源应用</dt><dd className="truncate text-ink-secondary">{asset.source_app}</dd></> : null}
            {asset.window_title ? <><dt className="text-ink-tertiary">窗口</dt><dd className="truncate text-ink-secondary" title={asset.window_title}>{asset.window_title}</dd></> : null}
            {asset.source_url ? <><dt className="text-ink-tertiary">来源链接</dt><dd className="truncate text-ink-secondary" title={asset.source_url}>{asset.source_url}</dd></> : null}
            {asset.capture_region ? <><dt className="text-ink-tertiary">截图范围</dt><dd className="text-ink-secondary">{asset.capture_region.width} × {asset.capture_region.height} 像素{asset.capture_region.x == null ? '' : ` · (${asset.capture_region.x}, ${asset.capture_region.y})`}</dd></> : null}
          </dl>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-label={`编辑 ${title} 的来源`}
            disabled={busy}
            onClick={() => { setDraft(sourceDraft(asset)); setEditing(true); setConfirmingDelete(false) }}
            className="rounded-xl p-2 text-ink-secondary transition hover:bg-black/[0.04] disabled:opacity-45 dark:hover:bg-white/[0.06]"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label={`删除图片 ${title}`}
            disabled={busy}
            onClick={() => { setConfirmingDelete(true); setEditing(false) }}
            className="rounded-xl p-2 text-apple-red transition hover:bg-red-500/10 disabled:opacity-45"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {editing ? (
        <div className="mt-4 grid gap-3 border-t border-black/[0.06] pt-4 dark:border-white/[0.08] sm:grid-cols-2">
          {([
            ['来源标题', 'sourceTitle'],
            ['来源链接', 'sourceUrl'],
            ['来源应用', 'sourceApp'],
            ['窗口标题', 'windowTitle'],
          ] as const).map(([label, key]) => (
            <label key={key} className="space-y-1 text-xs text-ink-tertiary">
              <span>{label}</span>
              <input
                aria-label={`${title} ${label}`}
                value={draft[key]}
                onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))}
                className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-xs text-ink-primary outline-none dark:border-white/10 dark:bg-white/[0.06]"
              />
            </label>
          ))}
          <div className="flex gap-2 sm:col-span-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => { void controller.saveSource(asset.id, draft).then((saved) => { if (saved) setEditing(false) }) }}
              className="flex items-center gap-1 rounded-xl bg-[var(--rc-accent)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-45"
            >
              {controller.activeAssetId === asset.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}保存来源
            </button>
            <button type="button" onClick={() => setEditing(false)} className="flex items-center gap-1 px-2 py-1.5 text-xs text-ink-tertiary">
              <X className="h-3.5 w-3.5" />取消
            </button>
          </div>
        </div>
      ) : null}

      {confirmingDelete ? (
        <div role="alert" className="mt-4 flex flex-col gap-3 rounded-xl bg-red-500/[0.08] p-3 text-xs text-ink-secondary sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-apple-red" />将删除受管本地文件及其来源记录，无法撤销。</span>
          <div className="flex shrink-0 gap-2">
            <button type="button" onClick={() => setConfirmingDelete(false)} className="rounded-lg px-2.5 py-1.5 text-ink-tertiary">取消</button>
            <button
              type="button"
              disabled={busy}
              onClick={() => { void controller.deleteAsset(asset.id).then((deleted) => { if (!deleted) setConfirmingDelete(false) }) }}
              className="rounded-lg bg-red-600 px-2.5 py-1.5 font-medium text-white disabled:opacity-45"
            >确认删除</button>
          </div>
        </div>
      ) : null}
    </article>
  )
}

export function AssistantImageAssetsPanel({ controller }: AssistantImageAssetsPanelProps) {
  return (
    <section className="space-y-3" aria-label="已保存图片">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-ink-primary">已保存图片</h2>
            <span className="rounded-full bg-black/[0.05] px-2 py-0.5 text-[11px] text-ink-tertiary dark:bg-white/[0.07]">{controller.assets.length}</span>
          </div>
          <p className="mt-1 text-xs text-ink-tertiary">管理助手确认保存的图片、来源和本地文件；图片内容不会在列表加载时读入前端。</p>
        </div>
        <button
          type="button"
          aria-label="刷新已保存图片"
          disabled={controller.loading}
          onClick={() => { void controller.reload() }}
          className="rounded-xl border border-black/10 p-2 text-ink-secondary transition hover:bg-black/[0.04] disabled:opacity-45 dark:border-white/10 dark:hover:bg-white/[0.06]"
        >
          <RefreshCw className={`h-4 w-4 ${controller.loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {controller.error ? <div role="alert" className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">{controller.error}</div> : null}
      {controller.notice ? <div role="status" className="rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">{controller.notice}</div> : null}
      {controller.loading && controller.assets.length === 0 ? (
        <div className="flex items-center gap-2 py-8 text-sm text-ink-tertiary"><Loader2 className="h-4 w-4 animate-spin" />正在读取图片资产…</div>
      ) : controller.assets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/10 px-4 py-7 text-center text-xs text-ink-tertiary dark:border-white/10">尚未保存图片资产。</div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {controller.assets.map((asset) => <AssetCard key={asset.id} asset={asset} controller={controller} />)}
        </div>
      )}
    </section>
  )
}
