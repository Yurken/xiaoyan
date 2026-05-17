/**
 * Desktop Tauri client — replaces HTTP SDK with invoke() calls.
 * Implements the same interface as @research-copilot/api-sdk so pages
 * require minimal changes.
 */
import { invoke } from "@tauri-apps/api/core";
import type {
  ArxivRankingMode,
  ArxivSearchRequest,
  ArxivSearchResponse,
  CcfListResponse,
  CcfLookupResponse,
  JournalLookupResponse,
  SourceLookupResponse,
  Paper,
  ChatSession,
  ResearchInterest,
  ResearchInterestProfile,
  ResearchInterestHintRequest,
  ResearchInterestHintResponse,
  KnowledgeNote,
  Skill,
  AppSettings,
  AppUpdateInfo,
  AgentRun,
  SettingsHistoryEntry,
} from "@research-copilot/types";
import { streamChat } from "./chatStream";
export { streamChat } from "./chatStream";
import type {
  CitationCentralityEntry,
  CitationPathResult,
  CitationSubgraph,
  KnowledgeClaimStatus,
  KnowledgeEvidenceRelationKind,
  KnowledgeGraphSnapshot,
} from "../features/knowledge/shared";

// ── Helpers ──────────────────────────────────────────────────────

export function formatErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const normalized = raw.trim();

  if (!normalized) return "操作未完成，请稍后重试。";
  if (/^\?+$/.test(normalized)) {
    return "论文解读未生成有效内容，请检查模型配置或稍后重试。";
  }

  if (/<!doctype html|<html/i.test(normalized)) {
    return "接口返回了网页 HTML，而不是模型 API JSON。请检查自定义 base_url 是否填写为 OpenAI 兼容 API 根地址（通常以 /v1 结尾）。";
  }

  const directMap: Record<string, string> = {
    "Session not found": "未找到对应会话。",
    "Research interest not found": "未找到对应研究主题。",
    "Interest not found": "未找到对应研究主题。",
    "Note not found": "未找到对应笔记。",
    "Paper not found": "未找到对应论文。",
    "Expected object": "请求参数格式不正确。",
  };

  if (directMap[normalized]) return directMap[normalized];

  return normalized
    .replace(/^PDF extraction failed:/i, "PDF 解析失败：")
    .replace(/^error:\s*/i, "");
}

// ── Settings ─────────────────────────────────────────────────────

export const settingsApi = {
  get: (): Promise<AppSettings> => invoke("settings_get"),
  update: (data: Partial<AppSettings>): Promise<{ ok: boolean; updated: string[] }> =>
    invoke("settings_update", { data }),
  test: (data: Partial<AppSettings>): Promise<string> =>
    invoke("settings_test", { data }),
  export: (password: string): Promise<string> =>
    invoke("settings_export", { password }),
  import: (data: string, password: string): Promise<string[]> =>
    invoke("settings_import", { data, password }),
  dataBackup: {
    export: (password: string): Promise<string> =>
      invoke("data_backup_export", { password }),
    import: (data: string, password: string): Promise<void> =>
      invoke("data_backup_import", { data, password }),
  },
  listOllamaModels: (baseUrl?: string): Promise<string[]> =>
    invoke("settings_list_ollama_models", { baseUrl: baseUrl ?? null }),
  appLock: {
    status: (): Promise<{ enabled: boolean; timeoutMinutes: number; hasSecurity: boolean; hasHint: boolean; hasEmail: boolean }> =>
      invoke("app_lock_status"),
    setPassword: (password: string, hint?: string, email?: string): Promise<{ enabled: boolean }> =>
      invoke("app_lock_set_password", { password, hint: hint ?? null, email: email ?? "" }),
    verifyPassword: (password: string): Promise<boolean> =>
      invoke("app_lock_verify_password", { password }),
    clearPassword: (): Promise<{ enabled: boolean }> =>
      invoke("app_lock_clear_password"),
    setTimeout: (minutes: string): Promise<void> =>
      invoke("app_lock_set_timeout", { minutes }),
    getHint: (): Promise<string> =>
      invoke("app_lock_get_hint"),
    getRecoveryInfo: (): Promise<{ hint: string; question: string; hasEmail: boolean; hasSecurity: boolean }> =>
      invoke("app_lock_get_recovery_info"),
    setSecurity: (question: string, answer: string): Promise<void> =>
      invoke("app_lock_set_security", { question, answer }),
    verifyRecovery: (email: string, answer: string): Promise<boolean> =>
      invoke("app_lock_verify_recovery", { email, answer }),
    resetPassword: (email: string, answer: string, newPassword: string): Promise<{ enabled: boolean }> =>
      invoke("app_lock_reset_password", { email, answer, newPassword }),
  },
  history: {
    list: (): Promise<SettingsHistoryEntry[]> =>
      invoke("settings_history_list"),
    save: (data: Partial<AppSettings>, name?: string): Promise<SettingsHistoryEntry> =>
      invoke("settings_history_save", { data, name: name ?? null }),
    apply: (id: string): Promise<AppSettings> =>
      invoke("settings_history_apply", { id }),
    delete: (id: string): Promise<void> =>
      invoke("settings_history_delete", { id }),
  },
};

