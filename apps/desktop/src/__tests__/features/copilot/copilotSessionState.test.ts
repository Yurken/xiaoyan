import { beforeEach, describe, expect, it } from "vitest";
import type {
  AgentPlanStep,
  AgentRun,
  ChatMessage,
  RoutingDecision,
} from "@research-copilot/types";
import {
  readCopilotSessionSnapshot,
  resolveCopilotSessionState,
  writeCopilotSessionSnapshot,
} from "../../../features/copilot/copilotSessionState";

const SESSION_ID = "session-1";

const sessionMessages: ChatMessage[] = [
  {
    id: "user-1",
    role: "user",
    content: "帮我分析这篇论文",
    created_at: "2026-07-02T10:00:00.000Z",
  },
  {
    id: "assistant-1",
    role: "assistant",
    content: "这是一次协同分析。",
    created_at: "2026-07-02T10:00:01.000Z",
  },
];

const loadedRuns: AgentRun[] = [
  {
    id: "run-1",
    session_id: SESSION_ID,
    request_id: "req-loaded",
    agent_name: "planner",
    step_name: "生成研究路径",
    status: "done",
    order_index: 0,
    created_at: "2026-07-02T10:00:02.000Z",
    updated_at: "2026-07-02T10:00:03.000Z",
  },
];

const savedPlan: AgentPlanStep[] = [
  {
    agent_name: "planner",
    title: "生成研究路径",
    goal: "拆解当前研究问题",
  },
];

const savedRouting: RoutingDecision = {
  policy: "hybrid",
  selected: ["planner", "survey"],
  reasoning: "先规划，再汇总",
  execution_waves: [["planner"], ["survey"]],
};

beforeEach(() => {
  window.localStorage.clear();
});

describe("copilotSessionState", () => {
  it("应优先恢复会话快照中的思考态", () => {
    writeCopilotSessionSnapshot(SESSION_ID, {
      messages: [
        ...sessionMessages,
        {
          id: "assistant-2",
          role: "assistant",
          content: "正在整理文献综述",
          created_at: "2026-07-02T10:00:04.000Z",
        },
      ],
      plan: savedPlan,
      agentRuns: [
        {
          ...loadedRuns[0],
          id: "run-2",
          request_id: "req-snapshot",
          status: "running",
        },
      ],
      requestId: "req-snapshot",
      activeAssistantId: "assistant-2",
      input: "继续补充相关工作",
      routingDecision: savedRouting,
      sidebarCollapsed: false,
    });

    const restored = resolveCopilotSessionState({
      sessionId: SESSION_ID,
      sessionMessages,
      agentRuns: loadedRuns,
    });

    expect(restored.messages.at(-1)?.id).toBe("assistant-2");
    expect(restored.plan).toEqual(savedPlan);
    expect(restored.agentRuns[0]?.status).toBe("running");
    expect(restored.requestId).toBe("req-snapshot");
    expect(restored.activeAssistantId).toBe("assistant-2");
    expect(restored.input).toBe("继续补充相关工作");
    expect(restored.routingDecision).toEqual(savedRouting);
    expect(restored.sidebarCollapsed).toBe(false);
  });

  it("没有快照时应回退到已加载的会话内容", () => {
    const restored = resolveCopilotSessionState({
      sessionId: SESSION_ID,
      sessionMessages,
      agentRuns: loadedRuns,
    });

    expect(restored.messages).toEqual(sessionMessages);
    expect(restored.agentRuns).toEqual(loadedRuns);
    expect(restored.plan).toEqual([]);
    expect(restored.activeAssistantId).toBeNull();
    expect(restored.requestId).toBeUndefined();
    expect(restored.sidebarCollapsed).toBe(true);
  });

  it("写入空快照时应清理存储", () => {
    writeCopilotSessionSnapshot(SESSION_ID, {
      messages: [],
      plan: [],
      agentRuns: [],
      requestId: null,
      activeAssistantId: null,
      input: "",
      routingDecision: null,
      sidebarCollapsed: true,
    });

    expect(readCopilotSessionSnapshot(SESSION_ID)).toBeNull();
  });
});
