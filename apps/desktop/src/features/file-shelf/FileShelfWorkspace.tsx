import { Button, Card, IconButton } from '@research-copilot/ui'
import {
  Archive,
  Check,
  ClipboardPaste,
  Code2,
  Copy,
  File,
  FileImage,
  FileText,
  Folder,
  FolderOpen,
  Inbox,
  Loader2,
  MousePointer2,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import type { UseFileShelf } from './useFileShelf'
import {
  FILE_SHELF_SOURCE_LABELS,
  fileShelfVisualKind,
  formatShelfBytes,
  formatShelfDate,
  type FileShelfItem,
  type FileShelfVisualKind,
} from './shared'

interface FileShelfWorkspaceProps {
  controller: UseFileShelf
  secondaryContent?: ReactNode
}

const KIND_ICONS: Record<FileShelfVisualKind, typeof File> = {
  folder: Folder,
  image: FileImage,
  pdf: FileText,
  document: FileText,
  archive: Archive,
  code: Code2,
  file: File,
}

function ShelfRow({ item, selected, disabled, onToggle, onReveal }: {
  item: FileShelfItem
  selected: boolean
  disabled: boolean
  onToggle: () => void
  onReveal: () => void
}) {
  const Icon = KIND_ICONS[fileShelfVisualKind(item)]
  return (
    <article
      className="group relative flex min-w-0 cursor-default items-center gap-3 px-3 py-3 transition-colors"
      style={{
        background: selected ? 'var(--rc-info-chip-bg)' : 'transparent',
        borderBottom: '1px solid var(--rc-border)',
        opacity: item.available ? 1 : 0.58,
      }}
      onClick={onToggle}
      onDoubleClick={onReveal}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={selected}
        aria-label={`${selected ? '取消选择' : '选择'} ${item.file_name}`}
        disabled={disabled}
        onClick={(event) => { event.stopPropagation(); onToggle() }}
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors"
        style={{
          borderColor: selected ? 'var(--rc-accent)' : 'var(--rc-border)',
          background: selected ? 'var(--rc-accent)' : 'var(--rc-control-bg)',
          color: 'white',
        }}
      >
        {selected ? <Check className="h-3.5 w-3.5" strokeWidth={2.6} /> : null}
      </button>
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style={{ background: 'var(--rc-chip-inset-bg)', color: 'var(--rc-accent)' }}
      >
        <Icon className="h-[18px] w-[18px]" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="truncate text-sm font-medium text-ink-primary" title={item.file_name}>{item.file_name}</h3>
          {!item.available ? <span className="shrink-0 text-[11px] text-apple-red">副本丢失</span> : null}
        </div>
        <p className="mt-0.5 truncate text-xs text-ink-tertiary">
          {formatShelfBytes(item.size_bytes, item.is_directory)} · {FILE_SHELF_SOURCE_LABELS[item.source_type]} · {formatShelfDate(item.created_at)}
        </p>
      </div>
      <button
        type="button"
        aria-label={`在 Finder 中显示 ${item.file_name}`}
        disabled={disabled || !item.available}
        onClick={(event) => { event.stopPropagation(); onReveal() }}
        className="shrink-0 rounded-xl p-2 text-ink-tertiary opacity-0 transition hover:bg-black/[0.04] hover:text-ink-primary focus:opacity-100 disabled:cursor-not-allowed group-hover:opacity-100"
      >
        <FolderOpen className="h-4 w-4" />
      </button>
    </article>
  )
}

export function FileShelfWorkspace({ controller, secondaryContent }: FileShelfWorkspaceProps) {
  const [confirmRemove, setConfirmRemove] = useState(false)
  const busy = controller.action !== null
  const selectedCount = controller.selectedIds.size

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const editing = target?.matches('input, textarea, [contenteditable="true"]')
      if (editing) return
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a' && controller.items.length > 0) {
        event.preventDefault()
        controller.selectAll()
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'c' && selectedCount > 0) {
        event.preventDefault()
        void controller.copySelected()
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'v') {
        event.preventDefault()
        void controller.stashClipboard()
      }
      if (event.key === 'Escape') {
        setConfirmRemove(false)
        controller.clearSelection()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [controller, selectedCount])

  return (
    <div className="rc-app-page relative h-full overflow-y-auto">
      {controller.dragActive ? (
        <div
          className="pointer-events-none fixed inset-5 z-50 flex items-center justify-center rounded-[28px] border-2 border-dashed"
          style={{ borderColor: 'var(--rc-accent)', background: 'color-mix(in srgb, var(--rc-bg) 90%, var(--rc-accent) 10%)' }}
        >
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--rc-accent)] text-white shadow-lg">
              <Inbox className="h-6 w-6" />
            </div>
            <div>
              <p className="text-base font-semibold text-ink-primary">松手，交给小妍保管</p>
              <p className="mt-1 text-xs text-ink-tertiary">会保存独立副本，不移动原文件</p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mx-auto max-w-5xl space-y-8 pb-12">
        <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-xl">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl" style={{ background: 'var(--rc-info-chip-bg)', color: 'var(--rc-accent)' }}>
                <Inbox className="h-[18px] w-[18px]" />
              </div>
              <div>
                <h1 className="text-xl font-semibold tracking-tight text-ink-primary">文件中转站</h1>
                <p className="mt-0.5 text-xs text-ink-tertiary">{controller.items.length} 项正在候车</p>
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-ink-secondary">
              把文件拖到桌面小妍，或复制后在这里粘贴。需要时多选复制，再到任意位置按 ⌘V。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" disabled={busy} onClick={() => { void controller.chooseFiles() }}>
              <Plus className="h-4 w-4" />添加文件
            </Button>
            <Button size="sm" loading={controller.action === 'stashing'} disabled={busy && controller.action !== 'stashing'} onClick={() => { void controller.stashClipboard() }}>
              <ClipboardPaste className="h-4 w-4" />粘贴剪贴板
            </Button>
            <IconButton size="sm" aria-label="刷新文件中转站" disabled={busy} onClick={() => { void controller.reload() }}>
              <RefreshCw className={`h-4 w-4 ${controller.loading ? 'animate-spin' : ''}`} />
            </IconButton>
          </div>
        </header>

        {controller.error ? (
          <div role="alert" className="flex items-start justify-between gap-3 rounded-2xl px-4 py-3 text-sm" style={{ background: 'var(--rc-badge-danger-bg)', color: 'var(--rc-badge-danger-text)' }}>
            <span>{controller.error}</span>
          </div>
        ) : null}
        {controller.notice ? (
          <div role="status" className="rounded-2xl px-4 py-3 text-sm" style={{ background: 'var(--rc-badge-success-bg)', color: 'var(--rc-badge-success-text)' }}>
            {controller.notice}
          </div>
        ) : null}

        <Card padding="none" className="overflow-hidden" aria-label="暂存文件">
          <div className="flex min-h-14 items-center justify-between gap-3 px-4 py-3" style={{ borderBottom: controller.items.length ? '1px solid var(--rc-border)' : undefined }}>
            <div className="flex min-w-0 items-center gap-3">
              <button type="button" disabled={controller.items.length === 0 || busy} onClick={controller.selectAll} className="text-xs font-medium text-ink-secondary transition hover:text-ink-primary disabled:opacity-40">
                {selectedCount === controller.items.length && controller.items.length > 0 ? '取消全选' : '全选'}
              </button>
              <span className="text-xs text-ink-tertiary">{selectedCount ? `已选 ${selectedCount} 项` : '点击项目即可多选'}</span>
            </div>
            {selectedCount > 0 ? (
              <div className="flex items-center gap-1.5">
                <Button size="sm" loading={controller.action === 'copying'} disabled={busy && controller.action !== 'copying'} onClick={() => { void controller.copySelected() }}>
                  <Copy className="h-3.5 w-3.5" />复制所选
                </Button>
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => setConfirmRemove(true)}>
                  <Trash2 className="h-3.5 w-3.5" />移除
                </Button>
              </div>
            ) : null}
          </div>

          {controller.loading && controller.items.length === 0 ? (
            <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-ink-tertiary">
              <Loader2 className="h-4 w-4 animate-spin" />正在整理中转站…
            </div>
          ) : controller.items.length === 0 ? (
            <div className="grid min-h-72 place-items-center px-6 py-10 text-center">
              <div>
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px]" style={{ background: 'var(--rc-card-inset-bg)', boxShadow: 'var(--rc-card-inset-shadow)' }}>
                  <MousePointer2 className="h-6 w-6 text-[var(--rc-accent)]" />
                </div>
                <p className="mt-5 text-sm font-semibold text-ink-primary">把文件先放这里，不必急着决定去处</p>
                <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-ink-tertiary">拖到桌面小妍会直接暂存；也可以先在 Finder 复制，再右键小妍或点击“粘贴剪贴板”。</p>
              </div>
            </div>
          ) : (
            <div>
              {controller.items.map((item) => (
                <ShelfRow
                  key={item.id}
                  item={item}
                  selected={controller.selectedIds.has(item.id)}
                  disabled={busy}
                  onToggle={() => controller.toggleSelected(item.id)}
                  onReveal={() => { void controller.reveal(item.id) }}
                />
              ))}
            </div>
          )}
        </Card>

        <div className="flex items-start gap-3 px-1 text-xs leading-5 text-ink-tertiary">
          <Copy className="mt-0.5 h-4 w-4 shrink-0" />
          <p>中转站保存的是独立本地副本。移除只会删除副本，不会动原文件；复制粘贴后，项目会继续保留，方便重复使用。</p>
        </div>

        {secondaryContent ? <div className="space-y-5 border-t pt-8" style={{ borderColor: 'var(--rc-border)' }}>{secondaryContent}</div> : null}
      </div>

      {confirmRemove ? (
        <div className="fixed inset-0 z-50 grid place-items-center px-5" style={{ background: 'var(--rc-modal-backdrop)' }}>
          <Card className="w-full max-w-sm" aria-modal="true" role="dialog" aria-labelledby="file-shelf-remove-title">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="file-shelf-remove-title" className="text-base font-semibold text-ink-primary">移除 {selectedCount} 个中转副本？</h2>
                <p className="mt-2 text-xs leading-5 text-ink-tertiary">原文件不会受影响，中转站里的副本将被永久删除。</p>
              </div>
              <IconButton size="sm" aria-label="取消移除" onClick={() => setConfirmRemove(false)}><X className="h-4 w-4" /></IconButton>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setConfirmRemove(false)}>取消</Button>
              <Button variant="danger" size="sm" loading={controller.action === 'removing'} onClick={() => {
                void controller.removeSelected().then((removed) => { if (removed) setConfirmRemove(false) })
              }}>确认移除</Button>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  )
}