export const updatesApi = {
  check: (): Promise<AppUpdateInfo> => invoke("update_check"),
  install: (): Promise<void> => invoke("update_install"),
};

// ── Papers ───────────────────────────────────────────────────────

export const papersApi = {
  list: (offset = 0, limit = 20, research_interest_id?: string): Promise<Paper[]> =>
    invoke("papers_list", { offset, limit, researchInterestId: research_interest_id ?? null }),
  get: (id: string): Promise<Paper> =>
    invoke("papers_get", { id }),
  listParseRuns: (paper_id: string): Promise<{ runs: unknown[] }> =>
    invoke("papers_list_parse_runs", { paperId: paper_id }),
  upload: (filePath: string, research_interest_id?: string): Promise<{ paper_id: string; title: string }> =>
    invoke("papers_upload", { filePath, researchInterestId: research_interest_id ?? null }),
  update: (id: string, data: { title?: string; authors?: string; venue?: string; year?: number; doi?: string; research_interest_id?: string; importance_color?: string; notes?: string }): Promise<Paper> =>
    invoke("papers_update", {
      id,
      title: data.title ?? null,
      authors: data.authors ?? null,
      venue: data.venue ?? null,
      year: data.year ?? null,
      doi: data.doi ?? null,
      researchInterestId: data.research_interest_id ?? null,
      importanceColor: data.importance_color ?? null,
      notes: data.notes ?? null,
    }),
  delete: (id: string): Promise<void> =>
    invoke("papers_delete", { id }),
  openFile: (id: string): Promise<void> =>
    invoke("papers_open_pdf", { id }),
  analyze: (id: string): Promise<void> =>
    invoke("papers_analyze", { id }),
  reparse: (id: string): Promise<void> =>
    invoke("papers_reparse", { id }),
  reproduce: (id: string): Promise<void> =>
    invoke("papers_reproduce", { id }),
  listFigures: (paper_id: string): Promise<Array<{ id: string; paper_id: string; fig_index: number; kind?: string; caption: string | null; data_url: string }>> =>
    invoke("papers_list_figures", { paperId: paper_id }),
  extractPdfText: (filePath: string, max_chars = 32000): Promise<string> =>
    invoke("papers_extract_pdf_text", { filePath, maxChars: max_chars }),
};

export const ccfApi = {
  list: (): Promise<CcfListResponse> =>
    invoke("ccf_list"),
  lookup: (query: string, limit = 8): Promise<CcfLookupResponse> =>
    invoke("ccf_lookup", { query, limit }),
};

export const journalApi = {
  lookup: (query: string, limit = 8): Promise<JournalLookupResponse> =>
    invoke("journal_lookup", { query, limit }),
  rankFilter: (wosCatKeywords: string[], ranks: string[]): Promise<string[]> =>
    invoke("journal_rank_filter", { wosCatKeywords, ranks }),
};

