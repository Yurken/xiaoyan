import { useMemo, useState } from 'react'
import { Clock3, FileText, Image, Inbox, Tag, X } from 'lucide-react'
import { Button, Card, CardHeader, CardTitle, IconButton, Input } from '@research-copilot/ui'
import type {
  AssistantKnowledgeTheme,
  ImportConfig,
  ImportRetentionPolicy,
  ImportTarget,
} from '../shared'
import { limitAssistantContent, truncateText } from '../shared'
import {
  estimateImportBytes,
  formatImportBytes,
  importStorageLabel,
} from '../importShared'

interface ImportDialogProps {
  content: string
  originalContent?: string
  sourceLabel?: string
  themes: AssistantKnowledgeTheme[]
  defaultResearchThemeId?: string
  defaultRetentionPolicy: Exclude<ImportRetentionPolicy, 'permanent'>
  saving?: boolean
  error?: string | null
  onConfirm: (config: ImportConfig) => void
  onCancel: () => void
}

const IMPORT_TARGETS: Array<{
  id: ImportTarget
  label: string
  description: string
  icon: typeof FileText
}> = [
  { id: 'note', label: '知识笔记', description: '长期保存并可继续编辑', icon: FileText },
  { id: 'image', label: '图片资产', description: '将原始截图保存到本地', icon: Image },
  { id: 'later', label: '稍后处理', description: '按所选期限保留', icon: Inbox },
]

const RETENTION_OPTIONS: Array<{
  value: Exclude<ImportRetentionPolicy, 'permanent'>
  label: string
}> = [
  { value: '1_day', label: '1 天后自动清理' },
  { value: '7_days', label: '7 天后自动清理' },
  { value: '30_days', label: '30 天后自动清理' },
  { value: 'manual', label: '仅手动清理' },
]

