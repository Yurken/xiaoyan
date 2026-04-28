export const VIDEO = {
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: 1800,
};

export const SCENES = [
  {
    key: "opening",
    start: 0,
    duration: 180,
    eyebrow: "小妍 Research Copilot",
    title: "从论文堆里，拉出清晰研究路线",
    body: "面向科研学习与论文工作的桌面端 AI 研究助手",
  },
  {
    key: "challenge",
    start: 180,
    duration: 240,
    eyebrow: "科研流程常常断裂",
    title: "问题不在工具少，而在上下文总是丢失",
    body: "找方向、筛论文、读图表、写综述、管投稿，本该是一条连续的工作流。",
  },
  {
    key: "mission",
    start: 420,
    duration: 270,
    eyebrow: "多 Agent 协同台",
    title: "让计划、执行轨迹与来源同时可见",
    body: "Supervisor 拆解任务，专长 Agent 分工执行，Mission Control 实时展示进度。",
  },
  {
    key: "papers",
    start: 690,
    duration: 270,
    eyebrow: "论文库与 AI 精读",
    title: "PDF 进入知识底座，而不是文件夹深处",
    body: "全文提取、图表识别、语义分块、复现建议和带引用分析连在一起。",
  },
  {
    key: "knowledge",
    start: 960,
    duration: 300,
    eyebrow: "知识图谱与 Graph RAG",
    title: "把论文、笔记和记忆织成可检索网络",
    body: "引用关系、知识卡片与用户记忆进入图结构，让复杂问题有上下文可循。",
  },
  {
    key: "submission",
    start: 1260,
    duration: 270,
    eyebrow: "投稿管理",
    title: "从 DDL 到审稿回复，一处追踪到底",
    body: "会议期刊、状态看板、版本快照、模拟审稿和作者回复统一收拢。",
  },
  {
    key: "closing",
    start: 1530,
    duration: 270,
    eyebrow: "本地内核，按用途选模",
    title: "把科研工作流，交给一套可观测的 AI 协同台",
    body: "Tauri + SQLite 本地存储，多模型分工覆盖检索、精读、写作、代码复现与视觉识别。",
  },
] as const;

export type PromoScene = (typeof SCENES)[number];
export type SceneKey = PromoScene["key"];

export const WORKFLOW_STEPS = [
  "方向规划",
  "文献侦察",
  "结构化综述",
  "论文精读",
  "知识沉淀",
  "投稿跟踪",
];

export const AGENTS = [
  { name: "Supervisor", role: "任务拆解与整合", tone: "amber" },
  { name: "Topic Analyst", role: "研究方向分析", tone: "teal" },
  { name: "Paper Scout", role: "文献检索与筛选", tone: "blue" },
  { name: "Survey Writer", role: "结构化综述写作", tone: "rose" },
  { name: "Reproduction Advisor", role: "代码复现建议", tone: "green" },
] as const;

export const PAPER_FEATURES = [
  "PDF 全文提取",
  "图表编号引用",
  "语义分块向量化",
  "复现路线建议",
];

export const MODEL_ROLES = [
  "快速模型",
  "深度分析模型",
  "写作整合模型",
  "代码复现模型",
  "视觉模型",
];