export const sourceApi = {
  lookup: (query: string, limit = 8): Promise<SourceLookupResponse> =>
    invoke("source_lookup", { query, limit }),
};

export const arxivApi = {
  search: (
    request: ArxivSearchRequest,
    days = 14,
    limit = 5,
    ranking_mode: ArxivRankingMode = "relevance"
  ): Promise<ArxivSearchResponse> =>
    invoke("arxiv_search", { request, days, limit, rankingMode: ranking_mode }),
};

export const paperSearchApi = {
  search: (
    request: ArxivSearchRequest,
    days = 14,
    limit = 5,
    ranking_mode: ArxivRankingMode = "relevance"
  ): Promise<ArxivSearchResponse> =>
    invoke("paper_search", { request, days, limit, rankingMode: ranking_mode }),
};

// ── Knowledge ─────────────────────────────────────────────────────

export const knowledgeApi = {
  listInterests: (): Promise<ResearchInterest[]> =>
    invoke("knowledge_list_interests"),
  createInterest: (
    topic: string,
    keywords: string[],
    profile?: ResearchInterestProfile
  ): Promise<ResearchInterest> =>
    invoke("knowledge_create_interest", { topic, keywords, profile: profile ?? null }),
  updateInterestFolder: (id: string, folder_name: string): Promise<ResearchInterest> =>
    invoke("knowledge_update_interest_folder", { id, folderName: folder_name }),
  deleteInterestBundle: (id: string): Promise<{ deleted_interest_id: string; deleted_sessions: number; deleted_notes: number; deleted_papers: number }> =>
    invoke("knowledge_delete_interest_bundle", { id }),
  deleteInterestOnly: (id: string): Promise<{ deleted_interest_id: string }> =>
    invoke("knowledge_delete_interest_only", { id }),
  generateInterestHints: (data: ResearchInterestHintRequest): Promise<ResearchInterestHintResponse> =>
    invoke("knowledge_generate_interest_hints", {
      topic: data.topic,
      keywords: data.keywords ?? null,
      goal: data.goal ?? null,
      background: data.background ?? null,
      timeBudget: data.time_budget ?? null,
      constraints: data.constraints ?? null,
      knownContext: data.known_context ?? null,
      preferredOutput: data.preferred_output ?? null,
    }),
  suggestTopics: (field: string, goalType: string, background: string): Promise<string[]> =>
    invoke("knowledge_suggest_topics", { field, goalType: goalType, background }),
  generatePlan: (id: string, startStep?: number): Promise<void> =>
    invoke("knowledge_generate_plan", { id, startStep: startStep ?? null }),
  listNotes: (search?: string): Promise<KnowledgeNote[]> =>
    invoke("knowledge_list_notes", { search: search ?? null }),
  createNote: (data: {
    title: string;
    content: string;
    tags?: string[];
    research_interest_id?: string;
  }): Promise<KnowledgeNote> =>
    invoke("knowledge_create_note", {
      title: data.title,
      content: data.content,
      tags: data.tags ?? null,
      researchInterestId: data.research_interest_id ?? null,
    }),
  updateNote: (id: string, data: { title?: string; content?: string; tags?: string[] }): Promise<KnowledgeNote> =>
    invoke("knowledge_update_note", {
      id,
      title: data.title ?? null,
      content: data.content ?? null,
      tags: data.tags ?? null,
    }),
  moveNote: (id: string, research_interest_id?: string): Promise<KnowledgeNote> =>
    invoke("knowledge_move_note", {
      id,
      researchInterestId: research_interest_id ?? null,
    }),
  deleteNote: (id: string): Promise<void> =>
    invoke("knowledge_delete_note", { id }),
  search: (q: string, topK = 5): Promise<{ id: string; content: string; source: string; score: number }[]> =>
    invoke("knowledge_search", { q, topK }),
  webClip: (url: string, researchInterestId?: string): Promise<KnowledgeNote> =>
    invoke("knowledge_web_clip", { url, researchInterestId: researchInterestId ?? null }),
  graph: {
    snapshot: (): Promise<KnowledgeGraphSnapshot> =>
      invoke("knowledge_graph_snapshot"),
    createClaim: (data: {
      title: string;
      statement: string;
      researchInterestId?: string;
      status?: KnowledgeClaimStatus;
    }) =>
      invoke("knowledge_graph_create_claim", {
        title: data.title,
        statement: data.statement,
        researchInterestId: data.researchInterestId ?? null,
        status: data.status ?? null,
      }),
    deleteClaim: (id: string) =>
      invoke<void>("knowledge_graph_delete_claim", { id }),
    createEvidence: (data: {
      claimId: string;
      sourceKind: "paper" | "experiment" | "note";
      sourceId: string;
      relationKind?: KnowledgeEvidenceRelationKind;
      evidenceSummary?: string;
    }) =>
      invoke("knowledge_graph_create_evidence", {
        claimId: data.claimId,
        sourceKind: data.sourceKind,
        sourceId: data.sourceId,
        relationKind: data.relationKind ?? null,
        evidenceSummary: data.evidenceSummary ?? null,
      }),
    deleteEvidence: (id: string) =>
      invoke<void>("knowledge_graph_delete_evidence", { id }),
    createCitation: (data: {
      citingPaperId: string;
      citedPaperId: string;
      context?: string;
    }) =>
      invoke("knowledge_graph_create_citation", {
        citingPaperId: data.citingPaperId,
        citedPaperId: data.citedPaperId,
        context: data.context ?? null,
      }),
    deleteCitation: (id: string) =>
      invoke<void>("knowledge_graph_delete_citation", { id }),
    citationCentrality: (limit?: number): Promise<CitationCentralityEntry[]> =>
      invoke("knowledge_graph_citation_centrality", { limit: limit ?? null }),
    citationShortestPath: (fromPaperId: string, toPaperId: string): Promise<CitationPathResult | null> =>
      invoke("knowledge_graph_citation_shortest_path", {
        fromPaperId,
        toPaperId,
      }),
    citationSubgraph: (seedPaperIds: string[], radius?: number, maxNodes?: number): Promise<CitationSubgraph> =>
      invoke("knowledge_graph_citation_subgraph", {
        seedPaperIds,
        radius: radius ?? null,
        maxNodes: maxNodes ?? null,
      }),
  },
};

