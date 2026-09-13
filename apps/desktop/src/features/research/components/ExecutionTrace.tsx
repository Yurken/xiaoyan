/**
 * 研究工作流执行追踪
 */
import { CheckCircle2, Circle, Loader2, XCircle, AlertCircle } from 'lucide-react'
import { Card, Badge } from '@research-copilot/ui'
import type { ResearchWorkflowState } from '../hooks'

const STATUS_ICON: Record<string, typeof Circle> = {
  pending: Circle,
  running: Loader2,
  completed: CheckCircle2,
  failed: XCircle,
  cancelled: AlertCircle,
  skipped: Circle,
}

const STATUS_VARIANT: Record<string, 'default' | 'success' | 'danger' | 'warning'> = {
  pending: 'default',
  running: 'warning',
  completed: 'success',
  failed: 'danger',
  cancelled: 'default',
  skipped: 'default',
}

interface ExecutionTraceProps {
  workflow: ResearchWorkflowState
}

export function ExecutionTrace({ workflow }: ExecutionTraceProps) {
  const { workflowSteps, currentStage, isRunning, processLog } = workflow

  return (
    <Card className="flex flex-col" padding="md" style={{ maxHeight: 'calc(100vh - 120px)' }}>
      <h3 className="mb-3 text-sm font-semibold" style={{ color: 'var(--rc-text)' }}>
        执行追踪
      </h3>

      {/* 当前状态 */}
      <Card variant="inset" padding="sm" className="mb-4">
        <div className="text-xs" style={{ color: 'var(--rc-text-muted)' }}>
          {isRunning ? '当前阶段' : '状态'}
        </div>
        <div className="mt-1 text-sm font-medium" style={{ color: 'var(--rc-text)' }}>
          {currentStage || '等待开始'}
        </div>
      </Card>

      {/* 工作流步骤 */}
      {workflowSteps.length > 0 && (
        <div className="mb-4">
          <div className="mb-2 text-xs font-medium" style={{ color: 'var(--rc-text-muted)' }}>
            工作流步骤
          </div>
          <div className="space-y-1">
            {workflowSteps.map((step) => {
              const Icon = STATUS_ICON[step.status] || Circle
              const variant = STATUS_VARIANT[step.status] || 'default'
              return (
                <div
                  key={step.id}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5"
                  style={{
                    background: step.status === 'running' ? 'rgba(0, 122, 255, 0.08)' : 'transparent',
                  }}
                >
                  <Badge variant={variant} className="h-5 w-5 items-center justify-center p-0">
                    <Icon
                      size={14}
                      className={step.status === 'running' ? 'animate-spin' : ''}
                    />
                  </Badge>
                  <span
                    className="truncate text-xs"
                    style={{
                      color: step.status === 'completed' ? 'var(--rc-text-muted)' : 'var(--rc-text)',
                    }}
                  >
                    {step.title}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 处理日志 */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mb-2 text-xs font-medium" style={{ color: 'var(--rc-text-muted)' }}>
          处理日志
        </div>
        <div className="space-y-1">
          {processLog.map((entry) => (
            <div key={entry.id} className="flex gap-2 text-xs">
              <span style={{ color: 'var(--rc-text-muted)', flexShrink: 0 }}>
                {entry.time}
              </span>
              <span
                style={{
                  color: entry.level === 'error'
                    ? 'var(--rc-badge-danger-text)'
                    : entry.level === 'success'
                      ? 'var(--rc-badge-success-text)'
                      : entry.level === 'warning'
                        ? 'var(--rc-badge-warning-text)'
                        : 'var(--rc-text)',
                }}
              >
                {entry.text}
              </span>
            </div>
          ))}
          {processLog.length === 0 && (
            <div className="text-xs" style={{ color: 'var(--rc-text-muted)' }}>
              暂无日志
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