export function ImportDialog({
  content,
  originalContent,
  sourceLabel = '已确认捕获内容',
  themes,
  defaultResearchThemeId,
  defaultRetentionPolicy,
  saving = false,
  error,
  onConfirm,
  onCancel,
}: ImportDialogProps) {
  const primaryIsImage = content.startsWith('data:image/')
  const originalIsImage = Boolean(originalContent?.startsWith('data:image/'))
  const [selectedTarget, setSelectedTarget] = useState<ImportTarget>(
    primaryIsImage ? 'image' : 'note',
  )
  const [title, setTitle] = useState('')
  const [tags, setTags] = useState('')
  const [researchThemeId, setResearchThemeId] = useState(defaultResearchThemeId ?? '')
  const [preserveOriginal, setPreserveOriginal] = useState(false)
  const [retentionPolicy, setRetentionPolicy] = useState(defaultRetentionPolicy)
  const availableTargets = useMemo(() => IMPORT_TARGETS.filter((target) => {
    if (primaryIsImage) return target.id === 'image'
    if (target.id === 'image') return originalIsImage
    return true
  }), [originalIsImage, primaryIsImage])
  const hasSeparateOriginal = Boolean(originalContent && originalContent !== content)
  const canPreserveSeparateOriginal = hasSeparateOriginal
  const originalIsPrimary = Boolean(originalContent && originalContent === content)
  const effectivePreserveOriginal = selectedTarget === 'image'
    || originalIsPrimary
    || (canPreserveSeparateOriginal && preserveOriginal)
  const effectiveRetentionPolicy: ImportRetentionPolicy = selectedTarget === 'later'
    ? retentionPolicy
    : 'permanent'
  const estimatedBytes = estimateImportBytes(content, originalContent, {
    target: selectedTarget,
    preserveOriginal: effectivePreserveOriginal,
  })
  const storageLabel = selectedTarget === 'note' && originalIsImage && effectivePreserveOriginal
    ? '小妍本地数据库 + 本地应用数据 / assistant_note_attachments'
    : importStorageLabel(selectedTarget)
  const limitedContent = limitAssistantContent('import', content)

  const handleConfirm = () => {
    onConfirm({
      target: selectedTarget,
      title: title.trim() || undefined,
      tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      researchThemeId: researchThemeId || undefined,
      preserveOriginal: effectivePreserveOriginal,
      retentionPolicy: effectiveRetentionPolicy,
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'var(--rc-modal-backdrop)' }}
      onClick={onCancel}
    >
      <Card
        className="max-h-[min(580px,calc(100vh-24px))] w-full max-w-sm overflow-y-auto"
        padding="none"
        onClick={(event) => event.stopPropagation()}
      >
        <CardHeader className="sticky top-0 z-10 px-5 py-4" style={{ borderBottom: '1px solid var(--rc-border)' }}>
          <CardTitle className="text-sm">确认导入</CardTitle>
          <IconButton size="sm" onClick={onCancel} disabled={saving} aria-label="取消导入">
            <X size={14} />
          </IconButton>
        </CardHeader>

        <div className="space-y-4 px-5 py-4">
          <Card variant="inset" padding="sm">
            <p className="line-clamp-3 text-xs" style={{ color: 'var(--rc-text-muted)' }}>
              {primaryIsImage ? '原始截图' : truncateText(content, 200)}
            </p>
            {limitedContent.truncated && !primaryIsImage && (
              <p role="status" className="mt-2 text-xs leading-5" style={{ color: 'var(--rc-badge-warning-text)' }}>
                内容共 {limitedContent.originalCharacters.toLocaleString('zh-CN')} 字符，将保存前{' '}
                {limitedContent.processedCharacters.toLocaleString('zh-CN')} 字符。
              </p>
            )}
          </Card>

          <section aria-labelledby="assistant-import-target-label">
            <div id="assistant-import-target-label" className="mb-2 text-xs font-medium" style={{ color: 'var(--rc-text-muted)' }}>
              目的地
            </div>
            <div className={`grid gap-2 ${availableTargets.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {availableTargets.map((target) => {
                const Icon = target.icon
                const selected = selectedTarget === target.id
                return (
                  <button
                    key={target.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setSelectedTarget(target.id)}
                    className="rounded-xl p-3 text-left transition-colors"
                    style={{
                      background: selected ? 'var(--rc-info-chip-bg)' : 'var(--rc-control-bg)',
                      border: `1px solid ${selected ? 'var(--rc-info-chip-border)' : 'var(--rc-control-border)'}`,
                    }}
                  >
                    <Icon size={16} className="mb-1" style={{ color: selected ? 'var(--rc-info-chip-text)' : 'var(--rc-text-muted)' }} />
                    <div className="text-sm font-medium" style={{ color: selected ? 'var(--rc-info-chip-text)' : 'var(--rc-text)' }}>
                      {target.label}
                    </div>
                    <div className="text-[10px]" style={{ color: 'var(--rc-text-muted)' }}>
                      {target.description}
                    </div>
                  </button>
                )
              })}
            </div>
          </section>

          <Input
            label="标题（可选）"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="自定义标题…"
          />

          {selectedTarget === 'note' && (
            <label className="block text-xs" style={{ color: 'var(--rc-text-muted)' }}>
              <span className="mb-1 flex items-center gap-1"><Tag size={12} />标签（逗号分隔）</span>
              <input
                type="text"
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                placeholder="学术, 翻译, 重要…"
                className="w-full rounded-2xl border px-4 py-2.5 text-sm outline-none"
                style={{
                  background: 'var(--rc-control-bg)',
                  borderColor: 'var(--rc-control-border)',
                  color: 'var(--rc-text)',
                }}
              />
            </label>
          )}

          <label className="block text-xs" style={{ color: 'var(--rc-text-muted)' }}>
            <span className="mb-1 block">研究主题</span>
            <select
              aria-label="研究主题"
              value={researchThemeId}
              onChange={(event) => setResearchThemeId(event.target.value)}
              className="w-full rounded-2xl border px-3 py-2.5 text-sm outline-none"
              style={{
                background: 'var(--rc-control-bg)',
                borderColor: 'var(--rc-control-border)',
                color: 'var(--rc-text)',
              }}
            >
              <option value="">未归类（明确不关联主题）</option>
              {themes.map((theme) => (
                <option key={theme.id} value={theme.id}>{theme.name}</option>
              ))}
            </select>
          </label>

          {selectedTarget === 'later' ? (
            <label className="block text-xs" style={{ color: 'var(--rc-text-muted)' }}>
              <span className="mb-1 flex items-center gap-1"><Clock3 size={12} />保留时间</span>
              <select
                aria-label="保留时间"
                value={retentionPolicy}
                onChange={(event) => setRetentionPolicy(
                  event.target.value as Exclude<ImportRetentionPolicy, 'permanent'>,
                )}
                className="w-full rounded-2xl border px-3 py-2.5 text-sm outline-none"
                style={{
                  background: 'var(--rc-control-bg)',
                  borderColor: 'var(--rc-control-border)',
                  color: 'var(--rc-text)',
                }}
              >
                {RETENTION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          ) : (
            <p className="text-xs" style={{ color: 'var(--rc-text-muted)' }}>
              保留时间：长期保留，删除正式资产时清理。
            </p>
          )}

          <label className="flex items-start gap-2 text-xs" style={{ color: 'var(--rc-text-muted)' }}>
            <input
              type="checkbox"
              className="mt-0.5 rounded"
              checked={effectivePreserveOriginal}
              disabled={selectedTarget === 'image' || originalIsPrimary || !canPreserveSeparateOriginal}
              onChange={(event) => setPreserveOriginal(event.target.checked)}
            />
            <span>
              {selectedTarget === 'image'
                ? '保留原始截图（图片资产必须保留）'
                : originalIsPrimary
                  ? '当前导入内容本身即为原始内容'
                  : originalIsImage
                    ? '将原始截图作为笔记附件保留'
                    : '在生成结果后附加保留原始文本'}
              {hasSeparateOriginal && originalIsImage && selectedTarget === 'note' && (
                <span className="mt-0.5 block text-[10px]">
                  附件保存在小妍本地应用数据中，删除笔记时同步清理。
                </span>
              )}
            </span>
          </label>

          <section
            aria-label="导入存储确认"
            className="rounded-xl border px-3 py-2 text-xs"
            style={{ borderColor: 'var(--rc-border)', color: 'var(--rc-text-muted)' }}
          >
            <div>来源：{sourceLabel}</div>
            <div>存储位置：{storageLabel}</div>
            <div>预计占用：约 {formatImportBytes(estimatedBytes)}</div>
          </section>

          {error && <p role="alert" className="text-xs" style={{ color: 'var(--rc-badge-danger-text)' }}>{error}</p>}

          <Button variant="primary" size="sm" onClick={handleConfirm} disabled={saving} className="w-full">
            {saving ? '正在导入…' : '确认导入'}
          </Button>
        </div>
      </Card>
    </div>
  )
}
