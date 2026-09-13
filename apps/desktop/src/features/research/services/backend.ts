import { io, type Socket } from 'socket.io-client'
import type {
  AgentRun,
  AuditEvent,
  CandidateDecision,
  CandidateDecisionType,
  CandidateSet,
  EvidenceClaim,
  ExperimentProtocol,
  Paper,
  PredictionWindow,
  ResearchProtocol,
  WorkflowStep,
} from '../shared'

// SwanForge 后端地址，可通过环境变量配置
export const RESEARCH_API_BASE = import.meta.env.VITE_RESEARCH_API_URL || 'http://localhost:3001'

export interface BackendResearchQuestion {
  title: string
  field: string
  subfield: string
  description: string
  depth: 'exploratory' | 'standard' | 'deep'
  iterations: number
  language: 'zh' | 'en'
}

export interface BackendSession {
  id: string
  question: BackendResearchQuestion & { id: string; created_at: string }
  status: string
  overall_progress: number
  current_stage: string
  agent_runs: AgentRun[]
  workflow_steps: WorkflowStep[]
  audit_events: AuditEvent[]
  papers: Paper[]
  facts: unknown[]
  evidence_claims: EvidenceClaim[]
  protocol?: ResearchProtocol
  candidate_sets: CandidateSet[]
  candidate_decisions: CandidateDecision[]
  experiment_protocols: ExperimentProtocol[]
  debate_messages: unknown[]
  iterations: unknown[]
  output?: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface CandidateOverview {
  candidate_sets: CandidateSet[]
  decisions: CandidateDecision[]
  experiment_protocols: ExperimentProtocol[]
}

export interface StreamChunk {
  type: string
  value?: unknown
}

export interface HealthStatus {
  status: string
  timestamp: string
  llm_provider: string
  llm_model: string
  llm_ready: boolean
}

export async function getHealth(): Promise<HealthStatus> {
  const res = await fetch(`${RESEARCH_API_BASE}/health`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`)
  return res.json()
}

let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    socket = io(RESEARCH_API_BASE, { transports: ['websocket', 'polling'] })
  }
  return socket
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}

export function subscribeSession(sessionId: string) {
  getSocket().emit('subscribe', sessionId)
}

export function onChunk(handler: (chunk: StreamChunk) => void) {
  getSocket().on('chunk', handler)
  return () => {
    getSocket().off('chunk', handler)
  }
}

export async function createSession(question: BackendResearchQuestion): Promise<BackendSession> {
  const payload: BackendResearchQuestion = {
    title: question.title,
    field: question.field,
    subfield: question.subfield,
    description: question.description,
    depth: question.depth,
    iterations: question.iterations,
    language: question.language,
  }
  const res = await fetch(`${RESEARCH_API_BASE}/api/research`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`Failed to create session: ${res.status}`)
  return res.json()
}

export async function runWorkflow(sessionId: string, resume = false): Promise<{ accepted: boolean; session_id: string; status: string; resume: boolean }> {
  const res = await fetch(`${RESEARCH_API_BASE}/api/research/${sessionId}/run${resume ? '?resume=true' : ''}`, { method: 'POST' })
  if (!res.ok) throw new Error(`Failed to run workflow: ${res.status}`)
  return res.json()
}

export async function cancelWorkflow(sessionId: string): Promise<{ accepted: boolean; session_id: string; status: string }> {
  const res = await fetch(`${RESEARCH_API_BASE}/api/research/${sessionId}/cancel`, { method: 'POST' })
  if (!res.ok) throw new Error(`Failed to cancel workflow: ${res.status}`)
  return res.json()
}

export async function getSession(sessionId: string): Promise<BackendSession> {
  const res = await fetch(`${RESEARCH_API_BASE}/api/research/${sessionId}`)
  if (!res.ok) throw new Error(`Failed to get session: ${res.status}`)
  return res.json()
}

export async function listSessions(): Promise<BackendSession[]> {
  const res = await fetch(`${RESEARCH_API_BASE}/api/research`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Failed to list sessions: ${res.status}`)
  return res.json()
}

export async function deleteSession(sessionId: string): Promise<{ deleted: boolean; session_id: string }> {
  const res = await fetch(`${RESEARCH_API_BASE}/api/research/${sessionId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Failed to delete session: ${res.status}`)
  return res.json()
}

export async function sendDebateMessage(sessionId: string, content: string): Promise<unknown> {
  const res = await fetch(`${RESEARCH_API_BASE}/api/research/${sessionId}/debate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  })
  if (!res.ok) throw new Error(`Failed to send debate message: ${res.status}`)
  return res.json()
}

export async function getOutput(sessionId: string): Promise<unknown> {
  const res = await fetch(`${RESEARCH_API_BASE}/api/research/${sessionId}/output`)
  if (!res.ok) throw new Error(`Failed to get output: ${res.status}`)
  return res.json()
}

export async function upsertProtocol(
  sessionId: string,
  protocol: {
    research_question: string
    prediction_cutoff: string
    prediction_window: PredictionWindow
    allowed_sources?: string[]
    data_license?: string
    success_metrics?: string[]
    protocol_version?: string
  }
): Promise<ResearchProtocol> {
  const res = await fetch(`${RESEARCH_API_BASE}/api/research/${sessionId}/protocol`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(protocol),
  })
  if (!res.ok) throw new Error(`Failed to save protocol: ${res.status}`)
  return res.json()
}

export async function getCandidates(sessionId: string): Promise<CandidateOverview> {
  const res = await fetch(`${RESEARCH_API_BASE}/api/research/${sessionId}/candidates`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Failed to get candidates: ${res.status}`)
  return res.json()
}

export async function decideCandidate(
  sessionId: string,
  candidateId: string,
  decision: CandidateDecisionType,
  operator: string,
  reason: string
): Promise<CandidateDecision> {
  const res = await fetch(`${RESEARCH_API_BASE}/api/research/${sessionId}/candidates/${candidateId}/decision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision, operator, reason }),
  })
  if (!res.ok) throw new Error(`Failed to record decision: ${res.status}`)
  return res.json()
}

export async function createExperimentDraft(
  sessionId: string,
  candidateId: string,
  operator: string,
  title?: string,
  design?: string
): Promise<ExperimentProtocol> {
  const res = await fetch(`${RESEARCH_API_BASE}/api/research/${sessionId}/candidates/${candidateId}/experiment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operator, title: title ?? '', design: design ?? '' }),
  })
  if (!res.ok) throw new Error(`Failed to create experiment draft: ${res.status}`)
  return res.json()
}

export async function freezeExperiment(
  sessionId: string,
  experimentId: string,
  operator: string
): Promise<ExperimentProtocol> {
  const res = await fetch(`${RESEARCH_API_BASE}/api/research/${sessionId}/experiments/${experimentId}/freeze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operator }),
  })
  if (!res.ok) throw new Error(`Failed to freeze experiment: ${res.status}`)
  return res.json()
}

export function exportUrl(sessionId: string, format: 'markdown' | 'html' | 'docx'): string {
  return `${RESEARCH_API_BASE}/api/export/${sessionId}/${format}`
}

export async function uploadFile(
  sessionId: string,
  file: File
): Promise<{ id: string; originalname: string; size: number; mimetype: string; chunks: number; text_length: number }> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch(`${RESEARCH_API_BASE}/api/upload/${sessionId}`, {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) throw new Error(`Failed to upload file: ${res.status}`)
  return res.json()
}
