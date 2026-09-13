/**
 * @deprecated 使用 shared.ts 中的类型导出
 * 此文件保留以兼容现有导入
 */
export type {
  PredictionWindow,
  ResearchProtocol,
  CandidateStatus,
  CandidateDecisionType,
  ReasoningStep,
  CandidateHypothesis,
  CandidateSet,
  CandidateDecision,
  Experiment,
  Dataset,
  Paper,
  Fact,
  EvidenceClaim,
  ExperimentProtocol,
  WorkflowStep,
  AuditEvent,
  AgentRun,
  ResearchOutput,
  ProcessLogEntry,
  SessionSummary,
} from './shared'

export {
  SESSION_STATUS_LABEL,
  WORKFLOW_STATUS_LABEL,
  SOURCE_TYPE_LABEL,
  CANDIDATE_STATUS_CONFIG,
  EXPERIMENT_STATUS_CONFIG,
  DEPTH_OPTIONS,
  LANGUAGE_OPTIONS,
  normalizeResearchOutput,
  createLogEntry,
  formatAuthors,
} from './shared'
