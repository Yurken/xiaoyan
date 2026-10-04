import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useCodeWorkspace } from "../../features/code/useCodeWorkspace";
import type { CodeSession } from "../../lib/client";

vi.mock("../../features/code/useCodeModelOptions", () => ({ useCodeModelOptions: () => ({ currentModel: "selected-code-model" }) }));

const handlers = new Map<string, (event: { payload: unknown }) => void>();
const session = (id: string): CodeSession => ({
  id, experiment_id: "exp", title: id, working_dir: null, messages: [],
  model: null, tool_id: null, created_at: "2026-01-01", updated_at: "2026-01-01",
});
const sessions = [session("first"), session("second")];
const invokeMock = vi.mocked(invoke);

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => { resolve = complete; });
  return { promise, resolve };
}

function emit(name: string, payload: unknown) {
  handlers.get(name)?.({ payload });
}

async function setup() {
  const hook = renderHook(() => useCodeWorkspace("exp", { workingDir: null }));
  await waitFor(() => expect(hook.result.current.chatLoading).toBe(false));
  await waitFor(() => expect(handlers.has("code:title_changed")).toBe(true));
  act(() => hook.result.current.selectSession(sessions[0]));
  return hook;
}

async function send(hook: Awaited<ReturnType<typeof setup>>, content = "实现功能") {
  act(() => hook.result.current.setInput(content));
  await act(async () => { await hook.result.current.handleSend(); });
  const call = invokeMock.mock.calls.filter(([name]) => name === "code_send_message").at(-1);
  return call?.[1] as { sessionId: string; requestId: string };
}

beforeEach(() => {
  handlers.clear();
  invokeMock.mockReset();
  vi.mocked(listen).mockImplementation(async (name, handler) => {
    handlers.set(name as string, handler as (event: { payload: unknown }) => void);
    return () => { handlers.delete(name as string); };
  });
  invokeMock.mockImplementation(async (name) => {
    if (name === "code_list_sessions") return { sessions };
    return undefined;
  });
});

