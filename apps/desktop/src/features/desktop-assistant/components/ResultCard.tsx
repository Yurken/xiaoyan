/**
 * 结果卡片组件
 * 显示动作执行结果，支持复制和保存
 */
import { Copy, Download, ExternalLink } from 'lucide-react'
import type { ActionResult } from '../shared'

interface ResultCardProps {
  result: ActionResult
  onCopy: (content: string) => void
  onImport: () => void
  onExpand?: () => void
}

export function ResultCard({ result, onCopy, onImport, onExpand }: ResultCardProps) {
  return (
    <div className="rc-focus-card-inset rounded-xl p-4">
      <div className="mb-3 text-sm" style={{ color: 'var(--rc-text)' }}>
        {result.content}
      </div>

      {result.metadata?.sources && result.metadata.sources.length > 0 && (
        <div className="mb-3 text-xs" style={{ color: 'var(--rc-text-muted)' }}>
          引用：{result.metadata.sources.join(', ')}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => onCopy(result.content)}
          className="rc-focus-btn-secondary flex items-center gap-1 text-xs"
        >
          <Copy size={12} />
          复制
        </button>
        <button
          onClick={onImport}
          className="rc-focus-btn-secondary flex items-center gap-1 text-xs"
        >
          <Download size={12} />
          导入
        </button>
        {onExpand && (
          <button
            onClick={onExpand}
            className="rc-focus-btn-secondary flex items-center gap-1 text-xs"
          >
            <ExternalLink size={12} />
            展开
          </button>
        )}
      </div>
    </div>
  )
}
