import {
  Clock3,
  FileImage,
  FileText,
  Inbox,
  Loader2,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import type { ReactNode } from 'react'
import type { UseAssistantInbox } from '../hooks/useAssistantInbox'

interface AssistantInboxWorkspaceProps {
  controller: UseAssistantInbox
  assetsPanel?: ReactNode
  embedded?: boolean
}

function formatBytes(bytes: number | null) {
  if (bytes == null) return '大小未知'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatDate(value: string | null) {
  if (!value) return null
  const date = new Date(value.endsWith('Z') || value.includes('+') ? value : `${value}Z`)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function ActionButton({
  children,
  disabled,
  onClick,
  secondary = false,
}: {
  children: ReactNode
  disabled?: boolean
  onClick: () => void
  secondary?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-xl px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-45 ${secondary
        ? 'border border-black/10 text-ink-secondary hover:bg-black/[0.04] dark:border-white/10 dark:hover:bg-white/[0.06]'
        : 'bg-[var(--rc-accent)] text-white hover:brightness-105'
      }`}
    >
      {children}
    </button>
  )
}

function Section({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <section className="space-y-3" aria-label={title}>
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-ink-primary">{title}</h2>
        <span className="rounded-full bg-black/[0.05] px-2 py-0.5 text-[11px] text-ink-tertiary dark:bg-white/[0.07]">{count}</span>
      </div>
      {children}
    </section>
  )
}

function Card({ icon, title, meta, children, actions }: {
  icon: ReactNode
  title: string
  meta: ReactNode
  children?: ReactNode
  actions: ReactNode
}) {
  return (
    <article className="rounded-2xl border border-black/[0.07] bg-white/70 p-4 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.035]">
      <div className="flex min-w-0 items-start gap-3">
        <div className="mt-0.5 rounded-xl bg-black/[0.04] p-2 text-ink-secondary dark:bg-white/[0.07]">{icon}</div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-medium text-ink-primary" title={title}>{title}</h3>
          <div className="mt-1 text-xs text-ink-tertiary">{meta}</div>
          {children}
        </div>
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      </div>
    </article>
  )
}

export function AssistantInboxWorkspace({ controller, assetsPanel, embedded = false }: AssistantInboxWorkspaceProps) {
  const {
    overview,
    themes,
    selectedThemeId,
    loading,
    activeItemId,
    error,
    notice,
    setSelectedThemeId,
    reload,
    convertLater,
    importPaper,
    importFile,
    discard,
  } = controller
  const total = overview.later_items.length
    + overview.paper_candidates.length
    + overview.file_candidates.length

  return (
    <div className={embedded ? '' : 'rc-app-page h-full overflow-y-auto'}>
      <div className={embedded ? 'space-y-7' : 'mx-auto max-w-5xl space-y-7 pb-10'}>
        {!embedded ? <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Inbox className="h-5 w-5 text-[var(--rc-accent)]" />
              <h1 className="text-xl font-semibold tracking-tight text-ink-primary">收集箱</h1>
            </div>
            <p className="mt-1 text-sm text-ink-tertiary">整理小妍桌面助手暂存内容与已确认的拖入文件。</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-ink-tertiary" htmlFor="assistant-inbox-theme">归入主题</label>
            <select
              id="assistant-inbox-theme"
              value={selectedThemeId}
              onChange={(event) => setSelectedThemeId(event.target.value)}
              className="min-w-44 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-ink-primary dark:border-white/10 dark:bg-white/[0.06]"
            >
              <option value="">不指定（保留已有主题）</option>
              {themes.map((theme) => <option key={theme.id} value={theme.id}>{theme.name}</option>)}
            </select>
            <button
              type="button"
              aria-label="刷新收集箱"
              onClick={() => { void reload() }}
              disabled={loading}
              className="rounded-xl border border-black/10 p-2 text-ink-secondary transition hover:bg-black/[0.04] disabled:opacity-45 dark:border-white/10 dark:hover:bg-white/[0.06]"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </header> : (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-ink-primary">研究收集与归档</h2>
              <p className="mt-1 text-xs text-ink-tertiary">把中转内容进一步转为论文、笔记或长期图片资产。</p>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-ink-tertiary" htmlFor="assistant-inbox-theme">归入主题</label>
              <select
                id="assistant-inbox-theme"
                value={selectedThemeId}
                onChange={(event) => setSelectedThemeId(event.target.value)}
                className="rc-dropdown-trigger min-w-44 rounded-xl border px-3 py-2 text-sm text-ink-primary"
              >
                <option value="">不指定（保留已有主题）</option>
                {themes.map((theme) => <option key={theme.id} value={theme.id}>{theme.name}</option>)}
              </select>
              <button
                type="button"
                aria-label="刷新研究收集"
                onClick={() => { void reload() }}
                disabled={loading}
                className="rc-icon-button h-9 w-9"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        )}

        {error ? <div role="alert" className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">{error}</div> : null}
        {notice ? <div role="status" className="rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">{notice}</div> : null}

        {loading && total === 0 ? (
          <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-ink-tertiary">
            <Loader2 className="h-4 w-4 animate-spin" />正在加载收集箱…
          </div>
        ) : total === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center rounded-3xl border border-dashed border-black/10 text-center dark:border-white/10">
            <Inbox className="mb-3 h-9 w-9 text-ink-tertiary" />
            <p className="text-sm font-medium text-ink-secondary">{embedded ? '暂无待归档内容' : '收集箱已经清空'}</p>
            <p className="mt-1 text-xs text-ink-tertiary">{embedded ? '需要长期保存时，再把中转文件转入论文库或知识库。' : '从小妍桌面助手选择“稍后处理”，或拖入文件即可在这里继续。'}</p>
          </div>
        ) : (
          <div className="space-y-8">
            <Section title="稍后处理" count={overview.later_items.length}>
              {overview.later_items.map((item) => (
                <Card
                  key={item.id}
                  icon={<Clock3 className="h-4 w-4" />}
                  title={item.title}
                  meta={[
                    item.source_app,
                    item.window_title,
                    item.research_theme_name,
                    item.expires_at ? `到期 ${formatDate(item.expires_at)}` : null,
                  ].filter(Boolean).join(' · ') || `创建于 ${formatDate(item.created_at)}`}
                  actions={<>
                    <ActionButton disabled={activeItemId !== null} onClick={() => { void convertLater(item.id) }}>转为笔记</ActionButton>
                    <ActionButton secondary disabled={activeItemId !== null} onClick={() => { void discard('later', item.id) }}><span className="sr-only">移除稍后处理项</span><Trash2 className="h-3.5 w-3.5" /></ActionButton>
                  </>}
                >
                  <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-xs leading-5 text-ink-secondary">{item.content_preview}</p>
                </Card>
              ))}
            </Section>

            <Section title="论文候选" count={overview.paper_candidates.length}>
              {overview.paper_candidates.map((item) => (
                <Card
                  key={item.id}
                  icon={<FileText className="h-4 w-4" />}
                  title={item.title}
                  meta={item.has_source_file
                    ? `${item.file_name ?? 'PDF'} · ${formatBytes(item.file_size_bytes)}`
                    : '尚未关联 PDF，可先保留候选或移除'}
                  actions={<>
                    <ActionButton disabled={activeItemId !== null || !item.has_source_file} onClick={() => { void importPaper(item.id) }}>导入论文库</ActionButton>
                    <ActionButton secondary disabled={activeItemId !== null} onClick={() => { void discard('paper', item.id) }}><span className="sr-only">移除论文候选</span><Trash2 className="h-3.5 w-3.5" /></ActionButton>
                  </>}
                />
              ))}
            </Section>

            <Section title="文件候选" count={overview.file_candidates.length}>
              {overview.file_candidates.map((item) => {
                const target = item.recommended_target === 'image' ? 'image' : 'note'
                return (
                  <Card
                    key={item.id}
                    icon={target === 'image' ? <FileImage className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                    title={item.file_name}
                    meta={`${item.media_type} · ${formatBytes(item.size_bytes)} · 到期 ${formatDate(item.expires_at)}`}
                    actions={<>
                      <ActionButton disabled={activeItemId !== null} onClick={() => { void importFile(item.id, target) }}>{target === 'image' ? '保存图片' : '转为笔记'}</ActionButton>
                      <ActionButton secondary disabled={activeItemId !== null} onClick={() => { void discard('file', item.id) }}><span className="sr-only">移除文件候选</span><Trash2 className="h-3.5 w-3.5" /></ActionButton>
                    </>}
                  />
                )
              })}
            </Section>
          </div>
        )}

        {assetsPanel}
      </div>
    </div>
  )
}
