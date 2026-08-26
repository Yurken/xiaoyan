/**
 * 采集预览组件
 * 显示获取到的上下文内容，支持编辑和确认
 * 支持隐私错误展示和降级入口
 */
import { Check, X, RotateCcw, AlertCircle, Shield, ScanText, Zap } from 'lucide-react'
import { Card, CardHeader, CardTitle, Badge, Button } from '@research-copilot/ui'
import type { AssistantDirectAction, CaptureSession } from '../shared'
import {
  ASSISTANT_ACTIONS,
  ASSISTANT_EXTRACT_TEXT_NOTICE,
  ASSISTANT_WINDOW_CARD_STYLE,
  CAPTURE_STATUS_LABEL,
  countTextCharacters,
  truncateText,
} from '../shared'

interface CapturePreviewProps {
  session: CaptureSession
  privacyError: string | null
  /** 文本来自截图 OCR 时展示「识别可能有误」标注并允许编辑（PRD §7.2 F3） */
  extractedFromImage?: boolean
  /** 直达快捷键（P1-1）预设的动作；存在时提示确认后将跳过动作选择直接执行 */
  pendingAction?: AssistantDirectAction | null
  onConfirm: () => void
  onCancel: () => void
  onRetry: () => void
  onEdit: (content: string) => void
  onPasteFallback: () => void
}

export function CapturePreview({
  session,
  privacyError,
  extractedFromImage = false,
  pendingAction = null,
  onConfirm,
  onCancel,
  onRetry,
  onEdit,
  onPasteFallback,
}: CapturePreviewProps) {
  const showPrivacyError = privacyError || session.status === 'error'
  const isScreenshot = session.sourceType === 'screenshot'
  const showTextEditor = !isScreenshot || extractedFromImage
  const canConfirm = Boolean(session.content?.trim())
  const currentCharacters = session.content ? countTextCharacters(session.content) : 0
  const originalCharacters = session.originalCharacterCount ?? currentCharacters
  const hasSensitiveRedactions = (session.sensitiveRedactionKinds?.length ?? 0) > 0

  const statusVariant =
    session.status === 'ready'
      ? 'success'
      : session.status === 'error'
        ? 'danger'
        : 'warning'

  return (
    <Card className="w-full overflow-hidden" padding="none" style={ASSISTANT_WINDOW_CARD_STYLE}>
      {/* 标题栏 */}
      <CardHeader
        data-tauri-drag-region
        className="cursor-grab px-4 py-3 active:cursor-grabbing"
        style={{ borderBottom: '1px solid var(--rc-border)' }}
      >
        <CardTitle data-tauri-drag-region className="text-sm">内容预览</CardTitle>
        <div data-tauri-drag-region>
          <Badge variant={statusVariant}>{CAPTURE_STATUS_LABEL[session.status]}</Badge>
        </div>
      </CardHeader>

      {/* 内容区域 */}
      <div className="p-4">
        {/* 隐私错误提示 */}
        {showPrivacyError && privacyError && (
          <Card variant="flat" padding="sm" className="mb-4" style={{ background: 'var(--rc-badge-danger-bg)' }} role="alert">
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

        {/* 直达动作（P1-1）：提示确认后将跳过动作选择直接执行预设动作 */}
        {pendingAction && !showPrivacyError && (
          <div
            role="status"
            className="mb-3 flex items-center gap-2 rounded-2xl px-3 py-2 text-xs leading-5"
            style={{
              background: 'var(--rc-info-chip-bg)',
              color: 'var(--rc-info-chip-text)',
            }}
          >
            <Zap size={14} style={{ flexShrink: 0 }} />
            <p>
              确认后将直接执行：
              {ASSISTANT_ACTIONS.find((action) => action.id === pendingAction)?.label
                ?? pendingAction}
              ，无需再选择动作
            </p>
          </div>
        )}

        {/* 来源信息 */}
        {session.sourceApp && !showPrivacyError && (
          <div className="mb-3 text-xs" style={{ color: 'var(--rc-text-muted)' }}>
            来源：{session.sourceApp}
            {session.windowTitle && ` - ${truncateText(session.windowTitle, 30)}`}
          </div>
        )}

        {session.status === 'ready' && showTextEditor && (
          <div
            className="mb-3 rounded-2xl px-3 py-2 text-xs leading-5"
            style={{
              background: session.contentTruncated
                ? 'var(--rc-badge-warning-bg)'
                : 'var(--rc-chip-inset-bg)',
              color: session.contentTruncated
                ? 'var(--rc-badge-warning-text)'
                : 'var(--rc-text-muted)',
            }}
          >
            <p>当前内容：{currentCharacters.toLocaleString('zh-CN')} 字符</p>
            {session.contentTruncated && (
              <p role="status">
                原始内容共 {originalCharacters.toLocaleString('zh-CN')} 字符，已仅保留前{' '}
                {currentCharacters.toLocaleString('zh-CN')} 字符。可缩小选区，或在主窗口处理完整文档。
              </p>
            )}
          </div>
        )}

        {/* OCR 提取结果必须标注「识别可能有误」（PRD §7.2 F3） */}
        {session.status === 'ready' && extractedFromImage && (
          <div
            role="status"
            className="mb-3 flex items-start gap-2 rounded-2xl px-3 py-2 text-xs leading-5"
            style={{
              background: 'var(--rc-badge-warning-bg)',
              color: 'var(--rc-badge-warning-text)',
            }}
          >
            <ScanText size={14} style={{ flexShrink: 0, marginTop: 2 }} />
            <p>
              以下为截图提取的文字，{ASSISTANT_EXTRACT_TEXT_NOTICE}，请核对编辑后再确认；确认前不会发送给模型。
            </p>
          </div>
        )}

        {session.status === 'ready' && hasSensitiveRedactions && (
          <div
            role="alert"
            className="mb-3 rounded-2xl px-3 py-2 text-xs leading-5"
            style={{
              background: 'var(--rc-badge-warning-bg)',
              color: 'var(--rc-badge-warning-text)',
            }}
          >
            <p className="font-medium">已默认遮盖疑似敏感片段</p>
            <p>
              检测到：{session.sensitiveRedactionKinds?.join('、')}。原值不会显示、保存或发送；请检查占位符后再次确认。
            </p>
          </div>
        )}

        {/* 内容编辑 */}
        {session.status === 'ready' && showTextEditor && (
          <textarea
            value={session.content ?? ''}
            onChange={(e) => onEdit(e.target.value)}
            aria-label="预览内容（可编辑）"
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
        {isScreenshot && session.screenshotPath && (
          <div className="mb-4">
            {session.captureRegion ? (
              <p className="mb-2 text-xs" style={{ color: 'var(--rc-text-muted)' }}>
                截取范围：{session.captureRegion.width} × {session.captureRegion.height} 像素
              </p>
            ) : null}
            <img
              src={session.screenshotPath}
              alt="截图预览"
              className="w-full rounded-2xl"
              style={{ border: '1px solid var(--rc-border)' }}
            />
          </div>
        )}

        {/* 通用错误状态 */}
        {session.status === 'error' && !privacyError && (
          <Card variant="flat" padding="sm" className="mb-4" style={{ background: 'var(--rc-badge-danger-bg)' }} role="alert">
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
              <Button
                variant="primary"
                size="sm"
                onClick={onConfirm}
                disabled={!canConfirm}
                className="flex-1"
              >
                <Check size={14} />
                {hasSensitiveRedactions
                  ? session.sensitiveConfirmationArmed
                    ? '确认发送遮盖内容'
                    : '检查后继续'
                  : '确认使用'}
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
