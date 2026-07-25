/**
 * 动作面板组件
 * 显示上下文预览和四个动作按钮
 */
import { ASSISTANT_ACTIONS, CONTEXT_SOURCES } from '../shared'
import type { CaptureSession, AssistantAction } from '../shared'

interface AssistantPanelProps {
  session: CaptureSession | null
  onAction: (action: AssistantAction) => void
  onSourceChange: (sourceType: CaptureSession['sourceType']) => void
  onClose: () => void
}

export function AssistantPanel({
  session,
  onAction,
  onSourceChange,
  onClose,
}: AssistantPanelProps) {
  return (
    <div
      className="rc-focus-card rounded-2xl p-4"
      style={{ width: 360, maxHeight: 480 }}
    >
      {/* 标题栏 */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--rc-text)' }}>
          小妍助手
        </h3>
        <button
          onClick={onClose}
          className="rc-icon-button"
          style={{ width: 24, height: 24 }}
        >
          ×
        </button>
      </div>

      {/* 上下文预览 */}
      <div className="rc-focus-card-inset mb-4 rounded-xl p-3">
        <div className="mb-2 text-xs font-medium" style={{ color: 'var(--rc-text-muted)' }}>
          当前内容
        </div>
        {session?.content ? (
          <p className="line-clamp-3 text-sm" style={{ color: 'var(--rc-text)' }}>
            {session.content}
          </p>
        ) : (
          <p className="text-sm" style={{ color: 'var(--rc-text-muted)' }}>
            请先获取内容...
          </p>
        )}
        {session?.sourceApp && (
          <p className="mt-2 text-xs" style={{ color: 'var(--rc-text-muted)' }}>
            来源：{session.sourceApp}
          </p>
        )}
      </div>

      {/* 来源切换 */}
      <div className="mb-4">
        <div className="mb-2 text-xs font-medium" style={{ color: 'var(--rc-text-muted)' }}>
          获取方式
        </div>
        <div className="flex gap-2">
          {CONTEXT_SOURCES.map((source) => (
            <button
              key={source.type}
              onClick={() => onSourceChange(source.type)}
              className="rc-focus-btn-secondary flex-1 text-xs"
              style={{
                background: session?.sourceType === source.type ? 'var(--rc-info-chip-bg)' : undefined,
                color: session?.sourceType === source.type ? 'var(--rc-info-chip-text)' : undefined,
              }}
            >
              {source.label}
            </button>
          ))}
        </div>
      </div>

      {/* 动作按钮 */}
      <div>
        <div className="mb-2 text-xs font-medium" style={{ color: 'var(--rc-text-muted)' }}>
          选择动作
        </div>
        <div className="grid grid-cols-2 gap-2">
          {ASSISTANT_ACTIONS.map((action) => (
            <button
              key={action.id}
              onClick={() => onAction(action.id)}
              disabled={!session?.content}
              className="rc-focus-cta text-sm"
              style={{ opacity: session?.content ? 1 : 0.5 }}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