// ── Chat / Streaming ──────────────────────────────────────────────

export const chatApi = {
  listSessions: (): Promise<ChatSession[]> => invoke("chat_list_sessions"),
  getSession: (id: string): Promise<ChatSession> => invoke("chat_get_session", { id }),
  deleteSession: (id: string): Promise<void> => invoke("chat_delete_session", { id }),
  updateSessionContext: (id: string, interestId?: string): Promise<ChatSession> =>
    invoke("chat_update_session_context", {
      id,
      contextType: interestId ? "interest" : "general",
      contextId: interestId ?? null,
    }),
  listAgentRuns: (sessionId: string, requestId?: string): Promise<AgentRun[]> =>
    invoke("chat_list_agent_runs", { sessionId, requestId: requestId ?? null }),
  stream: streamChat,
};

// ── Planner ───────────────────────────────────────────────────────

export const plannerApi = {
  generate: (topic: string, keywords: string[]): Promise<void> =>
    invoke("planner_generate", { topic, keywords }),
};

// ── Survey ────────────────────────────────────────────────────────

export const surveyApi = {
  generate: (
    query: string,
    maxPapers = 20,
    timeFrom?: number,
    timeTo?: number,
    litTypes?: string[],
    databases?: string[],
    citationFormat?: string,
    language?: string,
    paperIds?: string[],
    requestId?: string,
  ): Promise<void> =>
    invoke("survey_generate", {
      query,
      maxPapers,
      timeFrom: timeFrom ?? null,
      timeTo: timeTo ?? null,
      litTypes: litTypes ?? null,
      databases: databases ?? null,
      citationFormat: citationFormat ?? null,
      language: language ?? null,
      paperIds: paperIds ?? null,
      requestId: requestId ?? null,
    }),
  search: (query: string, limit = 20): Promise<unknown[]> =>
    invoke("survey_search", { query, limit }),
};

