import { useEffect, useSyncExternalStore } from "react";
import { safeListen } from "../../lib/tauriEvent";
import type { UnlistenFn } from "@tauri-apps/api/event";
import type { LearningPath, ResearchInterest } from "@research-copilot/types";
import type { InterestAgentState, InterestPlanRunSnapshot, InterestPlanRunSnapshots } from "./shared";

interface InterestStatusEvent {
  id: string;
  status: string;
  learning_path?: LearningPath;
}

interface InterestPlanEvent {
  id: string;
  learning_path: LearningPath;
}

interface InterestErrorEvent {
  id: string;
  error: string;
}

interface InterestAgentEvent {
  id: string;
  agent: Partial<InterestAgentState> & { id: string };
}

const NON_PLAN_EVENT_IDS = new Set(["hints", "suggest", "workbench_overview"]);
const INTEREST_PLAN_STORAGE_KEY = "rc:interest-plan:runs";

let snapshots: InterestPlanRunSnapshots = readStoredSnapshots();
let listenerPromise: Promise<UnlistenFn[]> | null = null;

const subscribers = new Set<() => void>();

function readStoredSnapshots(): InterestPlanRunSnapshots {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(INTEREST_PLAN_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as InterestPlanRunSnapshots;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return {};
  }
}

function persistSnapshots() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(INTEREST_PLAN_STORAGE_KEY, JSON.stringify(snapshots));
  } catch {
    // localStorage is best-effort; in-memory snapshots still keep navigation within this session recoverable.
  }
}

function shouldIgnorePlanEvent(id: string) {
  return !id || NON_PLAN_EVENT_IDS.has(id);
}

function notify() {
  persistSnapshots();
  subscribers.forEach((subscriber) => subscriber());
}

function updateSnapshot(
  id: string,
  updater: (current: InterestPlanRunSnapshot) => InterestPlanRunSnapshot,
) {
  if (shouldIgnorePlanEvent(id)) return;

  const current = snapshots[id] ?? { agents: [], updatedAt: Date.now() };
  snapshots = {
    ...snapshots,
    [id]: {
      ...updater(current),
      updatedAt: Date.now(),
    },
  };
  notify();
}

function normalizeAgent(
  agent: Partial<InterestAgentState> & { id: string },
  fallbackStatus: InterestAgentState["status"],
): InterestAgentState {
  return {
    id: agent.id,
    name: agent.name || "小妍",
    role: agent.role || "处理研究路线",
    status: agent.status || fallbackStatus,
    summary: agent.summary,
    error: agent.error,
  };
}

function upsertAgent(
  interestId: string,
  agent: Partial<InterestAgentState> & { id: string },
  fallbackStatus: InterestAgentState["status"],
) {
  updateSnapshot(interestId, (current) => {
    const nextAgent = normalizeAgent(agent, fallbackStatus);
    const index = current.agents.findIndex((item) => item.id === nextAgent.id);
    const agents = index === -1
      ? [...current.agents, nextAgent]
      : current.agents.map((item) =>
          item.id === nextAgent.id ? { ...item, ...nextAgent } : item
        );

    return {
      ...current,
      status: current.status === "planned" ? current.status : "planning",
      agents,
    };
  });
}

function failRunningAgents(agents: InterestAgentState[], error: string) {
  return agents.map((agent) =>
    agent.status === "running"
      ? { ...agent, status: "failed" as const, error: agent.error || error }
      : agent
  );
}

function subscribe(subscriber: () => void) {
  subscribers.add(subscriber);
  return () => {
    subscribers.delete(subscriber);
  };
}

function getSnapshot() {
  return snapshots;
}

async function installInterestPlanListeners() {
  return Promise.all([
    safeListen<InterestStatusEvent>("interest:status", (event) => {
      const { id, status, learning_path: learningPath } = event.payload;
      updateSnapshot(id, (current) => ({
        ...current,
        status,
        learningPath: learningPath ?? current.learningPath,
        error: status === "planning" ? undefined : current.error,
      }));
    }),
    safeListen<InterestPlanEvent>("interest:plan", (event) => {
      updateSnapshot(event.payload.id, (current) => ({
        ...current,
        status: "planned",
        learningPath: event.payload.learning_path,
        error: undefined,
      }));
    }),
    safeListen<InterestErrorEvent>("interest:error", (event) => {
      const { id, error } = event.payload;
      updateSnapshot(id, (current) => ({
        ...current,
        status: current.learningPath ? "planned" : "active",
        agents: failRunningAgents(current.agents, error),
        error,
      }));
    }),
    safeListen<InterestAgentEvent>("interest:agent_start", (event) => {
      upsertAgent(event.payload.id, event.payload.agent, "running");
    }),
    safeListen<InterestAgentEvent>("interest:agent_complete", (event) => {
      upsertAgent(event.payload.id, { ...event.payload.agent, status: "done" }, "done");
    }),
    safeListen<InterestAgentEvent>("interest:agent_error", (event) => {
      upsertAgent(event.payload.id, { ...event.payload.agent, status: "failed" }, "failed");
    }),
  ]);
}

export function useInterestPlanEventBridge() {
  useEffect(() => {
    if (!listenerPromise) {
      listenerPromise = installInterestPlanListeners();
    }
  }, []);
}

export function useInterestPlanSnapshots() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function startInterestPlanRun(id: string, existingLearningPath?: LearningPath) {
  updateSnapshot(id, (current) => ({
    ...current,
    status: "planning",
    learningPath: existingLearningPath ?? current.learningPath,
    agents: [],
    error: undefined,
  }));
}

export function resumeInterestPlanRun(id: string, startStep: number) {
  updateSnapshot(id, (current) => ({
    ...current,
    status: "planning",
    agents: current.agents.slice(0, startStep),
    error: undefined,
  }));
}

export function failInterestPlanRun(id: string, error: string) {
  updateSnapshot(id, (current) => ({
    ...current,
    status: current.learningPath ? "planned" : "active",
    agents: failRunningAgents(current.agents, error),
    error,
  }));
}

export function removeInterestPlanSnapshot(id: string) {
  if (!(id in snapshots)) return;
  const next = { ...snapshots };
  delete next[id];
  snapshots = next;
  notify();
}

export function applyInterestPlanSnapshots<T extends ResearchInterest>(
  interests: T[],
  planSnapshots: InterestPlanRunSnapshots,
): T[] {
  return interests.map((interest) => {
    const snapshot = planSnapshots[interest.id];
    if (!snapshot) return interest;

    return {
      ...interest,
      status: snapshot.status ?? interest.status,
      learning_path: snapshot.learningPath ?? interest.learning_path,
    };
  });
}
