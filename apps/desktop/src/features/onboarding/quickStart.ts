import type { ComponentType } from "react";
import { Bot, Link2, Route } from "lucide-react";
import type { AppSettings } from "@research-copilot/types";
import { detectPreset, PROVIDER_PRESETS } from "../settings/providerPresets";

// 「快速开始」三步引导的就绪状态与步骤数据集中在这里，供设置分区与首次弹窗共用，
// 避免在多处复制字段映射与就绪判断。

export interface QuickStartReadiness {
  connectionReady: boolean;
  rolesReady: boolean;
  multiAgentReady: boolean;
  currentProviderLabel: string;
}

export function computeQuickStartReadiness(form: AppSettings): QuickStartReadiness {
  const provider = form.llm_provider;
  const activePreset = detectPreset(form);
  const currentProviderLabel =
    PROVIDER_PRESETS.find((preset) => preset.id === activePreset)?.label ?? "自定义兼容服务";

  const connectionReady =
    provider === "openai"
      ? Boolean(form.openai_api_key.trim() && form.openai_chat_model.trim())
      : provider === "anthropic"
        ? Boolean(form.anthropic_api_key.trim() && form.anthropic_chat_model.trim())
        : Boolean(
            form.openai_compatible_chat_model.trim() &&
              (activePreset === "ollama" ||
                form.openai_compatible_base_url.trim() ||
                form.openai_compatible_api_key.trim()),
          );

  const rolesReady = Boolean(
    form.paper_analysis_model.trim() ||
      form.survey_writer_model.trim() ||
      form.paper_reproduction_model.trim() ||
      form.vision_model.trim() ||
      form.multi_agent_supervisor_model.trim(),
  );

  const enabledAgents = form.multi_agent_enabled_agents
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const multiAgentReady = form.multi_agent_enabled === "true" && enabledAgents.length > 0;

  return { connectionReady, rolesReady, multiAgentReady, currentProviderLabel };
}

export interface QuickStartStep {
  key: "connection" | "roles" | "collaboration";
  title: string;
  description: string;
  /** 当前是否满足该步骤的判定条件。 */
  done: boolean;
  /** 可选步骤是「让用户决定」的开关，不应被呈现为待办任务（不打绿勾）。 */
  optional: boolean;
  actionLabel: string;
  icon: ComponentType<{ className?: string }>;
}

export function buildQuickStartSteps(readiness: QuickStartReadiness): QuickStartStep[] {
  const { connectionReady, rolesReady, multiAgentReady, currentProviderLabel } = readiness;
  return [
    {
      key: "connection",
      title: "先接通小妍",
      description: connectionReady
        ? `当前小妍默认模型已连到 ${currentProviderLabel}。没有单独指定的场景，会先回退到这里。`
        : "先选服务商，填好 URL、API Key 和默认对话模型。先让小妍稳定可用，再看细分分工。",
      done: connectionReady,
      optional: false,
      actionLabel: "小妍设置",
      icon: Link2,
    },
    {
      key: "roles",
      title: "再按需要补任务分工",
      description: rolesReady
        ? "阅读、综述、复现或视觉识别里，至少有一类任务已经配置了专用模型。"
        : "这一步不是必填。先从论文阅读、综述写作和视觉识别三类高频任务里挑需要单独提速的场景即可。",
      done: rolesReady,
      optional: false,
      actionLabel: "小妍设置",
      icon: Route,
    },
    {
      key: "collaboration",
      title: "最后决定是否启用小妍步骤协作",
      description: multiAgentReady
        ? "当前已启用：复杂任务会走调度和分工流程。想先稳定用单模型对话，也可以随时关掉。"
        : "当前已关闭：只走单模型对话。等基础配置跑顺后，再决定是否开启复杂任务的调度与分工。",
      done: multiAgentReady,
      optional: true,
      actionLabel: "步骤协作",
      icon: Bot,
    },
  ];
}
