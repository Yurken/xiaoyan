/**
 * 候选假设展示与决策区域
 */
import { useState } from 'react'
import { CheckCircle, XCircle, HelpCircle, FlaskConical } from 'lucide-react'
import { Section } from './Section'
import { CANDIDATE_STATUS_CONFIG } from '../shared'
import type { CandidateHypothesis, CandidateDecisionType, CandidateSet } from '../shared'

interface CandidatesSectionProps {
  candidateSets: CandidateSet[]
  operator: string
  onDecide: (
    candidateId: string,
    decision: CandidateDecisionType,
    reason: string
  ) => Promise<string | null>
  onCreateExperiment: (candidateId: string, design: string) => Promise<boolean>
}

function CandidateCard({
  candidate,
  operator,
  onDecide,
  onCreateExperiment,
}: {
  candidate: CandidateHypothesis
  operator: string
  onDecide: (candidateId: string, decision: CandidateDecisionType, reason: string) => Promise<string | null>
  onCreateExperiment: (candidateId: string, design: string) => Promise<boolean>
}) {
  const [reason, setReason] = useState('')
  const [design, setDesign] = useState('')
  const [showDesignInput, setShowDesignInput] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const statusConfig = CANDIDATE_STATUS_CONFIG[candidate.status] ?? CANDIDATE_STATUS_CONFIG.proposed
  const isDecided = candidate.status !== 'proposed'

  const handleDecide = async (decision: CandidateDecisionType) => {
    if (!operator.trim()) {
      alert('请先填写操作者签名')
      return
    }
    setIsSubmitting(true)
    try {
      await onDecide(candidate.id, decision, reason)
      setReason('')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCreateExperiment = async () => {
    if (!operator.trim()) {
      alert('请先填写操作者签名')
      return
    }
    setIsSubmitting(true)
    try {
      const success = await onCreateExperiment(candidate.id, design)
      if (success) {
        setDesign('')
        setShowDesignInput(false)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="rc-focus-card-inset rounded-xl p-4"
      style={{
        borderLeft: `3px solid ${statusConfig.color}`,
      }}
    >
      <div className="mb-2 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <FlaskConical size={14} style={{ color: 'var(--rc-accent)' }} />
          <span
            className="rounded-full px-2 py-0.5 text-xs font-medium"
            style={{ background: statusConfig.bg, color: statusConfig.color }}
          >
            v{candidate.version} · {statusConfig.label}
          </span>
        </div>
        <span className="text-xs" style={{ color: 'var(--rc-text-muted)' }}>
          {candidate.candidate_type}
        </span>
      </div>

      <p className="mb-2 text-sm" style={{ color: 'var(--rc-text)' }}>
        {candidate.statement}
      </p>

      <div className="mb-2 text-xs" style={{ color: 'var(--rc-text-muted)' }}>
        <strong>新颖性：</strong>{candidate.novelty_claim}
      </div>

      {candidate.decision_reason && (
        <div
          className="mb-2 rounded-lg p-2 text-xs"
          style={{
            background: 'var(--rc-chip-bg)',
            color: 'var(--rc-text-muted)',
          }}
        >
          <strong>决定理由：</strong>{candidate.decision_reason}
        </div>
      )}

      {!isDecided && (
        <div className="mt-3 space-y-2">
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="决定理由（可选）"
            className="w-full rounded-lg px-2 py-1 text-xs"
            style={{
              background: 'var(--rc-control-bg)',
              border: '1px solid var(--rc-control-border)',
              color: 'var(--rc-text)',
            }}
          />
          <div className="flex gap-2">
            <button
              onClick={() => void handleDecide('select')}
              disabled={isSubmitting}
              className="rc-focus-cta flex items-center gap-1 text-xs"
              style={{ padding: '4px 10px', opacity: isSubmitting ? 0.5 : 1 }}
            >
              <CheckCircle size={12} />
              采纳
            </button>
            <button
              onClick={() => void handleDecide('reject')}
              disabled={isSubmitting}
              className="rc-focus-btn-secondary flex items-center gap-1 text-xs"
              style={{ padding: '4px 10px', opacity: isSubmitting ? 0.5 : 1 }}
            >
              <XCircle size={12} />
              驳回
            </button>
            <button
              onClick={() => void handleDecide('defer')}
              disabled={isSubmitting}
              className="rc-focus-btn-secondary flex items-center gap-1 text-xs"
              style={{ padding: '4px 10px', opacity: isSubmitting ? 0.5 : 1 }}
            >
              <HelpCircle size={12} />
              保留
            </button>
          </div>
        </div>
      )}

      {candidate.status === 'selected' && (
        <div className="mt-3 space-y-2">
          {showDesignInput ? (
            <>
              <textarea
                value={design}
                onChange={(e) => setDesign(e.target.value)}
                rows={3}
                className="w-full rounded-lg px-2 py-1 text-xs"
                style={{
                  background: 'var(--rc-control-bg)',
                  border: '1px solid var(--rc-control-border)',
                  color: 'var(--rc-text)',
                }}
                placeholder="描述实验设计方案..."
              />
              <div className="flex gap-2">
                <button
                  onClick={() => void handleCreateExperiment()}
                  disabled={isSubmitting || !design.trim()}
                  className="rc-focus-cta text-xs"
                  style={{ padding: '4px 10px', opacity: isSubmitting || !design.trim() ? 0.5 : 1 }}
                >
                  <FlaskConical size={12} />
                  {isSubmitting ? '创建中...' : '确认创建'}
                </button>
                <button
                  onClick={() => {
                    setShowDesignInput(false)
                    setDesign('')
                  }}
                  disabled={isSubmitting}
                  className="rc-focus-btn-secondary text-xs"
                  style={{ padding: '4px 10px' }}
                >
                  取消
                </button>
              </div>
            </>
          ) : (
            <button
              onClick={() => setShowDesignInput(true)}
              className="rc-focus-btn-secondary text-xs"
              style={{ padding: '4px 10px' }}
            >
              <FlaskConical size={12} />
              创建验证方案
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export function CandidatesSection({
  candidateSets,
  operator,
  onDecide,
  onCreateExperiment,
}: CandidatesSectionProps) {
  const allCandidates = candidateSets.flatMap((set) => set.candidates)

  return (
    <Section
      title="候选假设"
      description="系统生成的可检验假设，需要你的决定"
    >
      {allCandidates.length === 0 ? (
        <div className="rc-focus-card-inset rounded-xl p-4 text-center">
          <p className="text-sm" style={{ color: 'var(--rc-text-muted)' }}>
            等待工作流运行后生成候选假设
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {allCandidates.map((candidate) => (
            <CandidateCard
              key={candidate.id}
              candidate={candidate}
              operator={operator}
              onDecide={onDecide}
              onCreateExperiment={onCreateExperiment}
            />
          ))}
        </div>
      )}
    </Section>
  )
}
