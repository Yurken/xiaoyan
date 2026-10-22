export type DshRuntimeMode = "auto" | "bundled" | "external";
export const DSH_CONTROLS_SURFACE = "dsh-runtime-controls";
export const DSH_VIEWPORT_EVENT = "dsh:viewport";
export const DSH_API_SYNC_REQUEST = "dsh:api-sync-request";
export const DSH_API_SYNC_STATE = "dsh:api-sync-state";
export const DSH_CONTROLS_INITIAL_SIZE = { width: 280, height: 64 };

export interface DshViewBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}
export type DshRuntimePhase = "stopped" | "starting" | "running" | "failed";

export interface DshRuntimeConfig {
  mode: DshRuntimeMode;
  externalExecutable: string | null;
  externalHome: string | null;
  profile: string;
  workspaceDir: string | null;
}

export interface DshRuntimeSnapshot {
  phase: DshRuntimePhase;
  config: DshRuntimeConfig;
  url: string | null;
  error: string | null;
  logs: string[];
  bundledAvailable: boolean;
  pathAvailable: boolean;
  pathExecutable: string | null;
  lockedVersion: string;
  lockedCommit: string;
  nodeRequirement: string;
  source: string;
  dataHome: string;
}

export interface DshApiImportResult {
  route: string;
  protocol: string;
  model: string;
  dataHome: string;
}

export interface DshApiSyncState {
  busy: boolean;
  result: DshApiImportResult | null;
  error: string;
}

export function canStartDsh(snapshot: DshRuntimeSnapshot | null): boolean {
  return Boolean(snapshot && ((snapshot.config.mode === "external" && snapshot.config.externalExecutable?.trim())
    || snapshot.pathAvailable || snapshot.bundledAvailable));
}

export const DEFAULT_DSH_CONFIG: DshRuntimeConfig = {
  mode: "auto",
  externalExecutable: null,
  externalHome: null,
  profile: "web",
  workspaceDir: null,
};

export const DSH_PHASE_LABELS: Record<DshRuntimePhase, string> = {
  stopped: "未启动",
  starting: "启动中",
  running: "运行中",
  failed: "启动失败",
};

export function formatDshError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return message.trim() || "DSH 操作未完成，请查看运行日志。";
}
