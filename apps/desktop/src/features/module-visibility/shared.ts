export const MODULE_VISIBILITY_STORAGE_KEY = "rc:layout:module-visibility";
export const MODULE_VISIBILITY_CHANGE_EVENT = "rc:module-visibility-change";

export const EXPERIMENT_MODULES = [
  { key: "code", label: "代码", description: "代码助手、终端与实验工作目录" },
  { key: "snapshots", label: "快照", description: "保存和比较实验状态与关键文件" },
  { key: "records", label: "记录", description: "创建实验并维护配置、结果与备注" },
] as const;

export const TOOL_MODULES = [
  { key: "arxiv", label: "论文检索", description: "按研究主题和字段发现论文" },
  { key: "github", label: "GitHub 项目", description: "查找相关开源实现与项目" },
  { key: "source", label: "刊会查询", description: "查询期刊、会议与分区信息" },
  { key: "translate", label: "学术翻译", description: "处理中英文学术文本" },
  { key: "md", label: "MD 整理", description: "清理并规范 Markdown 内容" },
  { key: "ppt", label: "生成 PPT", description: "根据主题、提纲或文档生成演示文稿" },
  { key: "patent", label: "专利检索", description: "面向中国申请场景检索现有技术并预评估" },
  { key: "document-check", label: "文档校验", description: "检查 PDF、Word 的页面、字体与编号问题" },
  { key: "links", label: "科研友链", description: "常用科研网站与资源入口" },
] as const;

export type ExperimentModuleKey = (typeof EXPERIMENT_MODULES)[number]["key"];
export type ToolModuleKey = (typeof TOOL_MODULES)[number]["key"];
export type ModuleGroupKey = "experiment" | "tools";

export interface ModuleVisibilityConfig {
  experiment: Record<ExperimentModuleKey, boolean>;
  tools: Record<ToolModuleKey, boolean>;
}

function allVisible<T extends readonly { key: string }[]>(items: T) {
  return Object.fromEntries(items.map((item) => [item.key, true]));
}

export const DEFAULT_MODULE_VISIBILITY: ModuleVisibilityConfig = {
  experiment: allVisible(EXPERIMENT_MODULES) as Record<ExperimentModuleKey, boolean>,
  tools: allVisible(TOOL_MODULES) as Record<ToolModuleKey, boolean>,
};

export function normalizeModuleVisibility(value: unknown): ModuleVisibilityConfig {
  const candidate = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const experiment = candidate.experiment && typeof candidate.experiment === "object"
    ? candidate.experiment as Record<string, unknown>
    : {};
  const tools = candidate.tools && typeof candidate.tools === "object"
    ? candidate.tools as Record<string, unknown>
    : {};

  const normalized: ModuleVisibilityConfig = {
    experiment: Object.fromEntries(EXPERIMENT_MODULES.map(({ key }) => [key, experiment[key] !== false])) as Record<ExperimentModuleKey, boolean>,
    tools: Object.fromEntries(TOOL_MODULES.map(({ key }) => [key, tools[key] !== false])) as Record<ToolModuleKey, boolean>,
  };

  if (!Object.values(normalized.experiment).some(Boolean)) normalized.experiment.records = true;
  if (!Object.values(normalized.tools).some(Boolean)) normalized.tools.arxiv = true;
  return normalized;
}

export function readModuleVisibility(): ModuleVisibilityConfig {
  if (typeof window === "undefined") return DEFAULT_MODULE_VISIBILITY;
  try {
    const stored = window.localStorage.getItem(MODULE_VISIBILITY_STORAGE_KEY);
    return stored ? normalizeModuleVisibility(JSON.parse(stored)) : DEFAULT_MODULE_VISIBILITY;
  } catch {
    return DEFAULT_MODULE_VISIBILITY;
  }
}

export function persistModuleVisibility(config: ModuleVisibilityConfig) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MODULE_VISIBILITY_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // 在受限 WebView 中仍保持本次会话内状态可用。
  }
  window.dispatchEvent(new CustomEvent(MODULE_VISIBILITY_CHANGE_EVENT, { detail: config }));
}
