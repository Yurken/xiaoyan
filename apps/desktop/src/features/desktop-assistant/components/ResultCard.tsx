/**
 * 结果卡片组件
 * 显示动作执行结果，支持复制和保存
 */
import { useState } from 'react'
import { Copy, Download, ExternalLink, Check, RotateCcw } from 'lucide-react'
import type { ActionResult } from '../shared'

interface ResultCardProps {
  result: ActionResult
  onCopy: (content: string) => void
  onImport: () => void
  onExpand?: () => void
  onRetry?: () => void
}

export function ResultCard({ result, onCopy, onImport, onExpand, onRetry }: ResultCardProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    onCopy(result.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className="rc-focus-card overflow-hidden"
      style={{ width: 380, maxHeight: 520 }}
    >
      {/* 标题栏 */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid var(--rc-border)' }}
      >
        <h3 className="text-sm font-semibold" style={{ color: 'var(--rc-text)' }}>
          结果
        </h3>
        <span
          className="rounded-full px-2 py-0.5 text-xs"
          style={{
            background: 'var(--rc-badge-success-bg)',
            color: 'var(--rc-badge-success-text)',
          }}
        >
          完成
        </span>
      </div>

      {/* 内容区域 */}
      <div className="p-4">
        {/* 结果内容 */}
        <div
          className="mb-4 rounded-xl p-3"
          style={{ background: 'var(--rc-card-inset-bg)', minHeight: 100 }}
        >
          <div className="prose prose-sm max-w-none text-sm" style={{ color: 'var(--rc-text)' }}>
            {result.content}
          </div>
        </div>

        {/* 元数据 */}
        {result.metadata?.sources && result.metadata.sources.length > 0 && (
          <div className="mb-3 text-xs" style={{ color: 'var(--rc-text-muted)' }}>
            引用：{result.metadata.sources.join(', ')}
          </div>
        )}

        {result.metadata?.duration && (
          <div className="mb-3 text-xs" style={{ color: 'var(--rc-text-muted)' }}>
            耗时：{(result.metadata.duration / 1000).toFixed(1)}s
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            className="rc-focus-btn-secondary flex flex-1 items-center justify-center gap-2 text-sm"
          >
            {copied ? (
              <>
                <Check size={14} />
                已复制
              </>
            ) : (
              <>
                <Copy size={14} />
                复制
              </>
            )}
          </button>
          <button
            onClick={onImport}
            className="rc-focus-btn-secondary flex flex-1 items-center justify-center gap-2 text-sm"
          >
            <Download size={14} />
            导入
          </button>
          {onExpand && (
            <button
              onClick={onExpand}
              className="rc-focus-btn-secondary flex items-center justify-center gap-2 text-sm"
              style={{ padding: '0 12px' }}
            >
              <ExternalLink size={14} />
            </button>
          )}
          {onRetry && (
            <button
              onClick={onRetry}
              className="rc-focus-btn-secondary flex items-center justify-center gap-2 text-sm"
              style={{ padding: '0 12px' }}
            >
              <RotateCcw size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
