/**
 * 研究工作台顶部栏
 */
import { ArrowLeft, FlaskConical, Play, Pause, RotateCcw, User } from 'lucide-react'
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
      <button
        onClick={leaveSession}
        className="rc-icon-button flex items-center justify-center"
        style={{ width: 32, height: 32 }}
        title="返回列表"
      >
        <ArrowLeft size={16} />
      </button>

      {/* 研究标题 */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <FlaskConical size={16} style={{ color: 'var(--rc-accent)' }} />
          <h1
            className="truncate text-sm font-semibold"
            style={{ color: 'var(--rc-text)' }}
          >
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
      <div className="flex items-center gap-2">
        <div
          className="rc-focus-stat-chip"
          style={{ opacity: llmReady === null ? 0.5 : 1 }}
        >
          <div
            className="h-2 w-2 rounded-full"
            style={{
              background: llmReady === true
                ? 'var(--rc-badge-success-text)'
                : llmReady === false
                  ? 'var(--rc-badge-danger-text)'
                  : 'var(--rc-text-muted)',
            }}
          />
          <span className="text-xs">
            {llmReady === true ? 'LLM 就绪' : llmReady === false ? 'LLM 不可用' : '检查中…'}
          </span>
        </div>
      </div>

      {/* 操作者输入 */}
      <div className="flex items-center gap-2">
        <User size={14} style={{ color: 'var(--rc-text-muted)' }} />
        <input
          type="text"
          value={operator}
          onChange={(e) => setOperator(e.target.value)}
          placeholder="操作者签名"
          className="w-28 rounded-lg px-2 py-1 text-xs"
          style={{
            background: 'var(--rc-control-bg)',
            border: '1px solid var(--rc-control-border)',
            color: 'var(--rc-text)',
            boxShadow: 'var(--rc-chip-inset-shadow)',
          }}
        />
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center gap-2">
        {!isRunning ? (
          <>
            <button
              onClick={() => setShowNewResearch(true)}
              className="rc-focus-btn-secondary"
            >
              新建研究
            </button>
            <button
              onClick={() => void start(sessionId, false)}
              className="rc-focus-cta"
            >
              <Play size={14} />
              运行
            </button>
            {sessionStatus === 'failed' && (
              <button
                onClick={() => void start(sessionId, true)}
                className="rc-focus-btn-secondary"
              >
                <RotateCcw size={14} />
                续跑
              </button>
            )}
          </>
        ) : (
          <button
            onClick={() => void cancel(sessionId)}
            className="rc-focus-btn-secondary"
          >
            <Pause size={14} />
            暂停
          </button>
        )}
      </div>
    </header>
  )
}