// ── Translate ─────────────────────────────────────────────────────

export const translateApi = {
  translate: (text: string, targetLang: string, sourceLang?: string): Promise<string> =>
    invoke("translate_text", { text, targetLang, sourceLang: sourceLang ?? null }),
};

// ── Markdown Format ───────────────────────────────────────────────

export const markdownApi = {
  formatChunk: (
    text: string,
    styleSummary: string,
  ): Promise<{ formatted: string; styleSummary: string }> =>
    invoke("markdown_format_chunk", { text, styleSummary }),
};

// ── Memory ────────────────────────────────────────────────────────

export type MemoryType = "auto" | "manual";

export interface UserMemory {
  id: string;
  type: MemoryType;
  action: string | null;
  summary: string;
  detail: string | null;
  created_at: string;
}

export interface MemoryObservation {
  id: string;
  event_id: string;
  session_id: string | null;
  run_id: string | null;
  source: string;
  event_type: string;
  title: string;
  summary: string;
  narrative: string;
  importance: number;
  created_at: string;
  score?: number;
}

export interface MemoryCheckpoint {
  id: string;
  session_id: string;
  request_id: string | null;
  context_type: string;
  context_id: string | null;
  goal: string;
  summary: string;
  completed_items: string[];
  open_questions: string[];
  next_steps: string[];
  status: string;
  created_at: string;
  updated_at: string;
}

export interface MemoryCheckpointListResponse {
  checkpoints: MemoryCheckpoint[];
}

export interface MemoryPrivacyStatus {
  enabled: boolean;
}

export const memoryApi = {
  add: (data: { type: MemoryType; action?: string; summary: string; detail?: string }): Promise<{ id: string }> =>
    invoke("memory_add", {
      type: data.type,
      action: data.action ?? null,
      summary: data.summary,
      detail: data.detail ?? null,
    }),
  list: (params?: { mem_type?: MemoryType; limit?: number; offset?: number }): Promise<UserMemory[]> =>
    invoke("memory_list", {
      memType: params?.mem_type ?? null,
      limit: params?.limit ?? 50,
      offset: params?.offset ?? 0,
    }),
  listManualRecords: (params?: { limit?: number; offset?: number }): Promise<UserMemory[]> =>
    invoke("memory_list_manual_records", {
      limit: params?.limit ?? 100,
      offset: params?.offset ?? 0,
    }),
  listAutoRecords: (params?: { password?: string; limit?: number; offset?: number }): Promise<UserMemory[]> =>
    invoke("memory_list_auto_records", {
      password: params?.password ?? null,
      limit: params?.limit ?? 100,
      offset: params?.offset ?? 0,
    }),
  listObservations: (params?: { limit?: number; offset?: number }): Promise<MemoryObservation[]> =>
    invoke("memory_list_observations", {
      limit: params?.limit ?? 30,
      offset: params?.offset ?? 0,
    }),
  listPrivateObservations: (params?: { password?: string; limit?: number; offset?: number }): Promise<MemoryObservation[]> =>
    invoke("memory_list_private_observations", {
      password: params?.password ?? null,
      limit: params?.limit ?? 50,
      offset: params?.offset ?? 0,
    }),
  searchObservations: (query: string, limit = 6): Promise<MemoryObservation[]> =>
    invoke("memory_search_observations", {
      query,
      limit,
    }),
  listCheckpoints: (limit = 8): Promise<MemoryCheckpointListResponse> =>
    invoke("memory_list_checkpoints", { limit }),
  privacyStatus: (): Promise<MemoryPrivacyStatus> =>
    invoke("memory_privacy_status"),
  setPrivacyPassword: (password: string): Promise<MemoryPrivacyStatus> =>
    invoke("memory_privacy_set_password", { password }),
  verifyPrivacyPassword: (password: string): Promise<boolean> =>
    invoke("memory_privacy_verify_password", { password }),
  clearPrivacyPassword: (): Promise<MemoryPrivacyStatus> =>
    invoke("memory_privacy_clear_password"),
  delete: (id: string): Promise<void> =>
    invoke("memory_delete", { id }),
  clearAuto: (): Promise<void> =>
    invoke("memory_clear_auto"),
  buildContext: (): Promise<string> =>
    invoke("memory_build_context"),
};

