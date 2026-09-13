/**
 * 研究工作台主页面
 * 职责：组合 hook 和组件，不承载副作用
 */
import React from 'react'
import { AlertCircle, ArrowRight, RefreshCw, Trash2 } from 'lucide-react'
import { Button, Card, IconButton } from '@research-copilot/ui'
import { useResearchStore } from '../stores/researchStore'
import { useResearchSession, useResearchWorkflow, useResearchProtocol, useResearchCandidates } from '../hooks'
import { TopBar } from '../components/TopBar'
import { ExecutionTrace } from '../components/ExecutionTrace'
import { ProblemSection } from '../components/ProblemSection'
import { EvidenceSection } from '../components/EvidenceSection'
import { CandidatesSection } from '../components/CandidatesSection'
import { ExperimentSection } from '../components/ExperimentSection'
import { ReportSection } from '../components/ReportSection'
import { NewResearchDialog } from '../components/NewResearchDialog'
import { normalizeResearchOutput, SESSION_STATUS_LABEL } from '../shared'
import type { ResearchOutput } from '../shared'
import { RESEARCH_API_BASE } from '../services/backend'

function Welcome({
  sessionList,
  onSelectSession,
  onDeleteResearch,
  onShowNewResearch,
  backendStatus,
  backendError,
  onRetryConnection,
}: {
  sessionList: ReturnType<typeof useResearchSession>['sessionList']
  onSelectSession: (id: string) => void
  onDeleteResearch: (id: string) => void
  onShowNewResearch: () => void
  backendStatus: ReturnType<typeof useResearchSession>['backendStatus']
  backendError: string | null
  onRetryConnection: () => void
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center p-5">
      <div className="w-full max-w-3xl">
        {backendStatus === 'unavailable' && (
          <Card padding="md" className="mb-6 flex items-start gap-3">
            <AlertCircle className="mt-0.5 shrink-0" size={18} style={{ color: 'var(--rc-badge-danger-text)' }} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold" style={{ color: 'var(--rc-text)' }}>
                研究服务未连接
              </p>
              <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--rc-text-muted)' }}>
                研究工作台需要 SwanForge 服务。当前地址：{RESEARCH_API_BASE}
                {backendError ? `（${backendError}）` : ''}
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={onRetryConnection}>
              <RefreshCw size={14} />
              重试
            </Button>
          </Card>
        )}
        <div className="mb-8 text-center">
          <p className="rc-kicker">研究工作台</p>
          <h1
            className="mt-3 text-4xl font-bold leading-snug"
            style={{
              color: 'var(--rc-text)',
              fontFamily: 'Georgia, "Times New Roman", serif',
            }}
          >
            从一个问题，<br />到经得起审查的候选假设。
          </h1>
          <p
            className="mt-4 mx-auto max-w-xl text-base leading-relaxed"
            style={{ color: 'var(--rc-text-soft)' }}
          >
            系统从真实文献与材料出发，一次提出 3–5 个可检验的候选假设；
            每个候选都必须经过你的决定——采纳、驳回或保留未知——才能进入验证。
            每一步都有记录，每个结论都能回到真实来源。
          </p>
          <div className="mt-6">
            <Button
              variant="primary"
              size="md"
              disabled={backendStatus !== 'ready'}
              onClick={onShowNewResearch}
            >
              开始一个新研究
              <ArrowRight size={16} />
            </Button>
          </div>
        </div>

        {sessionList.length > 0 ? (
          <div className="mt-8">
            <p className="rc-kicker mb-3">继续之前的研究</p>
            <div className="space-y-2">
              {sessionList.map((s) => (
                <Card
                  key={s.id}
                  padding="md"
                  className="flex w-full items-center gap-3 cursor-pointer"
                  onClick={() => onSelectSession(s.id)}
                >
                  <button
                    className="min-w-0 flex-1 text-left"
                    onClick={() => onSelectSession(s.id)}
                  >
                    <span
                      className="block truncate text-base font-medium"
                      style={{
                        color: 'var(--rc-text)',
                        fontFamily: 'Georgia, "Times New Roman", serif',
                      }}
                    >
                      {s.title}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--rc-text-muted)' }}>
                      {s.created_at.slice(0, 10)}
                    </span>
                  </button>
                  <span
                    className="inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold"
                    style={{ background: 'var(--rc-badge-bg)', color: 'var(--rc-text-soft)', borderColor: 'var(--rc-badge-border)' }}
                  >
                    {SESSION_STATUS_LABEL[s.status] ?? s.status}
                  </span>
                  <IconButton
                    size="sm"
                    title="删除研究"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (confirm(`确定删除「${s.title}」？此操作不可恢复。`)) {
                        onDeleteResearch(s.id)
                      }
                    }}
                  >
                    <Trash2 size={14} />
                  </IconButton>
                </Card>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default function ResearchPage() {
  // UI 状态
  const ui = useResearchStore()

  // 会话管理
  const session = useResearchSession()

  // 工作流管理（带 output 回调）
  const workflow = useResearchWorkflow((raw) => {
    setOutput(normalizeResearchOutput(raw))
  })

  // 协议管理
  const protocolHook = useResearchProtocol()

  // 候选假设管理
  const candidatesHook = useResearchCandidates()

  // 本地 output 状态
  const [output, setOutput] = React.useState<ResearchOutput | null>(null)

  // 切换 session 时重置 output
  React.useEffect(() => {
    setOutput(null)
  }, [session.sessionId])

  // 包装候选假设操作，添加日志和刷新
  const handleDecide = async (candidateId: string, decision: 'select' | 'reject' | 'defer', reason: string) => {
    if (!session.sessionId) return '会话不存在'
    const error = await candidatesHook.decide(session.sessionId, candidateId, decision, ui.operator, reason)
    if (!error) {
      const label = decision === 'select' ? '已采纳' : decision === 'reject' ? '已驳回' : '已保留未知'
      workflow.log(`候选决定：${label}（${ui.operator}）`, 'success')
      await session.refreshCandidates()
    }
    return error
  }

  const handleCreateExperiment = async (candidateId: string, design: string) => {
    if (!session.sessionId) return false
    if (!ui.operator.trim()) {
      alert('请先填写操作者签名')
      return false
    }
    const result = await candidatesHook.openExperiment(session.sessionId, candidateId, ui.operator, design)
    if (result) {
      workflow.log('验证方案草案已创建', 'success')
      await session.refreshCandidates()
      return true
    }
    return false
  }

  const handleFreeze = async (experimentId: string) => {
    if (!session.sessionId) return false
    if (!ui.operator.trim()) {
      alert('请先填写操作者签名')
      return false
    }
    const result = await candidatesHook.freeze(session.sessionId, experimentId, ui.operator)
    if (result) {
      workflow.log('验证方案已冻结', 'success')
      await session.refreshCandidates()
      return true
    }
    return false
  }

  const handleSaveProtocol = async (payload: {
    research_question: string
    prediction_cutoff: string
    prediction_window: { start: string; end: string }
    allowed_sources: string[]
    data_license: string
    success_metrics: string[]
  }) => {
    if (!session.sessionId) return null
    const protocol = await protocolHook.saveProtocol(session.sessionId, payload)
    if (protocol) {
      workflow.log('研究协议已保存', 'success')
    }
    return protocol
  }

  const handleDeleteResearch = async (id: string) => {
    try {
      await session.deleteResearch(id)
      workflow.log('研究已删除', 'warning')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      workflow.log(`删除研究失败：${message}`, 'error')
      alert(`删除研究失败：${message}`)
    }
  }

  return (
    <div className="rc-app-page space-y-5">
      <TopBar
        session={session}
        workflow={workflow}
        ui={ui}
      />
      {session.sessionId ? (
        <main className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <ExecutionTrace workflow={workflow} />
          <div className="min-w-0 space-y-6">
            <ProblemSection
              protocol={session.protocol}
              onSave={handleSaveProtocol}
            />
            <EvidenceSection
              papers={session.papers}
              evidenceClaims={session.evidenceClaims}
            />
            <CandidatesSection
              candidateSets={session.candidateSets}
              operator={ui.operator}
              onDecide={handleDecide}
              onCreateExperiment={handleCreateExperiment}
            />
            <ExperimentSection
              experimentProtocols={session.experimentProtocols}
              operator={ui.operator}
              onFreeze={handleFreeze}
            />
            <ReportSection
              sessionId={session.sessionId}
              output={output}
            />
          </div>
        </main>
      ) : (
        <Welcome
          sessionList={session.sessionList}
          onSelectSession={(id) => void session.selectSession(id)}
          onDeleteResearch={handleDeleteResearch}
          onShowNewResearch={() => ui.setShowNewResearch(true)}
          backendStatus={session.backendStatus}
          backendError={session.backendError}
          onRetryConnection={() => void session.retryConnection()}
        />
      )}
      <NewResearchDialog
        show={ui.showNewResearch}
        onClose={() => ui.setShowNewResearch(false)}
        onCreate={session.createResearch}
      />
    </div>
  )
}
