/**
 * 研究候选假设管理 hook
 * 职责：候选假设决策、验证方案创建与冻结
 */
import { useCallback } from 'react'
import * as backend from '../services/backend'
import type { CandidateDecisionType, ExperimentProtocol } from '../shared'

export interface UseResearchCandidates {
  decide: (
    sessionId: string,
    candidateId: string,
    decision: CandidateDecisionType,
    operator: string,
    reason: string
  ) => Promise<string | null>
  openExperiment: (
    sessionId: string,
    candidateId: string,
    operator: string,
    design: string
  ) => Promise<ExperimentProtocol | null>
  freeze: (
    sessionId: string,
    experimentId: string,
    operator: string
  ) => Promise<ExperimentProtocol | null>
}

export function useResearchCandidates(): UseResearchCandidates {
  const decide = useCallback(
    async (
      sessionId: string,
      candidateId: string,
      decision: CandidateDecisionType,
      operator: string,
      reason: string
    ): Promise<string | null> => {
      if (!operator.trim()) {
        return '请先填写操作者签名'
      }
      try {
        await backend.decideCandidate(sessionId, candidateId, decision, operator, reason)
        return null
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return message
      }
    },
    []
  )

  const openExperiment = useCallback(
    async (
      sessionId: string,
      candidateId: string,
      operator: string,
      design: string
    ): Promise<ExperimentProtocol | null> => {
      if (!operator.trim()) {
        return null
      }
      try {
        const protocol = await backend.createExperimentDraft(
          sessionId,
          candidateId,
          operator,
          '',
          design
        )
        return protocol
      } catch (err) {
        console.error('[research] failed to create experiment:', err)
        return null
      }
    },
    []
  )

  const freeze = useCallback(
    async (
      sessionId: string,
      experimentId: string,
      operator: string
    ): Promise<ExperimentProtocol | null> => {
      if (!operator.trim()) {
        return null
      }
      try {
        const protocol = await backend.freezeExperiment(sessionId, experimentId, operator)
        return protocol
      } catch (err) {
        console.error('[research] failed to freeze experiment:', err)
        return null
      }
    },
    []
  )

  return { decide, openExperiment, freeze }
}
