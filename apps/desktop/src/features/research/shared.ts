/**
 * 研究功能共享层：类型、常量、纯函数映射
 * @module features/research/shared
 */

// ─── 业务类型 ──────────────────────────────────────────────────────────────

export interface PredictionWindow {
  start: string
  end: string
}

export interface ResearchProtocol {
  id: string
  protocol_version: string
  research_question: string
  prediction_cutoff: string
  prediction_window: PredictionWindow
  allowed_sources: string[]
  data_license: string
  success_metrics: string[]
  created_at: string
  updated_at: string
}

export type CandidateStatus = 'proposed' | 'selected' | 'rejected' | 'deferred'
export type CandidateDecisionType = 'select' | 'reject' | 'defer'

export interface ReasoningStep {
  id: string
  order: number
  premise: string
  conclusion: string
  evidence: string[]
}

export interface CandidateHypothesis {
  id: string
  version: number
  candidate_type: string
  subject: string
  object: string
  statement: string
  prediction_window?: PredictionWindow
  novelty_claim: string
  reasoning_chain: ReasoningStep[]
  evidence_refs: string[]
  status: CandidateStatus
  decision_reason?: string
  created_at: string
}

export interface CandidateSet {
  id: string
  set_index: number
  created_by: string
  created_at: string
  candidates: CandidateHypothesis[]
}

export interface CandidateDecision {
  id: string
  candidate_id: string
  candidate_set_id: string
  decision: CandidateDecisionType
  operator: string
  reason: string
  decided_at: string
}

export interface Experiment {
  id: string
  name: string
  baselines: string[]
  metrics: string[]
  design: string
}

export interface Dataset {
  id: string
  name: string
  type: 'source' | 'target'
  description: string
  source: string
  compliance: string
}

export interface Paper {
  id: string
  title: string
  authors: string[]
  year: number
  journal: string
  doi?: string
  url?: string
  abstract: string
  facts: Fact[]
}

export interface Fact {
  id: string
  paperId: string
  statement: string
  paragraph?: string
}

export interface EvidenceClaim {
  id: string
  source_type: 'paper' | 'uploaded_document' | 'web' | 'dataset' | 'experiment'
  source_id: string
  source_title: string
  statement: string
  quote: string
  locator?: string
  created_at: string
}

export interface ExperimentProtocol {
  id: string
  candidate_id: string
  title: string
  design: string
  status: 'draft' | 'frozen'
  created_by: string
  created_at: string
  frozen_at?: string
  frozen_by?: string
}

export interface WorkflowStep {
  id: string
  agent_name: string
  title: string
  dependencies: string[]
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'skipped'
  attempts: number
  started_at?: string
  completed_at?: string
  error?: string
}

export interface AuditEvent {
  id: string
  session_id: string
  event_type: string
  source: string
  timestamp: string
  node_id?: string
  payload: Record<string, unknown>
}

export interface AgentRun {
  id: string
  session_id: string
  parent_run_id?: string
  agent_name: string
  step_name: string
  status: 'pending' | 'running' | 'done' | 'failed' | 'cancelled'
  input_summary?: string
  output_summary?: string
  error?: string
  duration_ms?: number
  structured_output?: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface ResearchOutput {
  title: string
  abstract: string
  problemStatement: string
  rationale: string
  methods: string
  technicalDetails: string[]
  experiments: Experiment[]
  datasets: Dataset[]
  results: string
  references: Paper[]
}

// ─── UI 状态类型 ──────────────────────────────────────────────────────────

export interface ProcessLogEntry {
  id: string
  time: string
  text: string
  level: 'info' | 'success' | 'warning' | 'error'
}

export interface SessionSummary {
  id: string
  title: string
  status: string
  created_at: string
}

// ─── 常量映射 ──────────────────────────────────────────────────────────────

export const SESSION_STATUS_LABEL: Record<string, string> = {
  idle: '未运行',
  running: '运行中',
  paused: '已暂停',
  completed: '已完成',
  failed: '失败',
}

export const WORKFLOW_STATUS_LABEL: Record<string, string> = {
  pending: '等待中',
  running: '运行中',
  completed: '已完成',
  failed: '失败',
  cancelled: '已取消',
  skipped: '已跳过',
}

export const SOURCE_TYPE_LABEL: Record<string, string> = {
  paper: '论文',
  uploaded_document: '上传文档',
  web: '网页',
  dataset: '数据集',
  experiment: '实验',
}

export const CANDIDATE_STATUS_CONFIG: Record<
  CandidateStatus,
  { label: string; color: string; bg: string }
> = {
  proposed: { label: '待决定', color: 'var(--rc-text-muted)', bg: 'var(--rc-chip-bg)' },
  selected: { label: '已采纳', color: 'var(--rc-badge-success-text)', bg: 'var(--rc-badge-success-bg)' },
  rejected: { label: '已驳回', color: 'var(--rc-badge-danger-text)', bg: 'var(--rc-badge-danger-bg)' },
  deferred: { label: '保留', color: 'var(--rc-badge-warning-text)', bg: 'var(--rc-badge-warning-bg)' },
}

export const EXPERIMENT_STATUS_CONFIG: Record<
  ExperimentProtocol['status'],
  { label: string; color: string; bg: string }
> = {
  draft: { label: '草案', color: 'var(--rc-badge-warning-text)', bg: 'var(--rc-badge-warning-bg)' },
  frozen: { label: '已冻结', color: 'var(--rc-badge-success-text)', bg: 'var(--rc-badge-success-bg)' },
}

export const DEPTH_OPTIONS = [
  { value: 'exploratory' as const, label: '探索性', description: '快速探索，适合初步了解' },
  { value: 'standard' as const, label: '标准', description: '平衡深度与效率' },
  { value: 'deep' as const, label: '深度', description: '深入分析，适合重要课题' },
]

export const LANGUAGE_OPTIONS = [
  { value: 'zh' as const, label: '中文' },
  { value: 'en' as const, label: 'English' },
]

// ─── 纯函数 ──────────────────────────────────────────────────────────────

/**
 * 标准化研究输出，处理后端返回的字段命名差异
 */
export function normalizeResearchOutput(raw: Record<string, unknown>): ResearchOutput {
  return {
    title: (raw.title as string) ?? '研究标题',
    abstract: (raw.abstract as string) ?? '',
    problemStatement: (raw.problemStatement as string) ?? (raw.problem_statement as string) ?? '',
    rationale: (raw.rationale as string) ?? '',
    methods: (raw.methods as string) ?? '',
    technicalDetails: (raw.technicalDetails as string[]) ?? (raw.technical_details as string[]) ?? [],
    experiments: (raw.experiments as Experiment[]) ?? [],
    datasets: (raw.datasets as Dataset[]) ?? [],
    results: (raw.results as string) ?? '',
    references: (raw.references as Paper[]) ?? [],
  }
}

/**
 * 创建处理日志条目
 */
export function createLogEntry(
  text: string,
  level: ProcessLogEntry['level'] = 'info'
): ProcessLogEntry {
  return {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
    text,
    level,
  }
}

/**
 * 格式化作者列表
 */
export function formatAuthors(authors: string[], maxDisplay = 3): string {
  if (authors.length <= maxDisplay) {
    return authors.join(', ')
  }
  return `${authors.slice(0, maxDisplay).join(', ')} et al.`
}
