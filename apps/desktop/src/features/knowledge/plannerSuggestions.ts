export interface PlannerDraft {
  topic: string;
  keywords: string[];
  goal: string;
  background: string;
  time_budget: string;
  constraints: string[];
  known_context: string;
  preferred_output: string;
}

export type DraftField =
  | "topic"
  | "keywords"
  | "goal"
  | "background"
  | "time_budget"
  | "constraints"
  | "known_context"
  | "preferred_output";

interface DomainSuggestionProfile {
  id: string;
  label: string;
  triggers: string[];
  keywords: string[];
  goals: string[];
  backgroundPrompts: string[];
  timeBudgets: string[];
  constraints: string[];
  knownContext: string[];
  outputs: string[];
}

const BACKGROUND_HINT_POSITIVE_TOKENS = [
  "基础",
  "学过",
  "熟悉",
  "了解",
  "做过",
  "经验",
  "掌握",
  "背景",
  "读过",
  "看过",
  "复现过",
  "训练过",
  "实现过",
  "会用",
  "用过",
  "数学",
  "编程",
  "pytorch",
  "transformer",
  "benchmark",
];

const BACKGROUND_HINT_NEGATIVE_TOKENS = [
  "twitter",
  "weibo",
  "douban",
  "评价指标",
  "实验设计",
  "实验设置",
  "应用场景",
  "任务定义",
  "真实数据",
  "真实场景",
  "使用什么",
  "选择什么",
  "哪些基线",
  "哪种基线",
];

export interface PlannerSuggestionState {
  matchedDomains: string[];
  nextField: DraftField;
  nextFieldLabel: string;
  summary: string;
  keywordSuggestions: string[];
  goalSuggestions: string[];
  backgroundPrompts: string[];
  timeBudgetSuggestions: string[];
  constraintSuggestions: string[];
  knownContextSuggestions: string[];
  outputSuggestions: string[];
}

const DOMAIN_PROFILES: DomainSuggestionProfile[] = [
  {
    id: "llm",
    label: "大模型 / LLM",
    triggers: ["大模型", "llm", "language model", "transformer", "gpt", "llama", "qwen", "deepseek", "对齐", "rag", "agent"],
    keywords: ["LLM", "Deep Learning", "Transformer", "Instruction Tuning", "Alignment", "RAG", "Reasoning", "Evaluation"],
    goals: [
      "系统梳理大模型技术栈，并确定一个适合复现的小切口",
      "聚焦对齐、推理或检索增强中的一个子方向形成研究问题",
      "先完成领域综述，再收敛到可执行的实验路线",
    ],
    backgroundPrompts: [
      "已学过深度学习、NLP、Transformer 和 PyTorch",
      "更熟悉模型训练、推理系统或评测与数据构建",
    ],
    timeBudgets: ["4-6 周：快速入门与论文扫描", "8-12 周：完成综述与复现", "3-6 个月：形成实验路线"],
    constraints: ["单卡 24G 显存以内", "中文资料优先", "开源模型优先", "可复现优先"],
    knownContext: ["Transformer", "GPT 系列", "Llama", "Qwen", "DeepSeek-R1", "InstructGPT"],
    outputs: ["学习路线", "论文清单", "综述提纲", "复现实验路线", "开题提纲"],
  },
  {
    id: "multimodal",
    label: "多模态 / VLM",
    triggers: ["多模态", "vlm", "vision language", "图文", "视频理解", "语音视觉", "医学影像", "文图"],
    keywords: ["Vision-Language Model", "Contrastive Learning", "Instruction Tuning", "Cross-modal Alignment", "OCR", "Video Understanding"],
    goals: [
      "梳理多模态模型的发展脉络，并聚焦一个任务场景",
      "比较主流 VLM 架构差异，找出可复现且有扩展空间的方向",
    ],
    backgroundPrompts: [
      "做过图像分类、视觉表征学习或多模态数据处理",
      "更关注模型架构、数据对齐或应用场景验证",
    ],
    timeBudgets: ["6-8 周：任务入门与论文梳理", "10-12 周：复现主流 baseline", "4-6 个月：扩展实验"],
    constraints: ["需要公开数据集", "优先轻量模型", "单机训练", "应用场景明确"],
    knownContext: ["CLIP", "LLaVA", "BLIP-2", "Qwen-VL", "Flamingo"],
    outputs: ["任务地图", "模型对比表", "实验路线", "场景调研报告"],
  },
  {
    id: "graph_bio",
    label: "图学习 / 生物医药",
    triggers: ["图神经", "gnn", "graph", "drug", "分子", "蛋白", "bio", "药物发现", "生信", "bioinformatics"],
    keywords: ["GNN", "Molecular Property Prediction", "Graph Contrastive Learning", "Protein Language Model", "Drug Discovery"],
    goals: [
      "从分子/蛋白建模切入，确定一个可公开数据集验证的问题",
      "梳理图学习与生物任务结合的范式，并锁定可复现 baseline",
    ],
    backgroundPrompts: [
      "熟悉图神经网络基础、分子表示和常见药物发现数据集",
      "更想做性质预测、交互预测或生成设计",
    ],
    timeBudgets: ["6-8 周：补足图学习与生物背景", "8-12 周：复现公开 benchmark", "3-6 个月：设计扩展实验"],
    constraints: ["公开 benchmark 优先", "不依赖湿实验", "单人可完成", "评价指标明确"],
    knownContext: ["GCN", "GAT", "GraphMVP", "MoleculeNet", "AlphaFold", "ESM"],
    outputs: ["学习路线", "任务-数据集清单", "实验设计草案", "选题建议"],
  },
  {
    id: "timeseries",
    label: "时序预测",
    triggers: ["时序", "forecast", "预测", "traffic", "energy", "金融", "传感器", "anomaly", "异常检测"],
    keywords: ["Time Series Forecasting", "Foundation Model", "Transformer", "State Space Model", "Anomaly Detection"],
    goals: [
      "从一个具体预测任务切入，比较主流时序模型的优劣",
      "聚焦泛化、长序列建模或异常检测，形成实验问题",
    ],
    backgroundPrompts: [
      "熟悉统计预测方法、深度学习和常见时序 benchmark",
      "更偏基础模型研究、业务场景理解或系统部署",
    ],
    timeBudgets: ["4-6 周：任务和 benchmark 入门", "8-10 周：复现与对比实验", "3-4 个月：深入一个问题"],
    constraints: ["公开数据优先", "指标可复现", "长序列场景优先", "低算力可跑"],
    knownContext: ["Informer", "PatchTST", "TimesFM", "Mamba", "ETT", "M4"],
    outputs: ["综述提纲", "benchmark 对比", "实验路线", "应用选题建议"],
  },
];

