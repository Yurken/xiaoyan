/**
 * 采集预览组件
 * 显示获取到的上下文内容，支持编辑和确认
 * 支持隐私错误展示和降级入口
 */
import { Check, X, RotateCcw, AlertCircle, Shield } from 'lucide-react'
import { Card, CardHeader, CardTitle, Badge, Button } from '@research-copilot/ui'
import type { CaptureSession } from '../shared'
import { CAPTURE_STATUS_LABEL, truncateText } from '../shared'

interface CapturePreviewProps {
  session: CaptureSession
  privacyError: string | null
  onConfirm: () => void
  onCancel: () => void
  onRetry: () => void
  onEdit: (content: string) => void
  onPasteFallback: () => void
}

export function CapturePreview({
  session,
  privacyError,
  onConfirm,
  onCancel,
  onRetry,
  onEdit,
  onPasteFallback,
}: CapturePreviewProps) {
  const showPrivacyError = privacyError || session.status === 'error'

  const statusVariant =
    session.status === 'ready'
      ? 'success'
      : session.status === 'error'
        ? 'danger'
        : 'warning'

  return (
    <Card className="w-[380px] overflow-hidden" padding="none">
      {/* 标题栏 */}
      <CardHeader className="px-4 py-3" style={{ borderBottom: '1px solid var(--rc-border)' }}>
        <CardTitle className="text-sm">内容预览</CardTitle>
        <Badge variant={statusVariant}>{CAPTURE_STATUS_LABEL[session.status]}</Badge>
      </CardHeader>

      {/* 内容区域 */}
      <div className="p-4">
        {/* 隐私错误提示 */}
        {showPrivacyError && privacyError && (
          <Card variant="flat" padding="sm" className="mb-4" style={{ background: 'var(--rc-badge-danger-bg)' }}>
            <div className="flex items-start gap-3">
              <Shield size={20} style={{ color: 'var(--rc-badge-danger-text)', flexShrink: 0, marginTop: 2 }} />
              <div>
                <p className="mb-1 text-sm font-medium" style={{ color: 'var(--rc-badge-danger-text)' }}>
                  隐私安全检查未通过
                </p>
                <p className="text-xs" style={{ color: 'var(--rc-text-muted)' }}>
                  {privacyError}
                </p>
                <p className="mt-2 text-xs" style={{ color: 'var(--rc-text-muted)' }}>
                  为保护您的隐私，此内容无法自动获取。您可以选择：
                </p>
                <div className="mt-2 flex gap-2">
                  <Button variant="secondary" size="sm" onClick={onPasteFallback}>
                    手动粘贴
                  </Button>
                  <Button variant="ghost" size="sm" onClick={onCancel}>
                    取消
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* 来源信息 */}
        {session.sourceApp && !showPrivacyError && (
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
            className="mb-4 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
            style={{
              background: 'var(--rc-control-bg)',
              borderColor: 'var(--rc-control-border)',
              color: 'var(--rc-text)',
              boxShadow: 'var(--rc-control-shadow)',
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
              className="w-full rounded-2xl"
              style={{ border: '1px solid var(--rc-border)' }}
            />
          </div>
        )}

        {/* 通用错误状态 */}
        {session.status === 'error' && !privacyError && (
          <Card variant="flat" padding="sm" className="mb-4" style={{ background: 'var(--rc-badge-danger-bg)' }}>
            <div className="flex items-start gap-2">
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
          </Card>
        )}

        {/* 操作按钮 */}
        {!showPrivacyError && (
          <div className="flex gap-2">
            {session.status === 'ready' && (
              <Button variant="primary" size="sm" onClick={onConfirm} className="flex-1">
                <Check size={14} />
                确认使用
              </Button>
            )}
            {session.status === 'error' && !privacyError && (
              <Button variant="primary" size="sm" onClick={onRetry} className="flex-1">
                <RotateCcw size={14} />
                重试
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={onCancel} className="flex-1">
              <X size={14} />
              取消
            </Button>
          </div>
        )}
      </div>
    </Card>
  )
}
