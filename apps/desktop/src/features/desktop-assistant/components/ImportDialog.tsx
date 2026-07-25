/**
 * 导入确认对话框
 * 选择导入目标和配置
 */
import { X } from 'lucide-react'
import type { ImportTarget, ImportConfig } from '../shared'

interface ImportDialogProps {
  content: string
  onConfirm: (config: ImportConfig) => void
  onCancel: () => void
}

const IMPORT_TARGETS: { id: ImportTarget; label: string; description: string }[] = [
  { id: 'note', label: '知识笔记', description: '保存为可编辑的笔记' },
  { id: 'image', label: '图片资产', description: '保存截图到本地' },
  { id: 'paper', label: '论文导入', description: '添加到论文库' },
  { id: 'later', label: '稍后处理', description: '放入待处理箱' },
]

export function ImportDialog({ content, onConfirm, onCancel }: ImportDialogProps) {
  const handleConfirm = (target: ImportTarget) => {
    onConfirm({
      target,
      preserveOriginal: false,
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'var(--rc-modal-backdrop)' }}
      onClick={onCancel}
    >
      <div
        className="rc-focus-card w-full max-w-sm rounded-2xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--rc-text)' }}>
            导入内容
          </h3>
          <button
            onClick={onCancel}
            className="rc-icon-button"
            style={{ width: 24, height: 24 }}
          >
            <X size={12} />
          </button>
        </div>

        <div className="rc-focus-card-inset mb-4 rounded-xl p-3">
          <p className="line-clamp-3 text-xs" style={{ color: 'var(--rc-text-muted)' }}>
            {content}
          </p>
        </div>

        <div className="space-y-2">
          {IMPORT_TARGETS.map((target) => (
            <button
              key={target.id}
              onClick={() => handleConfirm(target.id)}
              className="w-full rounded-xl p-3 text-left transition-colors"
              style={{
                background: 'var(--rc-control-bg)',
                border: '1px solid var(--rc-control-border)',
              }}
            >
              <div className="text-sm font-medium" style={{ color: 'var(--rc-text)' }}>
                {target.label}
              </div>
              <div className="text-xs" style={{ color: 'var(--rc-text-muted)' }}>
                {target.description}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