describe("useCodeWorkspace request lifecycle", () => {
  it("can stop before the first delta and ignores late results", async () => {
    const hook = await setup();
    const request = await send(hook);
    expect(request.requestId).toEqual(expect.any(String));
    expect(hook.result.current.requestId).toBe(request.requestId);

    act(() => hook.result.current.cancelActiveStream());
    expect(invokeMock).toHaveBeenCalledWith("code_cancel", { requestId: request.requestId });
    act(() => {
      emit("code:stream", { session_id: "first", request_id: request.requestId, chunk: "已停止的输出" });
      emit("code:done", {
        session_id: "first", request_id: request.requestId,
        message_id: "late", full_content: "过期结果", duration_ms: 10,
      });
    });
    expect(hook.result.current.streamingContent).toBe("");
    expect(hook.result.current.selected?.messages.some((message) => message.id === "late")).toBe(false);
    expect(hook.result.current.sending).toBe(false);
  });

  it("does not let an old request finish a replacement in the same session", async () => {
    const hook = await setup();
    const first = await send(hook);
    act(() => hook.result.current.cancelActiveStream());
    const next = await send(hook, "下一轮");
    act(() => emit("code:error", {
      session_id: "first", request_id: first.requestId, error: "旧请求错误",
    }));
    expect(hook.result.current.sending).toBe(true);
    expect(hook.result.current.requestId).toBe(next.requestId);
    expect(hook.result.current.toast).toBe("");
  });

  it("cancels the previous session when switching and permits a new send", async () => {
    const hook = await setup();
    const first = await send(hook);
    act(() => hook.result.current.selectSession(sessions[1]));
    expect(hook.result.current.sending).toBe(false);
    expect(invokeMock).toHaveBeenCalledWith("code_cancel", { requestId: first.requestId });
    const next = await send(hook, "另一个会话的问题");
    expect(next.sessionId).toBe("second");
    act(() => emit("code:done", {
      session_id: "first", request_id: first.requestId,
      message_id: "old", full_content: "旧会话结果", duration_ms: 1,
    }));
    expect(hook.result.current.sending).toBe(true);
    act(() => emit("code:done", {
      session_id: "second", request_id: next.requestId,
      message_id: "new", full_content: "新会话结果", duration_ms: 1,
    }));
    expect(hook.result.current.sending).toBe(false);
    expect(hook.result.current.selected?.messages.at(-1)?.content).toBe("新会话结果");
  });

  it("retries stop after native task registration acknowledges a pending send", async () => {
    const hook = await setup();
    const acknowledgement = deferred<void>();
    invokeMock.mockImplementation(async (name) => {
      if (name === "code_send_message") return acknowledgement.promise;
      return undefined;
    });
    act(() => hook.result.current.setInput("等待模型"));
    let sending!: Promise<void>;
    act(() => { sending = hook.result.current.handleSend(); });
    await waitFor(() => expect(invokeMock.mock.calls.some(([name]) => name === "code_send_message")).toBe(true));
    const id = hook.result.current.requestId;
    act(() => hook.result.current.cancelActiveStream());
    await act(async () => {
      acknowledgement.resolve();
      await sending;
    });
    const cancellations = invokeMock.mock.calls.filter(([name]) => name === "code_cancel");
    expect(cancellations).toEqual([
      ["code_cancel", { requestId: id }],
      ["code_cancel", { requestId: id }],
    ]);
  });

  it("does not send after cancellation while automatically creating a session", async () => {
    const created = deferred<CodeSession>();
    invokeMock.mockImplementation(async (name) => {
      if (name === "code_list_sessions") return { sessions: [] };
      if (name === "code_create_session") return created.promise;
      return undefined;
    });
    const hook = renderHook(() => useCodeWorkspace("exp", { workingDir: null }));
    await waitFor(() => expect(hook.result.current.chatLoading).toBe(false));
    act(() => hook.result.current.setInput("创建并发送"));
    let sending!: Promise<void>;
    act(() => { sending = hook.result.current.handleSend(); });
    expect(hook.result.current.sending).toBe(true);
    act(() => hook.result.current.cancelActiveStream());
    await act(async () => {
      created.resolve(session("created"));
      await sending;
    });
    expect(invokeMock.mock.calls.some(([name]) => name === "code_send_message")).toBe(false);
    expect(hook.result.current.selectedId).toBeNull();
    expect(hook.result.current.sending).toBe(false);
  });

  it("does not start two requests from sends in the same tick", async () => {
    const hook = await setup();
    act(() => hook.result.current.setInput("只发送一次"));
    await act(async () => {
      await Promise.all([hook.result.current.handleSend(), hook.result.current.handleSend()]);
    });
    expect(invokeMock.mock.calls.filter(([name]) => name === "code_send_message")).toHaveLength(1);
    expect(hook.result.current.selected?.messages.filter((message) => message.role === "user")).toHaveLength(1);
  });

  it("cleans native listeners that register after the workspace unmounts", async () => {
    const registered = deferred<() => void>();
    const stop = vi.fn();
    vi.mocked(listen).mockImplementation(() => registered.promise);
    const hook = renderHook(() => useCodeWorkspace("exp", { workingDir: null }));
    hook.unmount();
    await act(async () => { registered.resolve(stop); });
    expect(stop).toHaveBeenCalledTimes(7);
  });

  it("preserves pending messages when a title refresh precedes backend persistence", async () => {
    const hook = await setup();
    await send(hook);
    await act(async () => { emit("code:title_changed", { session_id: "first" }); });
    expect(hook.result.current.selected?.messages.at(-1)?.content).toBe("实现功能");
  });

  it("sends the model selected in the code workspace with the generation request", async () => {
    const hook = await setup();
    await send(hook);
    const payload = invokeMock.mock.calls.find(([name]) => name === "code_send_message")?.[1];
    expect(payload).toMatchObject({ model: "selected-code-model" });
  });

  it("does not surface a late cancellation failure in a newer request", async () => {
    const hook = await setup();
    await send(hook);
    let reject!: (error: Error) => void;
    const cancellation = new Promise<void>((_, fail) => { reject = fail; });
    invokeMock.mockImplementation(async (name) => name === "code_cancel" ? cancellation : undefined);
    act(() => hook.result.current.cancelActiveStream());
    const next = await send(hook, "新请求");
    await act(async () => { reject(new Error("旧取消请求失败")); });
    expect(hook.result.current.toast).toBe("");
    expect(hook.result.current.requestId).toBe(next.requestId);
    expect(hook.result.current.sending).toBe(true);
  });

  it("shows a native stop failure while the stopped request is still the latest", async () => {
    const hook = await setup();
    await send(hook);
    invokeMock.mockImplementation(async (name) => {
      if (name === "code_cancel") throw new Error("停止请求失败");
      return undefined;
    });
    await act(async () => { hook.result.current.cancelActiveStream(); });
    expect(hook.result.current.toast).toBe("停止请求失败");
  });
});
