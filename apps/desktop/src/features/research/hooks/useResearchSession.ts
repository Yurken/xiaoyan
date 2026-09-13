/**
 * 研究会话管理 hook
 * 职责：会话 CRUD、列表刷新、URL hash 恢复
 */
import { useState, useCallback, useEffect, useRef } from 'react'
import * as backend from '../services/backend'
import type { BackendResearchQuestion, BackendSession } from '../services/backend'
import type { SessionSummary, ResearchProtocol, CandidateSet, CandidateDecision, ExperimentProtocol } from '../shared'

export interface ResearchSessionState {
  sessionId: string | null
  sessionStatus: string
  question: BackendSession['question'] | null
  questionTitle: string
  protocol: ResearchProtocol | null
  candidateSets: CandidateSet[]
  decisions: CandidateDecision[]
  experimentProtocols: ExperimentProtocol[]
  papers: BackendSession['papers']
  evidenceClaims: BackendSession['evidence_claims']
  sessionList: SessionSummary[]
  llmReady: boolean | null
  backendStatus: 'checking' | 'ready' | 'unavailable'
  backendError: string | null
}

export interface ResearchSessionActions {
  loadSessionList: () => Promise<void>
  selectSession: (sessionId: string) => Promise<void>
  leaveSession: () => void
  createResearch: (payload: BackendResearchQuestion, files: File[]) => Promise<void>
  deleteResearch: (sessionId: string) => Promise<void>
  refreshCandidates: () => Promise<void>
  retryConnection: () => Promise<void>
}

export type UseResearchSession = ResearchSessionState & ResearchSessionActions

