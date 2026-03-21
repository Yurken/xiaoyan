export interface Paper {
  id: string;
  title: string;
  authors?: string;
  abstract?: string;
  year?: number;
  venue?: string;
  doi?: string;
  tags?: string[];
  status: string;
  created_at: string;
  updated_at: string;
  analysis?: PaperAnalysis;
  reproduction_guide?: ReproductionGuide;
}

export interface PaperAnalysis {
  id: string;
  research_question?: string;
  core_method?: string;
  experiment_design?: string;
  innovations?: string;
  limitations?: string;
  key_conclusions?: string;
  raw_analysis?: Record<string, unknown>;
  created_at: string;
}

export interface ReproductionGuide {
  id: string;
  environment_setup?: string;
  dependencies?: string;
  dataset_preparation?: string;
  training_process?: string;
  inference_process?: string;
  evaluation_metrics?: string;
  risks_and_notes?: string;
  raw_guide?: Record<string, unknown>;
  created_at: string;
}

export interface ResearchInterest {
  id: string;
  topic: string;
  keywords?: string[];
  learning_path?: LearningPath;
  status: string;
  created_at: string;
}

export interface LearningPath {
  overview?: string;
  prerequisites?: Array<{ name: string; description: string; resources: string[] }>;
  learning_stages?: Array<{
    stage: number;
    title: string;
    duration: string;
    goals: string[];
    topics: string[];
    resources: string[];
  }>;
  classic_papers?: Array<{ title: string; authors: string; year: number; reason: string }>;
  research_directions?: Array<{ direction: string; description: string; open_problems: string[] }>;
  tools_and_frameworks?: string[];
  communities?: string[];
}

export interface KnowledgeNote {
  id: string;
  title: string;
  content: string;
  source_type: string;
  source_id?: string;
  tags?: string[];
  research_interest_id?: string;
  created_at: string;
  updated_at: string;
}

export interface ChatSession {
  id: string;
  title: string;
  context_type: string;
  context_id?: string;
  created_at: string;
  updated_at: string | null;
  messages?: ChatMessage[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Array<{ content: string; source: string }>;
  created_at: string;
}

export type LlmProvider = "openai" | "anthropic" | "openai_compatible";
export type MultiAgentRoutingMode = "rule" | "llm" | "hybrid";

export interface AgentArtifact {
  id: string;
  run_id: string;
  artifact_type: string;
  title: string;
  content: string;
  created_at: string;
}

export interface AgentRun {
  id: string;
  session_id: string;
  request_id: string;
  parent_run_id?: string | null;
  agent_name: string;
  step_name: string;
  status: "pending" | "running" | "done" | "failed";
  order_index: number;
  input_payload?: Record<string, unknown> | null;
  output_payload?: Record<string, unknown> | null;
  summary?: string | null;
  error?: string | null;
  created_at: string;
  updated_at: string;
  artifacts?: AgentArtifact[];
}

export interface AgentPlanStep {
  agent_name: string;
  title: string;
  goal: string;
}

export interface ChatSendResponse {
  success: boolean;
  session_id: string;
  request_id: string;
  message: string;
  sources?: ChatMessage["sources"];
  plan: AgentPlanStep[];
  agent_runs: AgentRun[];
}

export type ChatStreamChunk =
  | { type: "session_id"; value: string }
  | { type: "request_id"; value: string }
  | { type: "plan"; value: AgentPlanStep[] }
  | { type: "agent_start"; value: AgentRun }
  | { type: "agent_complete"; value: AgentRun }
  | { type: "agent_error"; value: AgentRun }
  | { type: "delta"; value: string }
  | { type: "sources"; value: NonNullable<ChatMessage["sources"]> }
  | { type: "error"; value: string }
  | { type: "done" };

export interface AppSettings {
  // Provider
  llm_provider: LlmProvider;
  // OpenAI
  openai_api_key: string;
  openai_base_url: string;
  openai_chat_model: string;
  openai_embedding_model: string;
  // Anthropic
  anthropic_api_key: string;
  anthropic_chat_model: string;
  // OpenAI-Compatible
  openai_compatible_base_url: string;
  openai_compatible_api_key: string;
  openai_compatible_chat_model: string;
  openai_compatible_embedding_model: string;
  // Embedding (optional, overrides provider embedding settings)
  embedding_base_url: string;
  embedding_api_key: string;
  embedding_model: string;
  // RAG
  chunk_size: string;
  chunk_overlap: string;
  rag_top_k: string;
  // External
  semantic_scholar_api_key: string;
  // Multi-agent
  multi_agent_enabled: string;
  multi_agent_routing_mode: MultiAgentRoutingMode;
  multi_agent_enabled_agents: string;
  multi_agent_max_steps: string;
  multi_agent_search_limit: string;
  multi_agent_supervisor_model: string;
  multi_agent_supervisor_temperature: string;
  multi_agent_worker_model: string;
  multi_agent_worker_temperature: string;
  multi_agent_synthesis_model: string;
  multi_agent_synthesis_temperature: string;
}

export interface Job {
  id: string;
  type: string;
  status: "pending" | "running" | "done" | "failed";
  progress: number;
  error?: string;
  created_at: string;
  finished_at?: string;
}
