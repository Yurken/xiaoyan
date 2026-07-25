/**
 * 动作面板组件
 * 显示上下文预览、来源选择和四个动作按钮
 */
import { useState } from 'react'
import {
  BookOpen,
  Languages,
  MessageSquare,
  Download,
  TextCursorInput,
  Clipboard,
  Camera,
  FileInput,
  Settings,
  X,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, IconButton, Badge, Button } from '@research-copilot/ui'
import { ASSISTANT_ACTIONS, CONTEXT_SOURCES, CAPTURE_STATUS_LABEL } from '../shared'
import type { CaptureSession, AssistantAction, ContextSourceType } from '../shared'

interface AssistantPanelProps {
  session: CaptureSession | null
  isLoading?: boolean
  onAction: (action: AssistantAction) => void
  onSourceChange: (sourceType: ContextSourceType) => void
  onClose: () => void
  onSettings?: () => void
}

const ACTION_ICONS: Record<AssistantAction, typeof BookOpen> = {
  interpret: BookOpen,
  translate: Languages,
  chat: MessageSquare,
  import: Download,
}

const SOURCE_ICONS: Record<ContextSourceType, typeof TextCursorInput> = {
  selection: TextCursorInput,
  clipboard: Clipboard,
  screenshot: Camera,
  paste: FileInput,
}

export function AssistantPanel({
  session,
  isLoading = false,
  onAction,
  onSourceChange,
  onClose,
  onSettings,
}: AssistantPanelProps) {
  const [selectedAction, setSelectedAction] = useState<AssistantAction | null>(null)
  const [question, setQuestion] = useState('')

  const handleActionClick = (action: AssistantAction) => {
    // paste 动作允许无内容时触发（用户可以粘贴）
    if (!session?.content && action !== 'import') return
    setSelectedAction(action)
    onAction(action)
  }

  const hasContent = !!session?.content

  const statusVariant =
    session?.status === 'ready'
      ? 'success'
      : session?.status === 'error'
        ? 'danger'
        : session?.status === 'capturing'
          ? 'warning'
          : 'default'

  return (
    <Card className="w-[380px] overflow-hidden" padding="none">
      {/* 标题栏 */}
      <CardHeader className="px-4 py-3" style={{ borderBottom: '1px solid var(--rc-border)' }}>
        <div className="flex items-center gap-2">
          <div
            className="flex h-6 w-6 items-center justify-center rounded-full"
            style={{ background: 'var(--rc-button-primary-bg)' }}
          >
            <span className="text-xs font-bold text-white">妍</span>
          </div>
          <CardTitle className="text-sm">小妍助手</CardTitle>
        </div>
        <div className="flex items-center gap-1">
          {onSettings && (
            <IconButton size="sm" onClick={onSettings} title="设置">
              <Settings size={14} />
            </IconButton>
          )}
          <IconButton size="sm" onClick={onClose} title="关闭">
            <X size={14} />
          </IconButton>
        </div>
      </CardHeader>

      {/* 内容区域 */}
      <div className="p-4">
        {/* 上下文预览 */}
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
              <p className="line-clamp-3 text-sm" style={{ color: 'var(--rc-text)' }}>
                {session.content}
              </p>
              {session.sourceApp && (
                <p className="mt-2 text-xs" style={{ color: 'var(--rc-text-muted)' }}>
                  来源：{session.sourceApp}
                  {session.windowTitle && ` - ${session.windowTitle}`}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm" style={{ color: 'var(--rc-text-muted)' }}>
              请先获取内容...
            </p>
          )}
        </Card>

        {/* 来源选择 */}
        <div className="mb-4">
          <div className="mb-2 text-xs font-medium" style={{ color: 'var(--rc-text-muted)' }}>
            获取方式
          </div>
          <div className="grid grid-cols-4 gap-1">
            {CONTEXT_SOURCES.map((source) => {
              const Icon = SOURCE_ICONS[source.type]
              const isActive = session?.sourceType === source.type
              return (
                <button
                  key={source.type}
                  onClick={() => onSourceChange(source.type)}
                  disabled={isLoading}
                  className="flex flex-col items-center gap-1 rounded-xl p-2 text-center transition-colors"
                  style={{
                    background: isActive ? 'var(--rc-info-chip-bg)' : 'transparent',
                    color: isActive ? 'var(--rc-info-chip-text)' : 'var(--rc-text-muted)',
                    opacity: isLoading ? 0.5 : 1,
                  }}
                >
                  <Icon size={16} />
                  <span className="text-xs">{source.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* 可选问题输入 */}
        <div className="mb-4">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="可选：输入你的问题..."
            className="w-full rounded-2xl border px-4 py-2.5 text-sm outline-none"
            style={{
              background: 'var(--rc-control-bg)',
              borderColor: 'var(--rc-control-border)',
              color: 'var(--rc-text)',
              boxShadow: 'var(--rc-control-shadow)',
            }}
          />
        </div>

        {/* 动作按钮 */}
        <div>
          <div className="mb-2 text-xs font-medium" style={{ color: 'var(--rc-text-muted)' }}>
            选择动作
          </div>
          <div className="grid grid-cols-2 gap-2">
            {ASSISTANT_ACTIONS.map((action) => {
              const Icon = ACTION_ICONS[action.id]
              const isRunning = selectedAction === action.id && isLoading
              return (
                <Button
                  key={action.id}
                  variant="primary"
                  size="sm"
                  loading={isRunning}
                  disabled={!hasContent || isLoading}
                  onClick={() => handleActionClick(action.id)}
                  className="flex items-center justify-center gap-2"
                >
                  <Icon size={14} />
                  {action.label}
                </Button>
              )
            })}
          </div>
        </div>
      </div>
    </Card>
  )
}
