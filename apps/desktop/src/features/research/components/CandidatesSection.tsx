/**
 * 候选假设展示与决策区域
 */
import { useState } from 'react'
import { CheckCircle, XCircle, HelpCircle, FlaskConical } from 'lucide-react'
import { Card, Button, Input, Textarea } from '@research-copilot/ui'
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
    <Card
      variant="inset"
      padding="md"
      style={{ borderLeft: `3px solid ${statusConfig.color}` }}
    >
      <div className="mb-2 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <FlaskConical size={14} style={{ color: 'var(--rc-accent)' }} />
          <span
            className="inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold"
            style={{ background: statusConfig.bg, color: statusConfig.color, borderColor: 'transparent' }}
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
          className="mb-2 rounded-xl p-2 text-xs"
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
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="决定理由（可选）"
            className="text-xs"
          />
          <div className="flex gap-2">
            <Button
              variant="primary"
              size="sm"
              loading={isSubmitting}
              onClick={() => void handleDecide('select')}
              className="flex items-center gap-1 text-xs"
            >
              <CheckCircle size={12} />
              采纳
            </Button>
            <Button
              variant="secondary"
              size="sm"
              loading={isSubmitting}
              onClick={() => void handleDecide('reject')}
              className="flex items-center gap-1 text-xs"
            >
              <XCircle size={12} />
              驳回
            </Button>
            <Button
              variant="secondary"
              size="sm"
              loading={isSubmitting}
              onClick={() => void handleDecide('defer')}
              className="flex items-center gap-1 text-xs"
            >
              <HelpCircle size={12} />
              保留
            </Button>
          </div>
        </div>
      )}

      {candidate.status === 'selected' && (
        <div className="mt-3 space-y-2">
          {showDesignInput ? (
            <>
              <Textarea
                value={design}
                onChange={(e) => setDesign(e.target.value)}
                rows={3}
                placeholder="描述实验设计方案..."
                className="text-xs"
              />
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  loading={isSubmitting}
                  disabled={!design.trim()}
                  onClick={() => void handleCreateExperiment()}
                  className="text-xs"
                >
                  <FlaskConical size={12} />
                  {isSubmitting ? '创建中...' : '确认创建'}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  loading={isSubmitting}
                  onClick={() => {
                    setShowDesignInput(false)
                    setDesign('')
                  }}
                  className="text-xs"
                >
                  取消
                </Button>
              </div>
            </>
          ) : (
            <Button variant="secondary" size="sm" onClick={() => setShowDesignInput(true)} className="text-xs">
              <FlaskConical size={12} />
              创建验证方案
            </Button>
          )}
        </div>
      )}
    </Card>
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
    <Section title="候选假设" description="系统生成的可检验假设，需要你的决定">
      {allCandidates.length === 0 ? (
        <Card variant="inset" padding="md" className="text-center">
          <p className="text-sm" style={{ color: 'var(--rc-text-muted)' }}>
            等待工作流运行后生成候选假设
          </p>
        </Card>
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