// ── Skills ────────────────────────────────────────────────────────

export const skillsApi = {
  list: (): Promise<Skill[]> =>
    invoke("skills_list"),
  create: (data: {
    name: string;
    title: string;
    description: string;
    prompt: string;
    tags?: string[];
  }): Promise<Skill> =>
    invoke("skills_create", {
      name: data.name,
      title: data.title,
      description: data.description,
      prompt: data.prompt,
      tags: data.tags ?? null,
    }),
  update: (
    id: string,
    data: {
      title?: string;
      description?: string;
      prompt?: string;
      tags?: string[];
      is_enabled?: boolean;
    }
  ): Promise<Skill> =>
    invoke("skills_update", {
      id,
      title: data.title ?? null,
      description: data.description ?? null,
      prompt: data.prompt ?? null,
      tags: data.tags ?? null,
      isEnabled: data.is_enabled ?? null,
    }),
  delete: (id: string): Promise<void> =>
    invoke("skills_delete", { id }),
  resetBuiltins: (): Promise<Skill[]> =>
    invoke("skills_reset_builtins"),
};

// ── Submission API ────────────────────────────────────────────────

export const submissionApi = {
  listVenues: (params?: { search?: string; starredOnly?: boolean }) =>
    invoke<{ venues: unknown[] }>("submission_list_venues", {
      search: params?.search ?? null,
      starredOnly: params?.starredOnly ?? null,
    }),
  createVenue: (params: {
    name: string; fullName?: string; venueType?: string; website?: string;
    ccf?: string; area?: string; ei?: boolean; sci?: boolean; sciQuartile?: string;
    deadline?: string; notificationDate?: string; specialIssueDeadline?: string; specialIssueTitle?: string;
  }) => invoke<{ id: string }>("submission_create_venue", {
    name: params.name, fullName: params.fullName ?? null, venueType: params.venueType ?? null,
    website: params.website ?? null, ccf: params.ccf ?? null, area: params.area ?? null,
    ei: params.ei ?? null, sci: params.sci ?? null, sciQuartile: params.sciQuartile ?? null,
    deadline: params.deadline ?? null, notificationDate: params.notificationDate ?? null,
    specialIssueDeadline: params.specialIssueDeadline ?? null, specialIssueTitle: params.specialIssueTitle ?? null,
  }),
  updateVenue: (id: string, params: Partial<{ name: string; fullName: string; venueType: string; website: string; ccf: string; area: string; ei: boolean; sci: boolean; sciQuartile: string; deadline: string; notificationDate: string; specialIssueDeadline: string; specialIssueTitle: string }>) =>
    invoke<void>("submission_update_venue", { id, ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, v ?? null])) }),
  deleteVenue: (id: string) => invoke<void>("submission_delete_venue", { id }),
  toggleVenueStar: (id: string) => invoke<void>("submission_toggle_venue_star", { id }),

  list: () => invoke<{ submissions: unknown[] }>("submission_list"),
  create: (params: { title: string; venueName?: string; venueType?: string; status?: string; deadline?: string }) =>
    invoke<{ id: string }>("submission_create", {
      title: params.title, venueName: params.venueName ?? null,
      venueType: params.venueType ?? null, status: params.status ?? null, deadline: params.deadline ?? null,
    }),
  update: (id: string, params: Partial<{ title: string; venueName: string; venueType: string; status: string; deadline: string; submittedAt: string }>) =>
    invoke<void>("submission_update", { id, ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, v ?? null])) }),
  delete: (id: string) => invoke<void>("submission_delete", { id }),

  listVersions: (submissionId: string) => invoke<{ versions: unknown[] }>("submission_list_versions", { submissionId }),
  createVersion: (params: { submissionId: string; tag?: string; label?: string; stage?: string; content?: string; notes?: string; filePath?: string; fileName?: string }) =>
    invoke<{ id: string }>("submission_create_version", {
      submissionId: params.submissionId, tag: params.tag ?? null, label: params.label ?? null,
      stage: params.stage ?? null, content: params.content ?? null, notes: params.notes ?? null,
      filePath: params.filePath ?? null, fileName: params.fileName ?? null,
    }),
  updateVersion: (id: string, params: Partial<{ tag: string; label: string; stage: string; content: string; notes: string; filePath: string; fileName: string }>) =>
    invoke<void>("submission_update_version", {
      id,
      ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, v ?? null])),
    }),
  deleteVersion: (id: string) => invoke<void>("submission_delete_version", { id }),

  listRounds: (submissionId: string) => invoke<{ rounds: unknown[] }>("submission_list_rounds", { submissionId }),
  upsertRound: (params: { submissionId: string; round: number; verdict?: string; receivedAt?: string }) =>
    invoke<{ id: string }>("submission_upsert_round", {
      submissionId: params.submissionId, round: params.round,
      verdict: params.verdict ?? null, receivedAt: params.receivedAt ?? null,
    }),

  listComments: (submissionId: string, round?: number) =>
    invoke<{ comments: unknown[] }>("submission_list_comments", { submissionId, round: round ?? null }),
  createComment: (params: { submissionId: string; round: number; reviewer?: string; content: string; response?: string; tags?: string[] }) =>
    invoke<{ id: string }>("submission_create_comment", {
      submissionId: params.submissionId, round: params.round, reviewer: params.reviewer ?? null,
      content: params.content, response: params.response ?? null, tags: params.tags ?? null,
    }),
  updateComment: (id: string, params: Partial<{ content: string; response: string; resolved: boolean; tags: string[] }>) =>
    invoke<void>("submission_update_comment", { id, ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, v ?? null])) }),
  deleteComment: (id: string) => invoke<void>("submission_delete_comment", { id }),

  getChecklist: (submissionId: string) => invoke<{ checklist: unknown[] }>("submission_get_checklist", { submissionId }),
  toggleChecklist: (itemId: string) => invoke<void>("submission_toggle_checklist", { itemId }),
  listDiagnosisReports: (submissionId: string) =>
    invoke<{ reports: unknown[] }>("submission_list_diagnosis_reports", { submissionId }),
  importDiagnosisReportToChecklist: (reportId: string) =>
    invoke<{ created: number }>("submission_import_diagnosis_report_to_checklist", { reportId }),
  listRevisionTasks: (submissionId: string) =>
    invoke<{ tasks: unknown[] }>("submission_list_revision_tasks", { submissionId }),
  importDiagnosisReportToTasks: (reportId: string) =>
    invoke<{ created: number }>("submission_import_diagnosis_report_to_tasks", { reportId }),
  updateRevisionTask: (id: string, params: Partial<{ status: string; paperVersionId: string; experimentId: string }>) =>
    invoke<void>("submission_update_revision_task", {
      id,
      status: params.status ?? null,
      paperVersionId: params.paperVersionId ?? null,
      experimentId: params.experimentId ?? null,
    }),

  stats: () => invoke<{ active: number; pendingReviews: number; upcomingDdls: { name: string; deadline: string }[] }>("submission_stats"),

  aiReview: (params: { submissionId: string; content: string; reviewerCount: number; strictness: string }) =>
    invoke<void>("submission_ai_review", {
      submissionId: params.submissionId, content: params.content,
      reviewerCount: params.reviewerCount, strictness: params.strictness,
    }),
  polishAbstract: (submissionId: string, text: string) =>
    invoke<void>("submission_polish_abstract", { submissionId, text }),
  generateCoverLetter: (submissionId: string) =>
    invoke<void>("submission_generate_cover_letter", { submissionId }),
  syncCcfDdl: () =>
    invoke<{ fetched: number; updated: number }>("submission_sync_ccfddl"),
  syncCcfDdlLocal: () =>
    invoke<{ fetched: number; updated: number }>("submission_sync_ccfddl_local"),
};

