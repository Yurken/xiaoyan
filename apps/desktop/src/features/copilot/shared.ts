import type { AgentPlanStep, AgentRun } from "@research-copilot/types";

export type AgentGraphNodeKey =
  | "start"
  | "retrieval"
  | "planner"
  | "literature_scout"
  | "survey"
  | "paper_analyst"
  | "reproduction"
  | "synthesis";

export type AgentGraphNodeStatus = "idle" | "pending" | "running" | "done" | "failed";
export type AgentGraphEdgeStatus = "pending" | "active" | "done" | "failed";

export interface AgentExecutionNodeView {
  id: AgentGraphNodeKey;
  title: string;
  goal: string;
  agentName?: string;
  lane: "entry" | "retrieval" | "worker" | "synthesis";
  status: AgentGraphNodeStatus;
  updatedAt?: string;
}

export interface AgentExecutionEdgeView {
  id: string;
  from: AgentGraphNodeKey;
  to: AgentGraphNodeKey;
  sourceTitle: string;
  targetTitle: string;
  status: AgentGraphEdgeStatus;
  updatedAt?: string;
}

export interface AgentExecutionGraphView {
  nodes: AgentExecutionNodeView[];
  edges: AgentExecutionEdgeView[];
}

export interface CopilotAttachmentPayload {
  name: string;
  extension: string;
  mediaTypeLabel: string;
  content: string;
}

export interface CopilotMessageAttachmentView {
  name: string;
  extension: string;
  mediaTypeLabel: string;
}

const NODE_ORDER: AgentGraphNodeKey[] = [
  "retrieval",
  "planner",
  "literature_scout",
  "survey",
  "paper_analyst",
  "reproduction",
  "synthesis",
];

const NODE_META: Record<Exclude<AgentGraphNodeKey, "start">, { title: string; goal: string; lane: AgentExecutionNodeView["lane"] }> = {
  retrieval: {
    title: "图谱与语义检索",
    goal: "从知识图谱与语义检索中收集与当前问题直接相关的证据和溯源链",
    lane: "retrieval",
  },
  planner: {
    title: "生成研究路径",
    goal: "围绕用户主题给出系统化学习和研究推进路径",
    lane: "worker",
  },
  literature_scout: {
    title: "筛选候选论文",
    goal: "快速检索和整理该问题对应的核心论文与线索",
    lane: "worker",
  },
  survey: {
    title: "组织文献综述",
    goal: "把检索到的论文整理成结构化领域概览",
    lane: "worker",
  },
  paper_analyst: {
    title: "解析当前论文",
    goal: "提炼研究问题、方法、实验与局限",
    lane: "worker",
  },
  reproduction: {
    title: "输出复现建议",
    goal: "围绕当前论文给出复现链路和风险提示",
    lane: "worker",
  },
  synthesis: {
    title: "整合最终回答",
    goal: "汇总各节点状态并组织为用户可直接使用的答复",
    lane: "synthesis",
  },
};

export function upsertAgentRun(runs: AgentRun[], next: AgentRun) {
  const index = runs.findIndex((item) => item.id === next.id);
  if (index === -1) {
    return [...runs, next];
  }
  return runs.map((item) => (item.id === next.id ? next : item));
}

const ATTACHMENT_META_REGEX = /<copilot-attachments data="([^"]+)"><\/copilot-attachments>/;
const ATTACHMENT_CONTEXT_REGEX = /\n*<copilot-file-context>[\s\S]*?<\/copilot-file-context>/g;

export function buildCopilotMessageContent(
  text: string,
  attachments: CopilotAttachmentPayload[],
) {
  if (attachments.length === 0) {
    return text;
  }

  const metadata = encodeURIComponent(JSON.stringify({
    attachments: attachments.map((attachment) => ({
      name: attachment.name,
      extension: attachment.extension,
      mediaTypeLabel: attachment.mediaTypeLabel,
    })),
  }));

  const attachmentContext = attachments
    .map((attachment, index) => {
      const extensionLabel = attachment.extension ? `.${attachment.extension}` : "unknown";
      return [
        `[文件 ${index + 1}] ${attachment.name}`,
        `类型：${attachment.mediaTypeLabel} (${extensionLabel})`,
        "以下是文件中提取出的可读内容片段：",
        attachment.content,
      ].join("\n");
    })
    .join("\n\n---\n\n");

  return [
    text,
    "",
    `<copilot-attachments data="${metadata}"></copilot-attachments>`,
    "",
    "<copilot-file-context>",
    "用户本轮补充上传了文件。回答时请结合这些文件内容；如果文件内容不足以支撑结论，请明确说明不足之处。",
    "",
    attachmentContext,
    "</copilot-file-context>",
  ].join("\n");
}

export function parseCopilotMessageContent(content: string): {
  text: string;
  attachments: CopilotMessageAttachmentView[];
} {
  const metaMatch = content.match(ATTACHMENT_META_REGEX);
  let attachments: CopilotMessageAttachmentView[] = [];

  if (metaMatch?.[1]) {
    try {
      const parsed = JSON.parse(decodeURIComponent(metaMatch[1])) as {
        attachments?: CopilotMessageAttachmentView[];
      };
      attachments = Array.isArray(parsed.attachments) ? parsed.attachments : [];
    } catch {
      attachments = [];
    }
  }

  const text = content
    .replace(ATTACHMENT_META_REGEX, "")
    .replace(ATTACHMENT_CONTEXT_REGEX, "")
    .trim();

  return { text, attachments };
}

