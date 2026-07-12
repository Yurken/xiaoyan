import type {
  AgentPlanStep,
  AgentRun,
  ChatMessage,
  RoutingDecision,
} from "@research-copilot/types";
import {
  clearPersistentValue,
  readPersistentValue,
  writePersistentValue,
} from "../../hooks/usePersistentStringState";

const COPILOT_SESSION_STATE_KEY_PREFIX = "rc:copilot:session-state:";
const COPILOT_DRAFT_SESSION_ID = "__draft__";

export interface CopilotSessionSnapshot {
  messages: ChatMessage[];
  plan: AgentPlanStep[];
  agentRuns: AgentRun[];
  requestId: string | null;
  activeAssistantId: string | null;
  input: string;
  routingDecision: RoutingDecision | null;
  sidebarCollapsed: boolean;
}

export interface RestoredCopilotSessionState
  extends Omit<CopilotSessionSnapshot, "requestId"> {
  requestId?: string;
}

interface ResolveCopilotSessionStateOptions {
  sessionId?: string | null;
  sessionMessages?: ChatMessage[];
  agentRuns?: AgentRun[];
}

function getCopilotSessionStateKey(sessionId?: string | null) {
  return `${COPILOT_SESSION_STATE_KEY_PREFIX}${sessionId || COPILOT_DRAFT_SESSION_ID}`;
}

function isObjectLike(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSnapshotActiveAssistant(
  messages: ChatMessage[],
  activeAssistantId: string | null,
) {
  if (!activeAssistantId) return false;
  return messages.some(
    (message) => message.id === activeAssistantId && message.role === "assistant",
  );
}

export function hasCopilotSessionSnapshotContent(
  snapshot: CopilotSessionSnapshot,
) {
  return (
    snapshot.messages.length > 0 ||
    snapshot.plan.length > 0 ||
    snapshot.agentRuns.length > 0 ||
    Boolean(snapshot.requestId) ||
    Boolean(snapshot.activeAssistantId) ||
    Boolean(snapshot.input.trim()) ||
    Boolean(snapshot.routingDecision)
  );
}

export function readCopilotSessionSnapshot(
  sessionId?: string | null,
): CopilotSessionSnapshot | null {
  const stored = readPersistentValue(getCopilotSessionStateKey(sessionId));
  if (!stored) return null;

  try {
    const parsed = JSON.parse(stored) as unknown;
    if (!isObjectLike(parsed)) return null;
    return {
      messages: Array.isArray(parsed.messages)
        ? (parsed.messages as ChatMessage[])
        : [],
      plan: Array.isArray(parsed.plan)
        ? (parsed.plan as AgentPlanStep[])
        : [],
      agentRuns: Array.isArray(parsed.agentRuns)
        ? (parsed.agentRuns as AgentRun[])
        : [],
      requestId:
        typeof parsed.requestId === "string" && parsed.requestId.trim()
          ? parsed.requestId
          : null,
      activeAssistantId:
        typeof parsed.activeAssistantId === "string" &&
        parsed.activeAssistantId.trim()
          ? parsed.activeAssistantId
          : null,
      input: typeof parsed.input === "string" ? parsed.input : "",
      routingDecision: isObjectLike(parsed.routingDecision)
        ? (parsed.routingDecision as unknown as RoutingDecision)
        : null,
      sidebarCollapsed:
        typeof parsed.sidebarCollapsed === "boolean"
          ? parsed.sidebarCollapsed
          : true,
    };
  } catch {
    return null;
  }
}

export function writeCopilotSessionSnapshot(
  sessionId: string | null | undefined,
  snapshot: CopilotSessionSnapshot,
) {
  const key = getCopilotSessionStateKey(sessionId);
  if (!hasCopilotSessionSnapshotContent(snapshot)) {
    clearPersistentValue(key);
    return;
  }
  writePersistentValue(key, JSON.stringify(snapshot));
}

export function clearCopilotSessionSnapshot(sessionId?: string | null) {
  clearPersistentValue(getCopilotSessionStateKey(sessionId));
}

export function resolveCopilotSessionState({
  sessionId,
  sessionMessages = [],
  agentRuns = [],
}: ResolveCopilotSessionStateOptions = {}): RestoredCopilotSessionState {
  const snapshot = readCopilotSessionSnapshot(sessionId);
  if (!snapshot) {
    return {
      messages: sessionMessages,
      plan: [],
      agentRuns,
      requestId: undefined,
      activeAssistantId: null,
      input: "",
      routingDecision: null,
      sidebarCollapsed: true,
    };
  }

  const messages =
    snapshot.messages.length > 0 ? snapshot.messages : sessionMessages;
  const activeAssistantId = isSnapshotActiveAssistant(
    messages,
    snapshot.activeAssistantId,
  )
    ? snapshot.activeAssistantId
    : null;

  return {
    messages,
    plan: snapshot.plan,
    agentRuns:
      snapshot.agentRuns.length > 0 ? snapshot.agentRuns : agentRuns,
    requestId: snapshot.requestId ?? undefined,
    activeAssistantId,
    input: snapshot.input,
    routingDecision: snapshot.routingDecision,
    sidebarCollapsed: snapshot.sidebarCollapsed,
  };
}