// ── Experiment API ────────────────────────────────────────────────

export interface ExperimentAttachment {
  id: string;
  experimentId: string;
  filePath: string;
  label: string;
  dataUrl: string;
  createdAt: string;
}

export const experimentApi = {
  list: () => invoke<{ experiments: unknown[] }>("experiment_list"),
  get: (id: string) => invoke<unknown>("experiment_get", { id }),
  create: (params: { title: string; config?: Record<string, unknown>; result?: string; notes?: string; linkedSubmissionId?: string }) =>
    invoke<{ id: string }>("experiment_create", {
      title: params.title, config: params.config ?? null,
      result: params.result ?? null, notes: params.notes ?? null,
      linkedSubmissionId: params.linkedSubmissionId ?? null,
    }),
  update: (id: string, params: Partial<{ title: string; config: Record<string, unknown>; result: string; notes: string; linkedSubmissionId: string }>) =>
    invoke<void>("experiment_update", { id, ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, v ?? null])) }),
  delete: (id: string) => invoke<void>("experiment_delete", { id }),
  attachments: {
    list: (experimentId: string) =>
      invoke<{ attachments: ExperimentAttachment[] }>("experiment_list_attachments", { experimentId }),
    add: (experimentId: string, filePath: string, label?: string) =>
      invoke<ExperimentAttachment>("experiment_add_attachment", { experimentId, filePath, label: label ?? null }),
    updateLabel: (id: string, label: string) =>
      invoke<void>("experiment_update_attachment_label", { id, label }),
    delete: (id: string) =>
      invoke<void>("experiment_delete_attachment", { id }),
  },
};

