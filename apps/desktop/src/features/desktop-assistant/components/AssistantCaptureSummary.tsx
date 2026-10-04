import { Badge, Card } from '@research-copilot/ui'
import type { CaptureSession } from '../shared'
import {
  CAPTURE_STATUS_LABEL,
  countTextCharacters,
  truncateText,
} from '../shared'

interface AssistantCaptureSummaryProps {
  session: CaptureSession | null
  isLoading: boolean
}

export function AssistantCaptureSummary({
  session,
  isLoading,
}: AssistantCaptureSummaryProps) {
  const isImage = session?.content?.startsWith('data:image/') ?? false
  const imageSource = isImage ? session?.screenshotPath ?? session?.content : null
  const statusVariant = session?.status === 'ready'
    ? 'success'
    : session?.status === 'error'
      ? 'danger'
      : session?.status === 'capturing'
        ? 'warning'
        : 'default'

  return (
    <Card variant="inset" padding="sm" className="mb-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium" style={{ color: 'var(--rc-text-muted)' }}>
          当前内容
        </span>
        {session && (
          <Badge variant={statusVariant}>{CAPTURE_STATUS_LABEL[session.status]}</Badge>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-apple-blue border-t-transparent" />
          <span className="text-sm" style={{ color: 'var(--rc-text-muted)' }}>
            获取中...
          </span>
        </div>
      ) : session?.content ? (
        <>
          {imageSource ? (
            <>
              {session.sourceType === 'screenshot' && (
                <p className="mb-1 text-xs" style={{ color: 'var(--rc-text-muted)' }}>
                  区域截图
                </p>
              )}
              <img
                src={imageSource}
                alt="当前截图预览"
                className="max-h-40 w-full rounded-xl object-contain"
              />
              {session.captureRegion && (
                <p className="mt-1 text-xs" style={{ color: 'var(--rc-text-muted)' }}>
                  截图范围：{session.captureRegion.width} × {session.captureRegion.height} 像素
                </p>
              )}
            </>
          ) : (
            <p className="line-clamp-3 text-sm" style={{ color: 'var(--rc-text)' }}>
              {session.content}
            </p>
          )}
          {session.sourceApp && (
            <p className="mt-2 text-xs" style={{ color: 'var(--rc-text-muted)' }}>
              来源：{session.sourceApp}
              {session.windowTitle && ` - ${truncateText(session.windowTitle, 50)}`}
            </p>
          )}
          {!isImage && (
            <p className="mt-1 text-xs" style={{ color: 'var(--rc-text-muted)' }}>
              {countTextCharacters(session.content).toLocaleString('zh-CN')} 字符
              {session.contentTruncated && '；采集时已按 50,000 字符上限截断'}
            </p>
          )}
        </>
      ) : (
        <p className="text-sm" style={{ color: 'var(--rc-text-muted)' }}>
          请先获取内容...
        </p>
      )}
    </Card>
  )
}
