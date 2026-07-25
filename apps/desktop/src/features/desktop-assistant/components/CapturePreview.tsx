/**
 * 采集预览组件
 * 显示获取到的上下文内容，支持编辑和确认
 */
import { Check, X, RotateCcw, AlertCircle } from 'lucide-react'
import type { CaptureSession } from '../shared'
import { CAPTURE_STATUS_LABEL, truncateText } from '../shared'

interface CapturePreviewProps {
  session: CaptureSession
  onConfirm: () => void
  onCancel: () => void
  onRetry: () => void
  onEdit: (content: string) => void
}

export function CapturePreview({
  session,
  onConfirm,
  onCancel,
  onRetry,
  onEdit,
}: CapturePreviewProps) {
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
          内容预览
        </h3>
        <span
          className="rounded-full px-2 py-0.5 text-xs"
          style={{
            background: session.status === 'ready' ? 'var(--rc-badge-success-bg)' : 'var(--rc-badge-warning-bg)',
            color: session.status === 'ready' ? 'var(--rc-badge-success-text)' : 'var(--rc-badge-warning-text)',
          }}
        >
          {CAPTURE_STATUS_LABEL[session.status]}
        </span>
      </div>

      {/* 内容区域 */}
      <div className="p-4">
        {/* 来源信息 */}
        {session.sourceApp && (
          <div className="mb-3 text-xs" style={{ color: 'var(--rc-text-muted)' }}>
            来源：{session.sourceApp}
            {session.windowTitle && ` - ${truncateText(session.windowTitle, 30)}`}
          </div>
        )}

        {/* 内容编辑 */}
        {session.status === 'ready' && session.content && (
          <textarea
            value={session.content}
            onChange={(e) => onEdit(e.target.value)}
            className="mb-4 w-full rounded-lg p-3 text-sm"
            style={{
              background: 'var(--rc-control-bg)',
              border: '1px solid var(--rc-control-border)',
              color: 'var(--rc-text)',
              minHeight: 120,
              resize: 'vertical',
            }}
            placeholder="可以编辑内容..."
          />
        )}

        {/* 截图预览 */}
        {session.screenshotPath && (
          <div className="mb-4">
            <img
              src={`asset://localhost/${session.screenshotPath}`}
              alt="截图预览"
              className="w-full rounded-lg"
              style={{ border: '1px solid var(--rc-border)' }}
            />
          </div>
        )}

        {/* 错误状态 */}
        {session.status === 'error' && (
          <div
            className="mb-4 flex items-start gap-2 rounded-lg p-3"
            style={{ background: 'var(--rc-badge-danger-bg)' }}
          >
            <AlertCircle size={16} style={{ color: 'var(--rc-badge-danger-text)', flexShrink: 0 }} />
            <div>
              <p className="text-sm" style={{ color: 'var(--rc-badge-danger-text)' }}>
                获取失败
              </p>
              <p className="text-xs" style={{ color: 'var(--rc-text-muted)' }}>
                请重试或选择其他获取方式
              </p>
            </div>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex gap-2">
          {session.status === 'ready' && (
            <button
              onClick={onConfirm}
              className="rc-focus-cta flex flex-1 items-center justify-center gap-2 text-sm"
            >
              <Check size={14} />
              确认使用
            </button>
          )}
          {session.status === 'error' && (
            <button
              onClick={onRetry}
              className="rc-focus-cta flex flex-1 items-center justify-center gap-2 text-sm"
            >
              <RotateCcw size={14} />
              重试
            </button>
          )}
          <button
            onClick={onCancel}
            className="rc-focus-btn-secondary flex flex-1 items-center justify-center gap-2 text-sm"
          >
            <X size={14} />
            取消
          </button>
        </div>
      </div>
    </div>
  )
}