// ── Workbench API ──────────────────────────────────────────────────

export const workbenchApi = {
  getOverviewTextCache: () =>
    invoke<{
      heroTitle: string;
      heroDescription: string;
      summaryItems: Array<{ title: string; description: string }>;
    } | null>("workbench_get_overview_text_cache"),
  generateOverviewText: (sourceJson: string) =>
    invoke<{
      heroTitle: string;
      heroDescription: string;
      summaryItems: Array<{ title: string; description: string }>;
    }>("workbench_generate_overview_text", { sourceJson }),
};

// ── Writing API ───────────────────────────────────────────────────

export interface WritingCompileResult {
  success: boolean;
  pdfPath: string | null;
  workDir: string;
  engine: string;
  log: string;
}

export const writingApi = {
  compilePdf: (project: { projectName: string; mainTex: string; bibtex: string; notes: string }) =>
    invoke<WritingCompileResult>("writing_compile_pdf", { request: project }),
  copyPdf: (pdfPath: string, destinationPath: string) =>
    invoke<void>("writing_copy_pdf", { pdfPath, destinationPath }),
  openCompiledPdf: (pdfPath: string) =>
    invoke<void>("writing_open_compiled_pdf", { pdfPath }),
  openMactexInstaller: () =>
    invoke<void>("writing_open_mactex_installer"),
  openMactexDownloadPage: () =>
    invoke<void>("writing_open_mactex_download_page"),
};

// ── Export API ────────────────────────────────────────────────────

export const exportApi = {
  toObsidian: (vaultPath: string) =>
    invoke<{ notes: number; papers: number; exportPath: string }>("export_to_obsidian", { vaultPath }),
};

// ── Unified client (mirrors api-sdk shape) ────────────────────────

export const apiClient = {
  memory: memoryApi,
  arxiv: arxivApi,
  paperSearch: paperSearchApi,
  ccf: ccfApi,
  journals: journalApi,
  sources: sourceApi,
  settings: settingsApi,
  translate: translateApi,
  markdown: markdownApi,
  updates: updatesApi,
  papers: papersApi,
  knowledge: knowledgeApi,
  chat: chatApi,
  planner: plannerApi,
  survey: surveyApi,
  skills: skillsApi,
  submission: submissionApi,
  experiment: experimentApi,
  export: exportApi,
  workbench: workbenchApi,
  writing: writingApi,
};
