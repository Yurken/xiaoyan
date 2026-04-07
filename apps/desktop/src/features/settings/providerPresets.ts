import type { AppSettings, LlmProvider } from "@research-copilot/types";

export const ANTHROPIC_ENDPOINT = "https://api.anthropic.com/v1/messages";

export const PROVIDER_PRESETS = [
  {
    id: "openai",
    label: "OpenAI",
    providerType: "openai" as LlmProvider,
    baseUrl: "https://api.openai.com/v1",
    defaultChatModel: "gpt-4o-mini",
    defaultEmbedModel: "text-embedding-3-small",
    apiKeyPlaceholder: "sk-...",
    description: "官方 OpenAI 接口，自动填入标准 `/v1` 地址。",
  },
  {
    id: "anthropic",
    label: "Anthropic",
    providerType: "anthropic" as LlmProvider,
    baseUrl: ANTHROPIC_ENDPOINT,
    defaultChatModel: "claude-3-5-haiku-20241022",
    defaultEmbedModel: "",
    apiKeyPlaceholder: "sk-ant-...",
    description: "原生 Messages API，当前主模型配置不支持自定义 URL。",
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    providerType: "openai_compatible" as LlmProvider,
    baseUrl: "https://api.deepseek.com/v1",
    defaultChatModel: "deepseek-chat",
    defaultEmbedModel: "",
    apiKeyPlaceholder: "sk-...",
    description: "自动填入官方兼容 OpenAI 的接口地址。",
  },
  {
    id: "qwen",
    label: "通义千问",
    providerType: "openai_compatible" as LlmProvider,
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    defaultChatModel: "qwen-plus",
    defaultEmbedModel: "text-embedding-v3",
    apiKeyPlaceholder: "sk-...",
    description: "自动填入 DashScope 兼容模式地址。",
  },
  {
    id: "siliconflow",
    label: "硅基流动",
    providerType: "openai_compatible" as LlmProvider,
    baseUrl: "https://api.siliconflow.cn/v1",
    defaultChatModel: "Qwen/Qwen2.5-72B-Instruct",
    defaultEmbedModel: "BAAI/bge-m3",
    apiKeyPlaceholder: "sk-...",
    description: "适合统一接入开源模型与 embedding。",
  },
  {
    id: "moonshot",
    label: "Moonshot",
    providerType: "openai_compatible" as LlmProvider,
    baseUrl: "https://api.moonshot.cn/v1",
    defaultChatModel: "moonshot-v1-8k",
    defaultEmbedModel: "",
    apiKeyPlaceholder: "sk-...",
    description: "自动填入 Moonshot 官方兼容地址。",
  },
  {
    id: "gemini",
    label: "Gemini",
    providerType: "openai_compatible" as LlmProvider,
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    defaultChatModel: "gemini-2.0-flash",
    defaultEmbedModel: "",
    apiKeyPlaceholder: "AIza...",
    description: "使用 Google 提供的 OpenAI 兼容入口。",
  },
  {
    id: "ollama",
    label: "Ollama",
    providerType: "openai_compatible" as LlmProvider,
    baseUrl: "http://localhost:11434/v1",
    defaultChatModel: "qwen2.5:7b",
    defaultEmbedModel: "nomic-embed-text",
    apiKeyPlaceholder: "ollama",
    description: "本地部署，自动填入 `localhost:11434/v1`。",
  },
  {
    id: "custom",
    label: "自定义",
    providerType: "openai_compatible" as LlmProvider,
    baseUrl: "",
    defaultChatModel: "",
    defaultEmbedModel: "",
    apiKeyPlaceholder: "sk-...",
    description: "适用于代理转发、OpenRouter、One API 或其他兼容接口。",
  },
] as const;

export type ProviderPresetId = (typeof PROVIDER_PRESETS)[number]["id"];

export function detectPreset(form: AppSettings): ProviderPresetId {
  if (form.llm_provider === "openai") return "openai";
  if (form.llm_provider === "anthropic") return "anthropic";
  const url = form.openai_compatible_base_url.trim();
  if (url.includes("deepseek.com")) return "deepseek";
  if (url.includes("dashscope.aliyuncs.com")) return "qwen";
  if (url.includes("siliconflow.cn")) return "siliconflow";
  if (url.includes("moonshot.cn")) return "moonshot";
  if (url.includes("generativelanguage.googleapis.com")) return "gemini";
  if (url.includes("localhost:11434") || url.includes("127.0.0.1:11434")) return "ollama";
  return "custom";
}

export function applyProviderPreset(current: AppSettings, presetId: ProviderPresetId): AppSettings {
  const preset = PROVIDER_PRESETS.find((item) => item.id === presetId);
  if (!preset) return current;

  const next = { ...current, llm_provider: preset.providerType };

  if (preset.providerType === "openai") {
    next.openai_base_url = preset.baseUrl;
    next.openai_chat_model = preset.defaultChatModel;
    next.openai_embedding_model = preset.defaultEmbedModel;
    return next;
  }

  if (preset.providerType === "anthropic") {
    next.anthropic_chat_model = preset.defaultChatModel;
    return next;
  }

  next.openai_compatible_base_url = preset.baseUrl;
  next.openai_compatible_chat_model = preset.defaultChatModel;
  next.openai_compatible_embedding_model = preset.defaultEmbedModel;
  return next;
}
