import type { DshApiSyncState } from "./shared";

export default function DshApiSyncFeedback({ state }: { state: DshApiSyncState }) {
  const message = state.busy ? "正在同步小妍 API…" : state.error || (state.result ? `已配置 ${state.result.model} · ${state.result.route}` : "");
  return message ? <p role={state.error ? "alert" : "status"} className={`max-w-sm px-3 pb-1 text-xs ${state.error ? "text-red-700" : "text-ink-secondary"}`}>{message}</p> : null;
}
