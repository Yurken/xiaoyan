/**
 * 研究协议管理 hook
 * 职责：保存研究协议
 */
import { useCallback } from 'react'
import * as backend from '../services/backend'
import type { PredictionWindow, ResearchProtocol } from '../shared'

export interface UseResearchProtocol {
  saveProtocol: (
    sessionId: string,
    payload: {
      research_question: string
      prediction_cutoff: string
      prediction_window: PredictionWindow
      allowed_sources: string[]
      data_license: string
      success_metrics: string[]
    }
  ) => Promise<ResearchProtocol | null>
}

export function useResearchProtocol(): UseResearchProtocol {
  const saveProtocol = useCallback(
    async (
      sessionId: string,
      payload: {
        research_question: string
        prediction_cutoff: string
        prediction_window: PredictionWindow
        allowed_sources: string[]
        data_license: string
        success_metrics: string[]
      }
    ): Promise<ResearchProtocol | null> => {
      try {
        const protocol = await backend.upsertProtocol(sessionId, payload)
        return protocol
      } catch (err) {
        console.error('[research] failed to save protocol:', err)
        return null
      }
    },
    []
  )

  return { saveProtocol }
}
