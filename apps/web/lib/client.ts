import { createClient } from "@research-copilot/api-sdk";

// Web 端通过 Next.js rewrite 代理，baseURL 为空字符串（相对路径）
export const apiClient = createClient({ baseURL: "" });

// 兼容旧页面的具名导出风格
export const plannerApi = apiClient.planner;
export const surveyApi = apiClient.survey;
export const papersApi = apiClient.papers;
export const knowledgeApi = apiClient.knowledge;
export const chatApi = {
  ...apiClient.chat,
  stream: (data: Parameters<typeof apiClient.chat.stream>[0]) =>
    apiClient.chat.stream(data),
};
