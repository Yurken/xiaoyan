import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useReaderNotes } from "../../../features/reader/useReaderNotes";
import type { PaperNote } from "../../../features/reader/readerTypes";

const api = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() }));
vi.mock("../../../lib/client", () => ({ paperNotesApi: api }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((success, failure) => { resolve = success; reject = failure; });
  return { promise, resolve, reject };
}

function note(id = "note-a", paperId = "paper-a", content = "原笔记"): PaperNote {
  return {
    id, paper_id: paperId, page: 1, content, style: "highlight", highlight_color: "yellow",
    fill_color: null, highlight_positions: [{ x: 0.1, y: 0.2, w: 0.3, h: 0.02 }],
    created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z",
  };
}

const input = {
  page: 1, highlightText: "原文", color: "yellow" as const,
  style: "highlight" as const, positions: [{ x: 0.1, y: 0.2, w: 0.3, h: 0.02 }],
};

async function loadedHook() {
  api.list.mockResolvedValue([note()]);
  const hook = renderHook(({ paperId }) => useReaderNotes(paperId), {
    initialProps: { paperId: "paper-a" as string | undefined },
  });
  await waitFor(() => expect(hook.result.current.notes).toHaveLength(1));
  return hook;
}

describe("useReaderNotes 的持久化与论文切换", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    api.list.mockResolvedValue([]);
    api.update.mockImplementation(async (id, patch) => ({ ...note(id), ...patch }));
    api.create.mockResolvedValue(note("created"));
    api.delete.mockResolvedValue(undefined);
  });

  it("切换后忽略上一论文较晚返回的批注列表", async () => {
    const first = deferred<PaperNote[]>();
    const second = deferred<PaperNote[]>();
    api.list.mockImplementation((id) => id === "paper-a" ? first.promise : second.promise);
    const { result, rerender } = renderHook(({ paperId }) => useReaderNotes(paperId), {
      initialProps: { paperId: "paper-a" },
    });
    rerender({ paperId: "paper-b" });
    await act(async () => { second.resolve([note("note-b", "paper-b")]); });
    await act(async () => { first.resolve([note()]); });
    expect(result.current.notes.map((item) => item.paper_id)).toEqual(["paper-b"]);
  });

  it("新论文加载期间立即清除上一论文的批注", async () => {
    const { result, rerender } = await loadedHook();
    const load = deferred<PaperNote[]>();
    api.list.mockReturnValue(load.promise);
    rerender({ paperId: "paper-b" });
    expect(result.current.notes).toEqual([]);
    expect(result.current.loading).toBe(true);
    await act(async () => { load.resolve([]); });
  });

  it("较晚完成的创建只保存到原论文，不污染新论文及撤销栈", async () => {
    const creation = deferred<PaperNote>();
    api.create.mockReturnValue(creation.promise);
    const { result, rerender } = await loadedHook();
    let pending!: Promise<void>;
    act(() => { pending = result.current.createAnnotation(input); });
    await waitFor(() => expect(api.create).toHaveBeenCalledOnce());
    api.list.mockResolvedValue([note("note-b", "paper-b")]);
    rerender({ paperId: "paper-b" });
    await waitFor(() => expect(result.current.notes[0]?.id).toBe("note-b"));
    await act(async () => { creation.resolve(note("created")); await pending; });
    expect(result.current.notes.map((item) => item.id)).toEqual(["note-b"]);
    await act(async () => { await result.current.undo(); });
    expect(api.delete).not.toHaveBeenCalled();
  });

  it.each([
    ["内容", (hook: ReturnType<typeof useReaderNotes>) => hook.updateContent("note-a", "新笔记")],
    ["颜色", (hook: ReturnType<typeof useReaderNotes>) => hook.updateColor("note-a", "blue")],
    ["填充", (hook: ReturnType<typeof useReaderNotes>) => hook.updateFill("note-a", "pink")],
    ["位置", (hook: ReturnType<typeof useReaderNotes>) => hook.moveAnnotation("note-a", [{ x: 0, y: 0, w: 0.2, h: 0.1 }])],
  ])("更新%s失败后保持已保存记录，不生成虚假的撤销项", async (_label, update) => {
    const { result } = await loadedHook();
    const previous = result.current.notes;
    api.update.mockRejectedValueOnce(new Error("数据库不可写"));
    await act(async () => { await update(result.current); });
    expect(result.current.notes).toEqual(previous);
    expect(result.current.error).toBe("数据库不可写");
    await act(async () => { await result.current.undo(); });
    expect(api.update).toHaveBeenCalledOnce();
  });

  it("删除失败后保留原批注，撤销不会复制仍然存在的批注", async () => {
    const { result } = await loadedHook();
    api.delete.mockRejectedValueOnce(new Error("数据库不可写"));
    await act(async () => { await result.current.deleteAnnotation("note-a"); });
    expect(result.current.notes).toHaveLength(1);
    await act(async () => { await result.current.undo(); });
    expect(api.create).not.toHaveBeenCalled();
  });

  it("撤销落库失败后保持记录与撤销项，允许再次重试", async () => {
    const { result } = await loadedHook();
    await act(async () => { await result.current.updateColor("note-a", "blue"); });
    api.update.mockRejectedValueOnce(new Error("暂时不可写"));
    await act(async () => { await result.current.undo(); });
    expect(result.current.notes[0].highlight_color).toBe("blue");
    expect(result.current.error).toBe("暂时不可写");
    await act(async () => { await result.current.undo(); });
    expect(result.current.notes[0].highlight_color).toBe("yellow");
    expect(result.current.error).toBe("");
    expect(api.update).toHaveBeenCalledTimes(3);
  });

  it("串行持久化快速连续修改，每次撤销恢复上一次成功值", async () => {
    const first = deferred<PaperNote>();
    const { result } = await loadedHook();
    api.update.mockReturnValueOnce(first.promise);
    let operations!: Promise<void[]>;
    act(() => {
      operations = Promise.all([
        result.current.updateContent("note-a", "第一次"),
        result.current.updateContent("note-a", "第二次"),
      ]);
    });
    await waitFor(() => expect(api.update).toHaveBeenCalledOnce());
    await act(async () => { first.resolve(note("note-a", "paper-a", "第一次")); await operations; });
    expect(result.current.notes[0].content).toBe("第二次");
    await act(async () => { await result.current.undo(); });
    expect(result.current.notes[0].content).toBe("第一次");
    await act(async () => { await result.current.undo(); });
    expect(result.current.notes[0].content).toBe("原笔记");
  });

  it("恢复删除后同步新的记录 ID，更早的修改仍能撤销", async () => {
    const { result } = await loadedHook();
    await act(async () => { await result.current.updateColor("note-a", "blue"); });
    await act(async () => { await result.current.deleteAnnotation("note-a"); });
    api.create.mockResolvedValueOnce({ ...note("restored"), highlight_color: "blue" });
    await act(async () => { await result.current.undo(); });
    await act(async () => { await result.current.undo(); });
    expect(api.update).toHaveBeenLastCalledWith("restored", { highlight_color: "yellow" });
    expect(result.current.notes[0]).toMatchObject({ id: "restored", highlight_color: "yellow" });
  });

  it("缺少论文 ID 时清除状态并禁止持久化", async () => {
    const { result, rerender } = await loadedHook();
    rerender({ paperId: undefined });
    await act(async () => { await result.current.createAnnotation(input); });
    expect(result.current.notes).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(api.create).not.toHaveBeenCalled();
  });

  it("旧论文修改失败不会覆盖新论文的记录、错误或加载状态", async () => {
    const update = deferred<PaperNote>();
    const { result, rerender } = await loadedHook();
    api.update.mockReturnValueOnce(update.promise);
    let pending!: Promise<void>;
    act(() => { pending = result.current.updateContent("note-a", "新内容"); });
    await waitFor(() => expect(api.update).toHaveBeenCalledOnce());
    api.list.mockResolvedValue([note("note-b", "paper-b")]);
    rerender({ paperId: "paper-b" });
    await waitFor(() => expect(result.current.notes[0]?.id).toBe("note-b"));
    await act(async () => { update.reject(new Error("旧论文保存失败")); await pending; });
    expect(result.current.notes.map((item) => item.id)).toEqual(["note-b"]);
    expect(result.current.error).toBe("");
    expect(result.current.loading).toBe(false);
  });

  it("重载失败保留已保存批注，重试成功后恢复正常", async () => {
    const { result } = await loadedHook();
    api.list.mockRejectedValueOnce(new Error("读取失败"));
    await act(async () => { await result.current.reload(); });
    expect(result.current.notes[0]?.id).toBe("note-a");
    expect(result.current.error).toBe("读取失败");
    expect(result.current.loading).toBe(false);
    await act(async () => { await result.current.reload(); });
    expect(result.current.error).toBe("");
  });

  it("恢复删除失败保留撤销项，再次撤销可重试", async () => {
    const { result } = await loadedHook();
    await act(async () => { await result.current.deleteAnnotation("note-a"); });
    api.create.mockRejectedValueOnce(new Error("恢复失败"));
    await act(async () => { await result.current.undo(); });
    expect(result.current.notes).toEqual([]);
    expect(result.current.error).toBe("恢复失败");
    await act(async () => { await result.current.undo(); });
    expect(result.current.notes[0]?.id).toBe("created");
    expect(result.current.error).toBe("");
  });

  it("撤销新建再删除恢复后的批注时，删除恢复生成的新 ID", async () => {
    const { result } = await loadedHook();
    await act(async () => { await result.current.createAnnotation(input); });
    await act(async () => { await result.current.deleteAnnotation("created"); });
    api.create.mockResolvedValueOnce(note("restored"));
    await act(async () => { await result.current.undo(); });
    await act(async () => { await result.current.undo(); });
    expect(api.delete).toHaveBeenLastCalledWith("restored");
    expect(result.current.notes.map((item) => item.id)).toEqual(["note-a"]);
  });

  it("等待创建落库后再重载，避免旧列表覆盖刚保存的批注", async () => {
    const creation = deferred<PaperNote>();
    const { result } = await loadedHook();
    api.create.mockReturnValueOnce(creation.promise);
    api.list.mockResolvedValueOnce([note(), note("created")]);
    let pending!: Promise<void[]>;
    act(() => { pending = Promise.all([result.current.createAnnotation(input), result.current.reload()]); });
    await waitFor(() => expect(api.create).toHaveBeenCalledOnce());
    expect(api.list).toHaveBeenCalledOnce();
    await act(async () => { creation.resolve(note("created")); await pending; });
    expect(result.current.notes.map((item) => item.id)).toEqual(["note-a", "created"]);
  });

  it("重复选择已经保存的颜色不会占用撤销历史", async () => {
    const { result } = await loadedHook();
    await act(async () => { await result.current.updateColor("note-a", "blue"); });
    await act(async () => { await result.current.updateColor("note-a", "blue"); });
    await act(async () => { await result.current.undo(); });
    expect(result.current.notes[0].highlight_color).toBe("yellow");
    expect(api.update).toHaveBeenCalledTimes(2);
  });

  it("重挂载同一论文时等待旧创建落库，再恢复最新批注且不继承撤销历史", async () => {
    const creation = deferred<void>();
    const stored = [note()];
    api.list.mockImplementation(async () => [...stored]);
    api.create.mockImplementation(async () => {
      await creation.promise;
      const created = note("created");
      stored.push(created);
      return created;
    });
    const old = renderHook(() => useReaderNotes("paper-a"));
    await waitFor(() => expect(old.result.current.notes).toHaveLength(1));
    let pending!: Promise<void>;
    act(() => { pending = old.result.current.createAnnotation(input); });
    await waitFor(() => expect(api.create).toHaveBeenCalledOnce());
    old.unmount();
    const latest = renderHook(() => useReaderNotes("paper-a"));
    await act(async () => { creation.resolve(); await pending; });
    await waitFor(() => expect(latest.result.current.loading).toBe(false));
    expect(stored.map((item) => item.id)).toEqual(["note-a", "created"]);
    expect(latest.result.current.notes.map((item) => item.id)).toEqual(["note-a", "created"]);
    await act(async () => { await latest.result.current.undo(); });
    expect(api.delete).not.toHaveBeenCalled();
  });

  it("A→B→A 等待原论文旧保存，不阻塞 B，返回后的撤销仅处理新操作", async () => {
    const update = deferred<void>();
    let stored = note();
    api.list.mockImplementation(async (id) => id === "paper-a" ? [{ ...stored }] : [note("note-b", "paper-b")]);
    api.update.mockImplementation(async (id, patch) => {
      if (patch.content === "先前编辑") await update.promise;
      stored = { ...stored, ...patch };
      return { ...stored, id };
    });
    const { result, rerender } = renderHook(({ paperId }) => useReaderNotes(paperId), {
      initialProps: { paperId: "paper-a" },
    });
    await waitFor(() => expect(result.current.notes).toHaveLength(1));
    let pending!: Promise<void>;
    act(() => { pending = result.current.updateContent("note-a", "先前编辑"); });
    await waitFor(() => expect(api.update).toHaveBeenCalledOnce());
    rerender({ paperId: "paper-b" });
    await waitFor(() => expect(result.current.notes[0]?.id).toBe("note-b"));
    rerender({ paperId: "paper-a" });
    await act(async () => { update.resolve(); await pending; });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.notes[0].content).toBe("先前编辑");
    await act(async () => { await result.current.updateContent("note-a", "返回后编辑"); });
    await act(async () => { await result.current.undo(); await result.current.undo(); });
    expect(result.current.notes[0].content).toBe("先前编辑");
    expect(stored.content).toBe("先前编辑");
    expect(api.update).toHaveBeenCalledTimes(3);
  });
});
