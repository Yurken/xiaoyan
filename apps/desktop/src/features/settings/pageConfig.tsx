import type { ComponentType } from "react";
import {
  Brain,
  Compass,
  Database,
  Info,
  LayoutDashboard,
  Layers3,
  Zap,
} from "lucide-react";
import type { AppSettings } from "@research-copilot/types";
import { DEFAULT_PAPER_TAG_VISIBILITY_VALUE } from "../../lib/paperTags";

// 设置页当前分区的持久化 key，导航到「快速开始」分区时也会写入它。
export const SETTINGS_ACTIVE_SECTION_STORAGE_KEY = "rc:settings:active-section";

export type SettingsSectionKey =
  | "guided"
  | "assistant"
  | "paper_tags"
  | "skills"
  | "history"
  | "memory"
  | "about"
  | "layout";

export const SETTINGS_SECTIONS: Array<{
  key: SettingsSectionKey;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  color: string;
}> = [
  {
    key: "guided",
    label: "快速开始",
    description: "三步完成初始配置",
    icon: Compass,
    color: "#34C759",
  },
  {
    key: "assistant",
    label: "小妍",
    description: "连接方式、默认模型与任务分工",
    icon: Brain,
    color: "#AF52DE",
  },
  {
    key: "paper_tags",
    label: "论文导入",
    description: "自动识别与标签展示",
    icon: Layers3,
    color: "#FF9F0A",
  },
  {
    key: "skills",
    label: "技能模板",
    description: "提示词技能管理",
    icon: Zap,
    color: "#FF375F",
  },
  {
    key: "layout",
    label: "界面布局",
    description: "功能入口与界面形态",
    icon: LayoutDashboard,
    color: "#30B0C7",
  },
  {
    key: "memory",
    label: "记忆管理",
    description: "查看与管理小妍的记忆",
    icon: Brain,
    color: "#FFD60A",
  },
  {
    key: "history",
    label: "数据与配置",
    description: "配置历史、导入导出与全量备份",
    icon: Database,
    color: "#0A84FF",
  },
  {
    key: "about",
    label: "升级与日志",
    description: "版本与更新日志",
    icon: Info,
    color: "#5AC8FA",
  },
];

export function SettingsSectionTab({
  icon: Icon,
  color,
  label,
  description,
  active,
  onClick,
}: {
  icon: ComponentType<{ className?: string }>;
  color: string;
  label: string;
  description: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={description}
      className="min-w-0 rounded-[22px] px-2.5 py-2 text-left transition-all duration-150 active:scale-[0.98]"
      style={
        active
          ? {
              background: "color-mix(in srgb, var(--rc-accent) 10%, var(--rc-elevated))",
              border: "1px solid color-mix(in srgb, var(--rc-accent) 24%, var(--rc-border))",
              boxShadow: "var(--rc-card-flat-shadow)",
            }
          : {
              background: "transparent",
              border: "1px solid transparent",
              boxShadow: "none",
            }
      }
    >
      <div className="flex min-w-0 items-center justify-center gap-2">
        <span
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-xl transition-colors"
          style={{
            background: active ? `color-mix(in srgb, ${color} 14%, transparent)` : "transparent",
            color: active ? color : `color-mix(in srgb, ${color} 55%, transparent)`,
          }}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span
          className="min-w-0 truncate text-[13px] font-semibold leading-none"
          style={{ color: active ? "var(--rc-text)" : "var(--rc-text-muted)" }}
        >
          {label}
        </span>
      </div>
    </button>
  );
}

