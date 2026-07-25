/**
 * 采集预览组件
 * 显示获取到的上下文内容，支持编辑和确认
 */
import type { CaptureSession } from '../shared'
import { CAPTURE_STATUS_LABEL } from '../shared'

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
    <div className="rc-focus-card-inset rounded-xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium" style={{ color: 'var(--rc-text-muted)' }}>
          {CAPTURE_STATUS_LABEL[session.status]}
        </span>
        <span className="text-xs" style={{ color: 'var(--rc-text-muted)' }}>
          {session.sourceApp}
        </span>
      </div>

      {session.status === 'ready' && session.content && (
        <textarea
          value={session.content}
          onChange={(e) => onEdit(e.target.value)}
          className="mb-3 w-full rounded-lg p-2 text-sm"
          style={{
            background: 'var(--rc-control-bg)',
            border: '1px solid var(--rc-control-border)',
            color: 'var(--rc-text)',
            minHeight: 100,
          }}
        />
      )}

      {session.status === 'error' && (
        <p className="mb-3 text-sm" style={{ color: 'var(--rc-badge-danger-text)' }}>
          获取失败，请重试或选择其他方式
        </p>
      )}

      <div className="flex gap-2">
        {session.status === 'ready' && (
          <button onClick={onConfirm} className="rc-focus-cta flex-1 text-sm">
            确认使用
          </button>
        )}
        {session.status === 'error' && (
          <button onClick={onRetry} className="rc-focus-cta flex-1 text-sm">
            重试
          </button>
        )}
        <button onClick={onCancel} className="rc-focus-btn-secondary flex-1 text-sm">
          取消
        </button>
      </div>
    </div>
  )
}
