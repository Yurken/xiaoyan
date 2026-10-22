import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { DSH_API_SYNC_REQUEST, DSH_API_SYNC_STATE, formatDshError, type DshApiImportResult, type DshApiSyncState, type DshRuntimeSnapshot } from "./shared";

const initialState: DshApiSyncState = { busy: false, result: null, error: "" };

/** The main view owns the operation so replacing the floating view cannot interrupt restart. */
export function useDshApiSyncHost(refresh: () => Promise<unknown>) {
  const [state, setState] = useState(initialState);
  const latest = useRef(initialState);
  const mounted = useRef(true);
  const publish = useCallback((next: DshApiSyncState) => {
    latest.current = next;
    if (mounted.current) setState(next);
    if ("__TAURI_INTERNALS__" in window) void emit(DSH_API_SYNC_STATE, next).catch(() => {});
  }, []);

  const sync = useCallback(async () => {
    if (latest.current.busy) return;
    publish({ busy: true, result: null, error: "" });
    let restart = false;
    let result: DshApiImportResult | null = null;
    let error = "";
    try {
      const before = await invoke<DshRuntimeSnapshot>("dsh_runtime_status");
      restart = before.phase === "running" || before.phase === "starting";
      if (restart) await invoke("dsh_runtime_stop");
      result = await invoke<DshApiImportResult>("dsh_runtime_import_xiaoyan_api");
    } catch (cause) {
      error = formatDshError(cause);
    } finally {
      if (restart) {
        try { await invoke("dsh_runtime_start"); }
        catch (cause) { error = [error, formatDshError(cause)].filter(Boolean).join("；"); }
      }
      try { await refresh(); }
      catch (cause) { error = [error, formatDshError(cause)].filter(Boolean).join("；"); }
      publish({ busy: false, result, error });
    }
  }, [publish, refresh]);

  useEffect(() => {
    mounted.current = true;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    if ("__TAURI_INTERNALS__" in window) {
      void getCurrentWebview().listen<"sync" | "status">(DSH_API_SYNC_REQUEST, ({ payload }) => {
        if (disposed) return;
        if (payload === "sync") void sync();
        else if (payload === "status") publish(latest.current);
      }).then((stop) => { if (disposed) stop(); else unlisten = stop; }).catch((cause: unknown) => {
        if (!disposed) publish({ ...latest.current, error: formatDshError(cause) });
      });
    }
    return () => { disposed = true; mounted.current = false; unlisten?.(); };
  }, [publish, sync]);
  return { state, sync };
}

export function useDshApiSyncClient() {
  const [state, setState] = useState(initialState);
  useEffect(() => {
    const view = getCurrentWebview();
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void view.listen<DshApiSyncState>(DSH_API_SYNC_STATE, ({ payload }) => {
      if (!disposed) setState(payload);
    }).then(async (stop) => {
      if (disposed) stop();
      else {
        unlisten = stop;
        await view.emitTo("main", DSH_API_SYNC_REQUEST, "status");
      }
    }).catch((cause: unknown) => {
      if (!disposed) setState({ busy: false, result: null, error: formatDshError(cause) });
    });
    return () => { disposed = true; unlisten?.(); };
  }, []);
  const sync = () => {
    setState({ busy: true, result: null, error: "" });
    void getCurrentWebview().emitTo("main", DSH_API_SYNC_REQUEST, "sync").catch((cause: unknown) => {
      setState({ busy: false, result: null, error: formatDshError(cause) });
    });
  };
  return { state, sync };
}