export function buildAgentExecutionGraph(
  plan: AgentPlanStep[],
  runs: AgentRun[],
  sending: boolean,
): AgentExecutionGraphView {
  const runByAgent = new Map<string, AgentRun>();
  const orderedRuns = [...runs].sort(
    (left, right) => new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime(),
  );

  for (const run of orderedRuns) {
    if (!runByAgent.has(run.agent_name)) {
      runByAgent.set(run.agent_name, run);
    }
  }

  const stepByAgent = new Map(plan.map((step) => [step.agent_name, step]));
  const activeAgents = new Set<string>();
  for (const step of plan) activeAgents.add(step.agent_name);
  for (const run of runs) activeAgents.add(run.agent_name);

  if (activeAgents.size === 0) {
    return { nodes: [], edges: [] };
  }

  const nodes: AgentExecutionNodeView[] = [
    {
      id: "start",
      title: "接收问题",
      goal: "建立本轮执行状态、上下文摘要与问题范围",
      lane: "entry",
      status: "done",
    },
  ];

  for (const agentName of NODE_ORDER) {
    if (!activeAgents.has(agentName)) continue;
    const step = stepByAgent.get(agentName);
    const meta = NODE_META[agentName];
    const run = runByAgent.get(agentName);
    nodes.push({
      id: agentName,
      agentName,
      lane: meta.lane,
      title: step?.title || run?.step_name || meta.title,
      goal: step?.goal || meta.goal,
      status: deriveNodeStatus(agentName, runByAgent, activeAgents, sending),
      updatedAt: run?.updated_at,
    });
  }

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const dependencies = buildDependencyEdges(new Set(nodes.map((node) => node.id)));
  const edges = dependencies.map(({ from, to }) => {
    const source = nodeById.get(from)!;
    const target = nodeById.get(to)!;
    return {
      id: `${from}->${to}`,
      from,
      to,
      sourceTitle: source.title,
      targetTitle: target.title,
      status: deriveEdgeStatus(source.status, target.status),
      updatedAt: target.updatedAt,
    };
  });

  edges.sort((left, right) => edgeRank(left.status) - edgeRank(right.status)
    || new Date(right.updatedAt || 0).getTime() - new Date(left.updatedAt || 0).getTime());

  return { nodes, edges };
}

function buildDependencyEdges(activeNodes: Set<AgentGraphNodeKey>) {
  const edges: Array<{ from: AgentGraphNodeKey; to: AgentGraphNodeKey }> = [];
  const hasRetrieval = activeNodes.has("retrieval");
  const workerNodes = NODE_ORDER.filter(
    (node) => node !== "retrieval" && node !== "synthesis" && activeNodes.has(node),
  );

  if (hasRetrieval) {
    edges.push({ from: "start", to: "retrieval" });
  }

  for (const worker of workerNodes) {
    edges.push({ from: hasRetrieval ? "retrieval" : "start", to: worker });
  }

  if (activeNodes.has("synthesis")) {
    if (workerNodes.length > 0) {
      for (const worker of workerNodes) {
        edges.push({ from: worker, to: "synthesis" });
      }
    } else if (hasRetrieval) {
      edges.push({ from: "retrieval", to: "synthesis" });
    } else {
      edges.push({ from: "start", to: "synthesis" });
    }
  }

  return edges;
}

function deriveNodeStatus(
  agentName: string,
  runByAgent: Map<string, AgentRun>,
  activeAgents: Set<string>,
  sending: boolean,
): AgentGraphNodeStatus {
  const run = runByAgent.get(agentName);
  if (run) {
    if (run.status === "done") return "done";
    if (run.status === "failed") return "failed";
    if (run.status === "running") return "running";
    return "pending";
  }

  if (agentName === "synthesis") {
    const workerStates = NODE_ORDER
      .filter((node) => node !== "synthesis" && activeAgents.has(node))
      .map((node) => deriveNodeStatus(node, runByAgent, activeAgents, sending));
    const allWorkersFinished =
      workerStates.length > 0 && workerStates.every((status) => status === "done" || status === "failed");

    if (allWorkersFinished && sending) return "running";
    if (allWorkersFinished && !sending) return "done";
  }

  return activeAgents.has(agentName) ? "pending" : "idle";
}

function deriveEdgeStatus(
  sourceStatus: AgentGraphNodeStatus,
  targetStatus: AgentGraphNodeStatus,
): AgentGraphEdgeStatus {
  if ((sourceStatus === "done" || sourceStatus === "failed") && targetStatus === "running") {
    return "active";
  }
  if ((sourceStatus === "done" || sourceStatus === "failed") && targetStatus === "failed") {
    return "failed";
  }
  if ((sourceStatus === "done" || sourceStatus === "failed") && targetStatus === "done") {
    return "done";
  }
  return "pending";
}

function edgeRank(status: AgentGraphEdgeStatus) {
  if (status === "active") return 0;
  if (status === "failed") return 1;
  if (status === "done") return 2;
  return 3;
}
