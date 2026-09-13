/**
 * 研究工作台顶部栏
 */
import { ArrowLeft, FlaskConical, Play, Pause, RotateCcw, User } from 'lucide-react'
import { Button, IconButton, Badge, Input } from '@research-copilot/ui'
import { SESSION_STATUS_LABEL } from '../shared'
import type { ResearchSessionState, ResearchWorkflowState } from '../hooks'

interface TopBarProps {
  session: ResearchSessionState & { leaveSession: () => void }
  workflow: ResearchWorkflowState & {
    start: (sessionId: string, resume?: boolean) => Promise<void>
    cancel: (sessionId: string) => Promise<void>
  }
  ui: {
    operator: string
    setOperator: (name: string) => void
    setShowNewResearch: (show: boolean) => void
  }
}

export function TopBar({ session, workflow, ui }: TopBarProps) {
  const {
    sessionId,
    sessionStatus,
    questionTitle,
    llmReady,
    leaveSession,
  } = session

  const {
    isRunning,
    overallProgress,
    currentStage,
    start,
    cancel,
  } = workflow

  const { operator, setOperator, setShowNewResearch } = ui

  if (!sessionId) return null

  const llmBadgeVariant = llmReady === true ? 'success' : llmReady === false ? 'danger' : 'default'
  const llmLabel = llmReady === true ? 'LLM 就绪' : llmReady === false ? 'LLM 不可用' : '检查中…'

  return (
    <header
      className="sticky top-0 z-20 flex items-center gap-4 px-6 py-3"
      style={{
        background: 'var(--rc-header-bg)',
        borderBottom: '1px solid var(--rc-border)',
        backdropFilter: 'blur(18px)',
      }}
    >
      {/* 返回按钮 */}
      <IconButton size="md" onClick={leaveSession} title="返回列表">
        <ArrowLeft size={16} />
      </IconButton>

      {/* 研究标题 */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <FlaskConical size={16} style={{ color: 'var(--rc-accent)' }} />
          <h1 className="truncate text-sm font-semibold" style={{ color: 'var(--rc-text)' }}>
            {questionTitle || '新研究'}
          </h1>
        </div>
        <div className="mt-1 flex items-center gap-3 text-xs" style={{ color: 'var(--rc-text-muted)' }}>
          <span>{SESSION_STATUS_LABEL[sessionStatus] ?? sessionStatus}</span>
          {isRunning && (
            <>
              <span>·</span>
              <span>{currentStage}</span>
              <span>·</span>
              <span>{Math.round(overallProgress * 100)}%</span>
            </>
          )}
        </div>
      </div>

      {/* LLM 状态 */}
      <Badge variant={llmBadgeVariant} className="gap-1.5">
        <span
          className="h-2 w-2 rounded-full"
          style={{
            background: llmReady === true
              ? 'var(--rc-badge-success-text)'
              : llmReady === false
                ? 'var(--rc-badge-danger-text)'
                : 'var(--rc-text-muted)',
          }}
        />
        {llmLabel}
      </Badge>

      {/* 操作者输入 */}
      <div className="flex items-center gap-2">
        <User size={14} style={{ color: 'var(--rc-text-muted)' }} />
        <Input
          value={operator}
          onChange={(e) => setOperator(e.target.value)}
          placeholder="操作者签名"
          className="w-28 py-1.5 text-xs"
        />
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center gap-2">
        {!isRunning ? (
          <>
            <Button variant="secondary" size="sm" onClick={() => setShowNewResearch(true)}>
              新建研究
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={llmReady !== true}
              title={llmReady === false ? '研究服务的 LLM 尚未就绪' : undefined}
              onClick={() => void start(sessionId, false)}
            >
              <Play size={14} />
              运行
            </Button>
            {sessionStatus === 'failed' && (
              <Button
                variant="secondary"
                size="sm"
                disabled={llmReady !== true}
                onClick={() => void start(sessionId, true)}
              >
                <RotateCcw size={14} />
                续跑
              </Button>
            )}
          </>
        ) : (
          <Button variant="secondary" size="sm" onClick={() => void cancel(sessionId)}>
            <Pause size={14} />
            暂停
          </Button>
        )}
      </div>
    </header>
  )
}