export function useResearchSession(): UseResearchSession {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sessionStatus, setSessionStatus] = useState('idle')
  const [question, setQuestion] = useState<BackendSession['question'] | null>(null)
  const [questionTitle, setQuestionTitle] = useState('')
  const [protocol, setProtocol] = useState<ResearchProtocol | null>(null)
  const [candidateSets, setCandidateSets] = useState<CandidateSet[]>([])
  const [decisions, setDecisions] = useState<CandidateDecision[]>([])
  const [experimentProtocols, setExperimentProtocols] = useState<ExperimentProtocol[]>([])
  const [papers, setPapers] = useState<BackendSession['papers']>([])
  const [evidenceClaims, setEvidenceClaims] = useState<BackendSession['evidence_claims']>([])
  const [sessionList, setSessionList] = useState<SessionSummary[]>([])
  const [llmReady, setLlmReady] = useState<boolean | null>(null)
  const [backendStatus, setBackendStatus] = useState<'checking' | 'ready' | 'unavailable'>('checking')
  const [backendError, setBackendError] = useState<string | null>(null)

  // 用于处理竞态的 ref
  const loadSessionRequestRef = useRef(0)

  // 使用 ref 存储函数引用，避免 useEffect 依赖问题
  const loadSessionListRef = useRef<() => Promise<void>>(async () => {})
  const selectSessionRef = useRef<(sid: string) => Promise<void>>(async () => {})

  const loadSessionList = useCallback(async () => {
    try {
      const sessions = await backend.listSessions()
      setSessionList(
        sessions.map((s) => ({
          id: s.id,
          title: s.question?.title ?? '(未命名研究)',
          status: s.status,
          created_at: s.created_at,
        }))
      )
    } catch (err) {
      console.error('[research] failed to list sessions:', err)
    }
  }, [])

  const checkConnection = useCallback(async () => {
    setBackendStatus('checking')
    setBackendError(null)
    try {
      const health = await backend.getHealth()
      setLlmReady(health.llm_ready)
      setBackendStatus('ready')
      await loadSessionList()
    } catch (err) {
      setLlmReady(false)
      setBackendStatus('unavailable')
      setBackendError(err instanceof Error ? err.message : '研究服务连接失败')
    }
  }, [loadSessionList])

  const hydrateSession = useCallback((session: BackendSession) => {
    setSessionId(session.id)
    setSessionStatus(session.status)
    setQuestion(session.question)
    setQuestionTitle(session.question.title)
    setProtocol(session.protocol ?? null)
    setCandidateSets(session.candidate_sets ?? [])
    setDecisions(session.candidate_decisions ?? [])
    setExperimentProtocols(session.experiment_protocols ?? [])
    setPapers(session.papers ?? [])
    setEvidenceClaims(session.evidence_claims ?? [])
  }, [])

  const selectSession = useCallback(
    async (sid: string) => {
      const requestId = ++loadSessionRequestRef.current
      try {
        const session = await backend.getSession(sid)
        // 竞态检查：如果已经有更新的请求在处理，忽略这次结果
        if (requestId !== loadSessionRequestRef.current) return
        hydrateSession(session)
        if (typeof window !== 'undefined') {
          window.location.hash = `research/${sid}`
        }
      } catch (err) {
        console.error('[research] failed to load session:', err)
      }
    },
    [hydrateSession]
  )

  // 更新 ref
  loadSessionListRef.current = loadSessionList
  selectSessionRef.current = selectSession

  // 初始化：检查 LLM 状态和加载会话列表
  useEffect(() => {
    let cancelled = false

    const bootstrap = async () => {
      try {
        const health = await backend.getHealth()
        if (cancelled) return
        setLlmReady(health.llm_ready)
        setBackendStatus('ready')
        setBackendError(null)
        await loadSessionListRef.current()
      } catch (err) {
        if (cancelled) return
        setLlmReady(false)
        setBackendStatus('unavailable')
        setBackendError(err instanceof Error ? err.message : '研究服务连接失败')
        return
      }

      // 从 URL hash 恢复上次查看的研究
      if (typeof window !== 'undefined') {
        const match = window.location.hash.match(/^#research\/(.+)$/)
        if (match?.[1]) {
          await selectSessionRef.current(match[1])
        }
      }
    }

    void bootstrap()

    return () => {
      cancelled = true
    }
  }, [])

  const leaveSession = useCallback(() => {
    setSessionId(null)
    setSessionStatus('idle')
    setQuestion(null)
    setQuestionTitle('')
    setProtocol(null)
    setCandidateSets([])
    setDecisions([])
    setExperimentProtocols([])
    setPapers([])
    setEvidenceClaims([])
    if (typeof window !== 'undefined') {
      history.replaceState(null, '', window.location.pathname)
    }
    void loadSessionList()
  }, [loadSessionList])

  const createResearch = useCallback(
    async (payload: BackendResearchQuestion, files: File[]) => {
      const session = await backend.createSession(payload)
      for (const file of files) {
        try {
          await backend.uploadFile(session.id, file)
        } catch (err) {
          const uploadMessage = err instanceof Error ? err.message : String(err)
          try {
            await backend.deleteSession(session.id)
          } catch (cleanupError) {
            console.error('[research] failed to roll back session after upload failure:', cleanupError)
            await loadSessionList()
            throw new Error(`附件「${file.name}」上传失败，且未能撤销已创建的研究：${uploadMessage}`)
          }
          throw new Error(`附件「${file.name}」上传失败：${uploadMessage}`)
        }
      }
      hydrateSession(session)
      await loadSessionList()
    },
    [hydrateSession, loadSessionList]
  )

  const deleteResearch = useCallback(
    async (sid: string) => {
      await backend.deleteSession(sid)
      if (sessionId === sid) {
        leaveSession()
      } else {
        await loadSessionList()
      }
    },
    [sessionId, leaveSession, loadSessionList]
  )

  const refreshCandidates = useCallback(async () => {
    if (!sessionId) return
    try {
      const data = await backend.getCandidates(sessionId)
      setCandidateSets(data.candidate_sets)
      setDecisions(data.decisions)
      setExperimentProtocols(data.experiment_protocols)
    } catch (err) {
      console.error('[research] failed to refresh candidates:', err)
    }
  }, [sessionId])

  return {
    sessionId,
    sessionStatus,
    question,
    questionTitle,
    protocol,
    candidateSets,
    decisions,
    experimentProtocols,
    papers,
    evidenceClaims,
    sessionList,
    llmReady,
    backendStatus,
    backendError,
    loadSessionList,
    selectSession,
    leaveSession,
    createResearch,
    deleteResearch,
    refreshCandidates,
    retryConnection: checkConnection,
  }
}
