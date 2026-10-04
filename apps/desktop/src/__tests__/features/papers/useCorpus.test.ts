import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCorpus } from "../../../features/papers/useCorpus";
import type { CorpusEntry } from "../../../features/papers/corpusTypes";

const api = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() }));
vi.mock("../../../lib/client", () => ({ paperCorpusApi: api }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((success, failure) => { resolve = success; reject = failure; });
  return { promise, resolve, reject };
}

function entry(id = "entry-a", paperId = "paper-a", note = "原备注"): CorpusEntry {
  return { id, paper_id: paperId, text: "论文原文", note, page: 1, created_at: "2026-10-01T00:00:00Z" };
}

async function loadedHook() {
  api.list.mockResolvedValue([entry()]);
  const hook = renderHook(({ paperId }) => useCorpus(paperId), {
    initialProps: { paperId: "paper-a" as string | undefined },
  });
  await waitFor(() => expect(hook.result.current.entries).toHaveLength(1));
  return hook;
}

describe("useCorpus 的论文隔离与持久化", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    api.list.mockResolvedValue([]);
    api.create.mockResolvedValue(entry("created"));
    api.update.mockImplementation(async (id, patch) => entry(id, "paper-a", patch.note));
    api.delete.mockResolvedValue(undefined);
  });

  it("切换后忽略旧论文较晚返回的列表", async () => {
    const old = deferred<CorpusEntry[]>();
    api.list.mockImplementation((id) => id === "paper-a" ? old.promise : Promise.resolve([entry("entry-b", "paper-b")]));
    const { result, rerender } = renderHook(({ paperId }) => useCorpus(paperId), { initialProps: { paperId: "paper-a" } });
    rerender({ paperId: "paper-b" });
    await waitFor(() => expect(result.current.entries[0]?.id).toBe("entry-b"));
    await act(async () => { old.resolve([entry()]); });
    expect(result.current.entries.map((item) => item.id)).toEqual(["entry-b"]);
  });

  it("切换后立即清除上一论文的语料", async () => {
    const { result, rerender } = await loadedHook();
    const load = deferred<CorpusEntry[]>();
    api.list.mockReturnValue(load.promise);
    rerender({ paperId: "paper-b" });
    expect(result.current.entries).toEqual([]);
    expect(result.current.loading).toBe(true);
    await act(async () => { load.resolve([]); });
  });

  it("切换后较晚完成的创建不插入当前论文", async () => {
    const creation = deferred<CorpusEntry>();
    const { result, rerender } = await loadedHook();
    api.create.mockReturnValueOnce(creation.promise);
    let pending!: Promise<CorpusEntry | null>;
    act(() => { pending = result.current.addEntry({ paperId: "paper-a", text: "原文" }); });
    await waitFor(() => expect(api.create).toHaveBeenCalledOnce());
    api.list.mockResolvedValue([entry("entry-b", "paper-b")]);
    rerender({ paperId: "paper-b" });
    await waitFor(() => expect(result.current.entries[0]?.id).toBe("entry-b"));
    await act(async () => { creation.resolve(entry("created")); await pending; });
    expect(result.current.entries.map((item) => item.id)).toEqual(["entry-b"]);
  });

  it("修改失败保持已保存备注，成功重试后清除错误", async () => {
    const { result } = await loadedHook();
    api.update.mockRejectedValueOnce(new Error("数据库不可写"));
    await act(async () => { await result.current.updateNote("entry-a", "修改草稿"); });
    expect(result.current.entries[0].note).toBe("原备注");
    expect(result.current.error).toBe("数据库不可写");
    await act(async () => { await result.current.updateNote("entry-a", "修改草稿"); });
    expect(result.current.entries[0].note).toBe("修改草稿");
    expect(result.current.error).toBe("");
  });

  it("删除失败不会覆盖同时新建成功的语料", async () => {
    const deletion = deferred<void>();
    const { result } = await loadedHook();
    api.delete.mockReturnValueOnce(deletion.promise);
    let pending!: Promise<unknown[]>;
    act(() => {
      pending = Promise.all([
        result.current.deleteEntry("entry-a"),
        result.current.addEntry({ paperId: "paper-a", text: "新原文" }),
      ]);
    });
    await waitFor(() => expect(api.delete).toHaveBeenCalledOnce());
    await act(async () => { deletion.reject(new Error("删除失败")); await pending; });
    expect(result.current.entries.map((item) => item.id)).toEqual(["created", "entry-a"]);
  });

  it("旧论文删除失败不会覆盖新论文的记录或错误状态", async () => {
    const deletion = deferred<void>();
    const { result, rerender } = await loadedHook();
    api.delete.mockReturnValueOnce(deletion.promise);
    let pending!: Promise<unknown>;
    act(() => { pending = result.current.deleteEntry("entry-a"); });
    await waitFor(() => expect(api.delete).toHaveBeenCalledOnce());
    api.list.mockResolvedValue([entry("entry-b", "paper-b")]);
    rerender({ paperId: "paper-b" });
    await waitFor(() => expect(result.current.entries[0]?.id).toBe("entry-b"));
    await act(async () => { deletion.reject(new Error("旧论文删除失败")); await pending; });
    expect(result.current.entries.map((item) => item.id)).toEqual(["entry-b"]);
    expect(result.current.error).toBe("");
  });

  it("快速连续修改按调用顺序落库，迟到回执不会回退备注", async () => {
    const first = deferred<CorpusEntry>();
    const { result } = await loadedHook();
    api.update.mockReturnValueOnce(first.promise);
    let pending!: Promise<unknown[]>;
    act(() => {
      pending = Promise.all([result.current.updateNote("entry-a", "第一次"), result.current.updateNote("entry-a", "第二次")]);
    });
    await waitFor(() => expect(api.update).toHaveBeenCalledOnce());
    await act(async () => { first.resolve(entry("entry-a", "paper-a", "第一次")); await pending; });
    expect(result.current.entries[0].note).toBe("第二次");
  });

  it("全局语料库仍可加载不同论文与未关联记录", async () => {
    api.list.mockResolvedValue([entry(), entry("entry-b", "paper-b"), { ...entry("unlinked"), paper_id: null }]);
    const { result } = renderHook(() => useCorpus());
    await waitFor(() => expect(result.current.entries).toHaveLength(3));
    expect(api.list).toHaveBeenCalledWith(undefined);
  });

  it("空白语料不会发送创建请求", async () => {
    const { result } = await loadedHook();
    await act(async () => { expect(await result.current.addEntry({ text: "  " })).toBeNull(); });
    expect(api.create).not.toHaveBeenCalled();
  });

  it("当前论文范围创建语料时默认关联当前论文", async () => {
    const { result } = await loadedHook();
    await act(async () => { await result.current.addEntry({ text: "新原文" }); });
    expect(api.create).toHaveBeenCalledWith(expect.objectContaining({ paper_id: "paper-a" }));
    expect(result.current.entries[0].id).toBe("created");
  });

  it("创建返回错误论文的记录时不给出成功结果", async () => {
    const { result } = await loadedHook();
    api.create.mockResolvedValueOnce(entry("wrong", "paper-b"));
    await act(async () => { expect(await result.current.addEntry({ text: "新原文" })).toBeNull(); });
    expect(result.current.entries.map((item) => item.id)).toEqual(["entry-a"]);
    expect(result.current.error).toMatch(/无效记录/);
  });

  it("重载失败保持已保存语料，重试成功后清除错误", async () => {
    const { result } = await loadedHook();
    api.list.mockRejectedValueOnce(new Error("读取失败"));
    await act(async () => { await result.current.reload(); });
    expect(result.current.entries[0].id).toBe("entry-a");
    expect(result.current.error).toBe("读取失败");
    expect(result.current.loading).toBe(false);
    await act(async () => { await result.current.reload(); });
    expect(result.current.error).toBe("");
  });

  it("重挂载后的新备注不能被旧会话仍在进行的保存覆盖", async () => {
    const update = deferred<void>();
    let stored = entry();
    api.list.mockImplementation(async () => [{ ...stored }]);
    api.update.mockImplementation(async (_id, patch) => {
      if (patch.note === "先前编辑") await update.promise;
      stored = { ...stored, note: patch.note };
      return { ...stored };
    });
    const old = renderHook(() => useCorpus("paper-a"));
    await waitFor(() => expect(old.result.current.entries).toHaveLength(1));
    let pending!: Promise<boolean | null>;
    act(() => { pending = old.result.current.updateNote("entry-a", "先前编辑"); });
    await waitFor(() => expect(api.update).toHaveBeenCalledOnce());
    old.unmount();
    const latest = renderHook(() => useCorpus("paper-a"));
    let latestSave!: Promise<boolean | null>;
    act(() => { latestSave = latest.result.current.updateNote("entry-a", "返回后编辑"); });
    await act(async () => {});
    await act(async () => { update.resolve(); await pending; await latestSave; });
    expect(latest.result.current.entries[0]?.note).toBe("返回后编辑");
    expect(stored.note).toBe("返回后编辑");
    expect(api.update).toHaveBeenCalledTimes(2);
  });

  it("全局语料库重挂载时也等待先前创建，恢复已落库的新记录", async () => {
    const creation = deferred<void>();
    const stored = [entry()];
    api.list.mockImplementation(async () => [...stored]);
    api.create.mockImplementation(async () => {
      await creation.promise;
      const created = entry("created");
      stored.push(created);
      return created;
    });
    const old = renderHook(() => useCorpus());
    await waitFor(() => expect(old.result.current.entries).toHaveLength(1));
    let pending!: Promise<CorpusEntry | null>;
    act(() => { pending = old.result.current.addEntry({ paperId: "paper-a", text: "新原文" }); });
    await waitFor(() => expect(api.create).toHaveBeenCalledOnce());
    old.unmount();
    const latest = renderHook(() => useCorpus());
    await act(async () => { creation.resolve(); await pending; });
    await waitFor(() => expect(latest.result.current.loading).toBe(false));
    expect(latest.result.current.entries.map((item) => item.id)).toEqual(["entry-a", "created"]);
  });

  it("从论文阅读进入全局语料库时，等待读取范围内旧保存完成", async () => {
    const creation = deferred<void>();
    const stored = [entry()];
    api.list.mockImplementation(async () => [...stored]);
    api.create.mockImplementation(async () => {
      await creation.promise;
      const created = entry("created");
      stored.push(created);
      return created;
    });
    const old = renderHook(() => useCorpus("paper-a"));
    await waitFor(() => expect(old.result.current.entries).toHaveLength(1));
    let pending!: Promise<CorpusEntry | null>;
    act(() => { pending = old.result.current.addEntry({ text: "阅读选区" }); });
    await waitFor(() => expect(api.create).toHaveBeenCalledOnce());
    old.unmount();
    const global = renderHook(() => useCorpus());
    await act(async () => { creation.resolve(); await pending; });
    await waitFor(() => expect(global.result.current.loading).toBe(false));
    expect(global.result.current.entries.map((item) => item.id)).toEqual(["entry-a", "created"]);
  });
});