export const DEFAULT_SETTINGS: AppSettings = {
  llm_provider: "openai_compatible",
  openai_api_key: "",
  openai_base_url: "https://api.openai.com/v1",
  openai_chat_model: "gpt-4o-mini",
  openai_embedding_model: "text-embedding-3-small",
  anthropic_api_key: "",
  anthropic_chat_model: "claude-3-5-haiku-20241022",
  openai_compatible_base_url: "",
  openai_compatible_api_key: "",
  openai_compatible_chat_model: "deepseek-chat",
  openai_compatible_embedding_model: "BAAI/bge-m3",
  embedding_base_url: "",
  embedding_api_key: "",
  embedding_model: "",
  chunk_size: "800",
  chunk_overlap: "150",
  rag_top_k: "5",
  paper_search_engine: "arxiv",
  github_api_key: "",
  semantic_scholar_api_key: "",
  planner_hint_model: "",
  planner_hint_base_url: "",
  planner_hint_api_key: "",
  planner_hint_temperature: "0.2",
  planner_hint_top_p: "",
  planner_hint_max_tokens: "16384",
  planner_hint_presence_penalty: "",
  planner_hint_frequency_penalty: "",
  planner_analysis_model: "",
  planner_analysis_base_url: "",
  planner_analysis_api_key: "",
  planner_analysis_temperature: "0.2",
  planner_analysis_top_p: "",
  planner_analysis_max_tokens: "16384",
  planner_analysis_presence_penalty: "",
  planner_analysis_frequency_penalty: "",
  planner_generation_model: "",
  planner_generation_base_url: "",
  planner_generation_api_key: "",
  planner_generation_temperature: "0.3",
  planner_generation_top_p: "",
  planner_generation_max_tokens: "16384",
  planner_generation_presence_penalty: "",
  planner_generation_frequency_penalty: "",
  survey_planner_model: "",
  survey_planner_base_url: "",
  survey_planner_api_key: "",
  survey_planner_temperature: "0.2",
  survey_planner_top_p: "",
  survey_planner_max_tokens: "16384",
  survey_planner_presence_penalty: "",
  survey_planner_frequency_penalty: "",
  survey_writer_model: "",
  survey_writer_base_url: "",
  survey_writer_api_key: "",
  survey_writer_temperature: "0.3",
  survey_writer_top_p: "",
  survey_writer_max_tokens: "16384",
  survey_writer_presence_penalty: "",
  survey_writer_frequency_penalty: "",
  paper_analysis_model: "",
  paper_analysis_base_url: "",
  paper_analysis_api_key: "",
  paper_analysis_temperature: "0.3",
  paper_analysis_top_p: "",
  paper_analysis_max_tokens: "16384",
  paper_analysis_presence_penalty: "",
  paper_analysis_frequency_penalty: "",
  paper_reproduction_model: "",
  paper_reproduction_base_url: "",
  paper_reproduction_api_key: "",
  paper_reproduction_temperature: "0.25",
  paper_reproduction_top_p: "",
  paper_reproduction_max_tokens: "16384",
  paper_reproduction_presence_penalty: "",
  paper_reproduction_frequency_penalty: "",
  copilot_simple_model: "",
  copilot_simple_base_url: "",
  copilot_simple_api_key: "",
  copilot_simple_temperature: "0.4",
  copilot_simple_top_p: "",
  copilot_simple_max_tokens: "16384",
  copilot_simple_presence_penalty: "",
  copilot_simple_frequency_penalty: "",
  xiaoyan_long_term_memory_enabled: "true",
  xiaoyan_companion_id: "xiaoyan",
  xiaoyan_active_researcher_enabled: "true",
  multi_agent_enabled: "true",
  multi_agent_routing_mode: "hybrid",
  multi_agent_enabled_agents: "retrieval,planner,literature_scout,survey,paper_analyst,reproduction,synthesis",
  multi_agent_max_steps: "6",
  multi_agent_search_limit: "8",
  multi_agent_supervisor_model: "",
  multi_agent_supervisor_base_url: "",
  multi_agent_supervisor_api_key: "",
  multi_agent_supervisor_temperature: "0.1",
  multi_agent_supervisor_top_p: "",
  multi_agent_supervisor_max_tokens: "16384",
  multi_agent_supervisor_presence_penalty: "",
  multi_agent_supervisor_frequency_penalty: "",
  multi_agent_worker_model: "",
  multi_agent_worker_base_url: "",
  multi_agent_worker_api_key: "",
  multi_agent_worker_temperature: "0.3",
  multi_agent_worker_top_p: "",
  multi_agent_worker_max_tokens: "16384",
  multi_agent_worker_presence_penalty: "",
  multi_agent_worker_frequency_penalty: "",
  multi_agent_planner_model: "",
  multi_agent_planner_base_url: "",
  multi_agent_planner_api_key: "",
  multi_agent_planner_temperature: "",
  multi_agent_planner_top_p: "",
  multi_agent_planner_max_tokens: "16384",
  multi_agent_planner_presence_penalty: "",
  multi_agent_planner_frequency_penalty: "",
  multi_agent_literature_scout_model: "",
  multi_agent_literature_scout_base_url: "",
  multi_agent_literature_scout_api_key: "",
  multi_agent_literature_scout_temperature: "",
  multi_agent_literature_scout_top_p: "",
  multi_agent_literature_scout_max_tokens: "16384",
  multi_agent_literature_scout_presence_penalty: "",
  multi_agent_literature_scout_frequency_penalty: "",
  multi_agent_survey_model: "",
  multi_agent_survey_base_url: "",
  multi_agent_survey_api_key: "",
  multi_agent_survey_temperature: "",
  multi_agent_survey_top_p: "",
  multi_agent_survey_max_tokens: "16384",
  multi_agent_survey_presence_penalty: "",
  multi_agent_survey_frequency_penalty: "",
  multi_agent_paper_analyst_model: "",
  multi_agent_paper_analyst_base_url: "",
  multi_agent_paper_analyst_api_key: "",
  multi_agent_paper_analyst_temperature: "",
  multi_agent_paper_analyst_top_p: "",
  multi_agent_paper_analyst_max_tokens: "16384",
  multi_agent_paper_analyst_presence_penalty: "",
  multi_agent_paper_analyst_frequency_penalty: "",
  multi_agent_reproduction_model: "",
  multi_agent_reproduction_base_url: "",
  multi_agent_reproduction_api_key: "",
  multi_agent_reproduction_temperature: "",
  multi_agent_reproduction_top_p: "",
  multi_agent_reproduction_max_tokens: "16384",
  multi_agent_reproduction_presence_penalty: "",
  multi_agent_reproduction_frequency_penalty: "",
  multi_agent_synthesis_model: "",
  multi_agent_synthesis_base_url: "",
  multi_agent_synthesis_api_key: "",
  multi_agent_synthesis_temperature: "0.4",
  multi_agent_synthesis_top_p: "",
  multi_agent_synthesis_max_tokens: "16384",
  multi_agent_synthesis_presence_penalty: "",
  multi_agent_synthesis_frequency_penalty: "",
  paper_visible_venue_tags: DEFAULT_PAPER_TAG_VISIBILITY_VALUE,
  paper_import_recognize_title: "true",
  paper_import_recognize_authors: "true",
  paper_import_recognize_year: "true",
  paper_import_recognize_venue: "true",
  paper_import_recognize_keywords: "true",
  paper_auto_rename_on_import: "false",
  paper_auto_rename_rule: "{first_author} - {title} ({year})",
  vision_model: "",
  vision_base_url: "",
  vision_api_key: "",
  vision_temperature: "0.2",
  vision_top_p: "",
  vision_max_tokens: "16384",
  vision_presence_penalty: "",
  vision_frequency_penalty: "",
  translation_model: "",
  translation_base_url: "",
  translation_api_key: "",
  translation_temperature: "0.1",
  translation_top_p: "",
  translation_max_tokens: "16384",
  translation_presence_penalty: "",
  translation_frequency_penalty: "",
  app_lock_enabled: "false",
  app_lock_password_salt: "",
  app_lock_password_hash: "",
  app_lock_timeout_minutes: "0",
  web_search_enabled: "false",
  web_search_provider: "duckduckgo",
  tavily_api_key: "",
};
