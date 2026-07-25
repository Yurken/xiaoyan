/**
 * 导入确认对话框
 * 选择导入目标和配置
 */
import { useState } from 'react'
import { X, FileText, Image, BookOpen, Clock, Tag } from 'lucide-react'
import type { ImportTarget, ImportConfig } from '../shared'
import { truncateText } from '../shared'

interface ImportDialogProps {
  content: string
  onConfirm: (config: ImportConfig) => void
  onCancel: () => void
}

const IMPORT_TARGETS: { id: ImportTarget; label: string; description: string; icon: typeof FileText }[] = [
  { id: 'note', label: '知识笔记', description: '保存为可编辑的笔记', icon: FileText },
  { id: 'image', label: '图片资产', description: '保存截图到本地', icon: Image },
  { id: 'paper', label: '论文导入', description: '添加到论文库', icon: BookOpen },
  { id: 'later', label: '稍后处理', description: '放入待处理箱', icon: Clock },
]

export function ImportDialog({ content, onConfirm, onCancel }: ImportDialogProps) {
  const [selectedTarget, setSelectedTarget] = useState<ImportTarget>('note')
  const [title, setTitle] = useState('')
  const [tags, setTags] = useState('')
  const [preserveOriginal, setPreserveOriginal] = useState(false)

  const handleConfirm = () => {
    onConfirm({
      target: selectedTarget,
      title: title.trim() || undefined,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      preserveOriginal,
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'var(--rc-modal-backdrop)' }}
      onClick={onCancel}
    >
      <div
        className="rc-focus-card w-full max-w-sm overflow-hidden rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题栏 */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--rc-border)' }}
        >
          <h3 className="text-sm font-semibold" style={{ color: 'var(--rc-text)' }}>
            导入内容
          </h3>
          <button
            onClick={onCancel}
            className="rc-icon-button"
            style={{ width: 28, height: 28 }}
          >
            <X size={14} />
          </button>
        </div>

        {/* 内容预览 */}
        <div className="px-5 pt-4">
          <div
            className="mb-4 rounded-xl p-3"
            style={{ background: 'var(--rc-card-inset-bg)' }}
          >
            <p className="line-clamp-3 text-xs" style={{ color: 'var(--rc-text-muted)' }}>
              {truncateText(content, 200)}
            </p>
          </div>
        </div>

        {/* 导入目标选择 */}
        <div className="px-5">
          <div className="mb-3 text-xs font-medium" style={{ color: 'var(--rc-text-muted)' }}>
            选择目标
          </div>
          <div className="mb-4 grid grid-cols-2 gap-2">
            {IMPORT_TARGETS.map((target) => {
              const Icon = target.icon
              const isSelected = selectedTarget === target.id
              return (
                <button
                  key={target.id}
                  onClick={() => setSelectedTarget(target.id)}
                  className="rounded-xl p-3 text-left transition-colors"
                  style={{
                    background: isSelected ? 'var(--rc-info-chip-bg)' : 'var(--rc-control-bg)',
                    border: `1px solid ${isSelected ? 'var(--rc-info-chip-border)' : 'var(--rc-control-border)'}`,
                  }}
                >
                  <Icon
                    size={16}
                    style={{
                      color: isSelected ? 'var(--rc-info-chip-text)' : 'var(--rc-text-muted)',
                      marginBottom: 4,
                    }}
                  />
                  <div
                    className="text-sm font-medium"
                    style={{ color: isSelected ? 'var(--rc-info-chip-text)' : 'var(--rc-text)' }}
                  >
                    {target.label}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--rc-text-muted)' }}>
                    {target.description}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* 配置选项 */}
        <div className="px-5 pb-4">
          {/* 标题 */}
          <div className="mb-3">
            <label className="mb-1 block text-xs" style={{ color: 'var(--rc-text-muted)' }}>
              标题（可选）
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="自定义标题..."
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{
                background: 'var(--rc-control-bg)',
                border: '1px solid var(--rc-control-border)',
                color: 'var(--rc-text)',
              }}
            />
          </div>

          {/* 标签 */}
          {selectedTarget === 'note' && (
            <div className="mb-3">
              <label className="mb-1 flex items-center gap-1 text-xs" style={{ color: 'var(--rc-text-muted)' }}>
                <Tag size={12} />
                标签（逗号分隔）
              </label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="学术, 翻译, 重要..."
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={{
                  background: 'var(--rc-control-bg)',
                  border: '1px solid var(--rc-control-border)',
                  color: 'var(--rc-text)',
                }}
              />
            </div>
          )}

          {/* 保留原文 */}
          <div className="mb-4 flex items-center gap-2">
            <input
              type="checkbox"
              id="preserve-original"
              checked={preserveOriginal}
              onChange={(e) => setPreserveOriginal(e.target.checked)}
              className="rounded"
            />
            <label
              htmlFor="preserve-original"
              className="text-xs"
              style={{ color: 'var(--rc-text-muted)' }}
            >
              保留原始内容
            </label>
          </div>

          {/* 确认按钮 */}
          <button
            onClick={handleConfirm}
            className="rc-focus-cta w-full text-sm"
          >
            确认导入
          </button>
        </div>
      </div>
    </div>
  )
}
