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
  // RAG
  chunk_size: string;
  chunk_overlap: string;
  rag_top_k: string;
  // External
  semantic_scholar_api_key: string;
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
