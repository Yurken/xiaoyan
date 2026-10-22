import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDshApiSyncHost } from "../../features/deepseek-harness/useDshApiSync";
import { DSH_API_SYNC_REQUEST, DSH_API_SYNC_STATE } from "../../features/deepseek-harness/shared";

const native = vi.hoisted(() => ({ invoke: vi.fn(), emit: vi.fn(), listen: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: native.invoke }));
vi.mock("@tauri-apps/api/event", () => ({ emit: native.emit }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ listen: native.listen }) }));
const imported = { model: "synthetic-model", route: "xiaoyan", protocol: "openai-completions", dataHome: "/synthetic/dsh" };
let onRequest: (event: { payload: "sync" | "status" }) => void;
const refresh = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, "__TAURI_INTERNALS__", { value: {}, configurable: true });
  native.emit.mockResolvedValue(undefined);
  native.listen.mockImplementation(async (_name, handler) => { onRequest = handler; return () => {}; });
  native.invoke.mockImplementation(async (command: string) => {
    if (command === "dsh_runtime_status") return { phase: "running" };
    if (command === "dsh_runtime_import_xiaoyan_api") return imported;
    return undefined;
  });
  refresh.mockResolvedValue(undefined);
});
afterEach(() => { Reflect.deleteProperty(window, "__TAURI_INTERNALS__"); });

describe("DSH API sync host", () => {
  it("serializes duplicate requests and replays the result for a recreated floating view", async () => {
    let finishImport!: (value: typeof imported) => void;
    const pending = new Promise<typeof imported>((resolve) => { finishImport = resolve; });
    native.invoke.mockImplementation(async (command: string) => {
      if (command === "dsh_runtime_status") return { phase: "running" };
      if (command === "dsh_runtime_import_xiaoyan_api") return pending;
    });
    const { result } = renderHook(() => useDshApiSyncHost(refresh));
    await waitFor(() => expect(native.listen).toHaveBeenCalledWith(DSH_API_SYNC_REQUEST, expect.any(Function)));
    act(() => { onRequest({ payload: "sync" }); onRequest({ payload: "sync" }); });
    await waitFor(() => expect(native.invoke).toHaveBeenCalledWith("dsh_runtime_import_xiaoyan_api"));
    expect(result.current.state.busy).toBe(true);
    expect(native.invoke.mock.calls.filter(([command]) => command === "dsh_runtime_import_xiaoyan_api")).toHaveLength(1);
    await act(async () => { finishImport(imported); await pending; });
    await waitFor(() => expect(result.current.state).toEqual({ busy: false, result: imported, error: "" }));
    expect(native.invoke.mock.calls.map(([command]) => command)).toEqual([
      "dsh_runtime_status", "dsh_runtime_stop", "dsh_runtime_import_xiaoyan_api", "dsh_runtime_start",
    ]);
    native.emit.mockClear();
    act(() => onRequest({ payload: "status" }));
    expect(native.emit).toHaveBeenLastCalledWith(DSH_API_SYNC_STATE, { busy: false, result: imported, error: "" });
  });

  it("restores the running DSH after import fails and surfaces both import and restart errors", async () => {
    native.invoke.mockImplementation(async (command: string) => {
      if (command === "dsh_runtime_status") return { phase: "running" };
      if (command === "dsh_runtime_import_xiaoyan_api") throw new Error("未配置主模型");
      if (command === "dsh_runtime_start") throw new Error("synthetic restart failure");
    });
    const { result } = renderHook(() => useDshApiSyncHost(refresh));
    await act(async () => { await result.current.sync(); });
    expect(native.invoke).toHaveBeenCalledWith("dsh_runtime_start");
    expect(refresh).toHaveBeenCalledOnce();
    expect(result.current.state).toEqual({ busy: false, result: null, error: "未配置主模型；synthetic restart failure" });
  });

  it("leaves a stopped runtime stopped after syncing", async () => {
    native.invoke.mockImplementation(async (command: string) => {
      if (command === "dsh_runtime_status") return { phase: "stopped" };
      if (command === "dsh_runtime_import_xiaoyan_api") return imported;
    });
    const { result } = renderHook(() => useDshApiSyncHost(refresh));
    await act(async () => { await result.current.sync(); });
    expect(native.invoke).not.toHaveBeenCalledWith("dsh_runtime_stop");
    expect(native.invoke).not.toHaveBeenCalledWith("dsh_runtime_start");
    expect(result.current.state.result).toEqual(imported);
  });

  it("finishes restart even if the host is unmounted during sync", async () => {
    let finishImport!: (value: typeof imported) => void;
    const pending = new Promise<typeof imported>((resolve) => { finishImport = resolve; });
    native.invoke.mockImplementation(async (command: string) => {
      if (command === "dsh_runtime_status") return { phase: "running" };
      if (command === "dsh_runtime_import_xiaoyan_api") return pending;
    });
    const { result, unmount } = renderHook(() => useDshApiSyncHost(refresh));
    let operation!: Promise<void>;
    act(() => { operation = result.current.sync(); });
    await waitFor(() => expect(native.invoke).toHaveBeenCalledWith("dsh_runtime_import_xiaoyan_api"));
    unmount();
    finishImport(imported);
    await operation;
    expect(native.invoke).toHaveBeenCalledWith("dsh_runtime_start");
    expect(native.emit).toHaveBeenLastCalledWith(DSH_API_SYNC_STATE, { busy: false, result: imported, error: "" });
  });
});
