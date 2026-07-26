/**
 * 结果卡片组件
 * 显示动作执行结果，支持复制和保存
 */
import { useState } from 'react'
import { Copy, Download, ExternalLink, Check, RotateCcw } from 'lucide-react'
import { Card, CardHeader, CardTitle, IconButton, Badge, Button } from '@research-copilot/ui'
import type { ActionResult } from '../shared'
import { ASSISTANT_WINDOW_CARD_STYLE } from '../shared'

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
    <Card className="w-full overflow-hidden" padding="none" style={ASSISTANT_WINDOW_CARD_STYLE}>
      {/* 标题栏 */}
      <CardHeader
        data-tauri-drag-region
        className="cursor-grab px-4 py-3 active:cursor-grabbing"
        style={{ borderBottom: '1px solid var(--rc-border)' }}
      >
        <CardTitle data-tauri-drag-region className="text-sm">结果</CardTitle>
        <div data-tauri-drag-region>
          <Badge variant="success">完成</Badge>
        </div>
      </CardHeader>

      {/* 内容区域 */}
      <div className="p-4">
        {/* 结果内容 */}
        <Card variant="inset" padding="sm" className="mb-4" style={{ minHeight: 100 }}>
          <div className="prose prose-sm max-w-none text-sm" style={{ color: 'var(--rc-text)' }}>
            {result.content}
          </div>
        </Card>

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
          <Button variant="secondary" size="sm" onClick={handleCopy} className="flex-1">
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
          </Button>
          <Button variant="secondary" size="sm" onClick={onImport} className="flex-1">
            <Download size={14} />
            导入
          </Button>
          {onExpand && (
            <IconButton size="sm" onClick={onExpand}>
              <ExternalLink size={14} />
            </IconButton>
          )}
          {onRetry && (
            <IconButton size="sm" onClick={onRetry}>
              <RotateCcw size={14} />
            </IconButton>
          )}
        </div>
      </div>
    </Card>
  )
}