export const FIELD_LABELS: Record<DraftField, string> = {
  topic: "研究主题",
  keywords: "关键词",
  goal: "研究目标",
  background: "当前基础",
  time_budget: "时间预算",
  constraints: "约束条件",
  known_context: "已知论文/方法",
  preferred_output: "期望输出",
};

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function includesToken(haystack: string, token: string) {
  return haystack.includes(token.toLowerCase());
}

function unique(values: string[]) {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function sanitizeBackgroundPrompts(values: string[]) {
  return unique(values).filter((value) => {
    const text = normalize(value);

    if (/[?？]/.test(value)) {
      return false;
    }

    const hasPositiveSignal = BACKGROUND_HINT_POSITIVE_TOKENS.some((token) => includesToken(text, token));
    if (!hasPositiveSignal) {
      return false;
    }

    const hasNegativeSignal = BACKGROUND_HINT_NEGATIVE_TOKENS.some((token) => includesToken(text, token));
    return !hasNegativeSignal;
  });
}

export function isDraftField(value: string): value is DraftField {
  return value in FIELD_LABELS;
}

function detectProfiles(draft: PlannerDraft) {
  const topicText = normalize(draft.topic);
  const fullText = normalize([
    draft.topic,
    draft.keywords.join(" "),
    draft.goal,
    draft.background,
    draft.known_context,
  ].join(" "));

  const scored = DOMAIN_PROFILES
    .map((profile) => {
      const score = profile.triggers.reduce((sum, trigger) => {
        let next = sum;
        if (includesToken(topicText, trigger)) next += 3;
        else if (includesToken(fullText, trigger)) next += 1;
        return next;
      }, 0);

      return { profile, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, 2).map((item) => item.profile);
}

function inferNextField(draft: PlannerDraft): DraftField {
  if (!draft.topic.trim()) return "topic";
  if (draft.keywords.length === 0) return "keywords";
  if (!draft.goal.trim()) return "goal";
  if (!draft.background.trim()) return "background";
  if (!draft.time_budget.trim()) return "time_budget";
  if (draft.constraints.length === 0) return "constraints";
  if (!draft.known_context.trim()) return "known_context";
  if (!draft.preferred_output.trim()) return "preferred_output";
  return "preferred_output";
}

function summarize(draft: PlannerDraft, domainLabels: string[], nextField: DraftField) {
  if (!draft.topic.trim()) {
    return "先输入研究主题，小妍才能识别方向并推荐关键词。";
  }

  if (domainLabels.length === 0) {
    return `已识别到一个待细化的研究方向，下一步建议补充${FIELD_LABELS[nextField]}。`;
  }

  return `当前更接近 ${domainLabels.join(" / ")} 方向，继续补充${FIELD_LABELS[nextField]}后，推荐会更聚焦。`;
}

export function buildPlannerSuggestions(draft: PlannerDraft): PlannerSuggestionState {
  const profiles = detectProfiles(draft);
  const matchedDomains = profiles.map((profile) => profile.label);
  const nextField = inferNextField(draft);
  const goalText = normalize(draft.goal);

  const keywordSuggestions = unique([
    ...profiles.flatMap((profile) => profile.keywords),
  ]).filter((item) => !draft.keywords.some((keyword) => normalize(keyword) === normalize(item)));

  const goalSuggestions = unique([
    ...profiles.flatMap((profile) => profile.goals),
  ]);

  const backgroundPrompts = sanitizeBackgroundPrompts([
    ...profiles.flatMap((profile) => profile.backgroundPrompts),
  ]);

  let timeBudgetSuggestions = unique([
    ...profiles.flatMap((profile) => profile.timeBudgets),
  ]);

  if (goalText.includes("综述") || goalText.includes("survey") || goalText.includes("调研")) {
    timeBudgetSuggestions = unique(["3-4 周：快速扫描核心文献", "8-12 周：形成结构化综述", ...timeBudgetSuggestions]);
  }
  if (goalText.includes("复现") || goalText.includes("实验") || goalText.includes("benchmark")) {
    timeBudgetSuggestions = unique(["6-8 周：单篇论文复现", "3-6 个月：扩展实验并比较 baseline", ...timeBudgetSuggestions]);
  }
  if (goalText.includes("开题") || goalText.includes("选题") || goalText.includes("proposal")) {
    timeBudgetSuggestions = unique(["2-4 周：缩小问题范围", "6-8 周：整理开题材料与初步路线", ...timeBudgetSuggestions]);
  }

  const constraintSuggestions = unique([
    ...profiles.flatMap((profile) => profile.constraints),
  ]).filter((item) => !draft.constraints.some((constraint) => normalize(constraint) === normalize(item)));

  const knownContextSuggestions = unique([
    ...profiles.flatMap((profile) => profile.knownContext),
  ]);

  const outputSuggestions = unique([
    ...profiles.flatMap((profile) => profile.outputs),
    "学习路线",
    "论文清单",
    "实验路线",
    "开题提纲",
  ]);

  return {
    matchedDomains,
    nextField,
    nextFieldLabel: FIELD_LABELS[nextField],
    summary: summarize(draft, matchedDomains, nextField),
    keywordSuggestions,
    goalSuggestions,
    backgroundPrompts,
    timeBudgetSuggestions,
    constraintSuggestions,
    knownContextSuggestions,
    outputSuggestions,
  };
}

export function mergePlannerSuggestions(
  fallback: PlannerSuggestionState,
  ai: PlannerSuggestionState | null
) {
  if (!ai) return fallback;

  const nextField = ai.nextField ?? fallback.nextField;
  const backgroundPrompts = sanitizeBackgroundPrompts(ai.backgroundPrompts);

  return {
    matchedDomains: unique([...ai.matchedDomains, ...fallback.matchedDomains]),
    nextField,
    nextFieldLabel: FIELD_LABELS[nextField],
    summary: ai.summary || fallback.summary,
    keywordSuggestions: ai.keywordSuggestions.length > 0 ? ai.keywordSuggestions : fallback.keywordSuggestions,
    goalSuggestions: ai.goalSuggestions.length > 0 ? ai.goalSuggestions : fallback.goalSuggestions,
    backgroundPrompts: backgroundPrompts.length > 0 ? backgroundPrompts : fallback.backgroundPrompts,
    timeBudgetSuggestions: ai.timeBudgetSuggestions.length > 0 ? ai.timeBudgetSuggestions : fallback.timeBudgetSuggestions,
    constraintSuggestions: ai.constraintSuggestions.length > 0 ? ai.constraintSuggestions : fallback.constraintSuggestions,
    knownContextSuggestions: ai.knownContextSuggestions.length > 0 ? ai.knownContextSuggestions : fallback.knownContextSuggestions,
    outputSuggestions: ai.outputSuggestions.length > 0 ? ai.outputSuggestions : fallback.outputSuggestions,
  };
}

export function parseTagInput(value: string) {
  return unique(value.split(/[,，\n]/).map((item) => item.trim()).filter(Boolean));
}

export function appendTag(raw: string, nextTag: string) {
  const tags = parseTagInput(raw);
  if (tags.some((item) => normalize(item) === normalize(nextTag))) return raw;
  return unique([...tags, nextTag]).join(", ");
}
