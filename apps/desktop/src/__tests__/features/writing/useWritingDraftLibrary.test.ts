import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useWritingDraftLibrary } from "../../../features/writing/useWritingDraftLibrary";
import {
  WRITING_LIBRARY_STORAGE_KEY,
  WRITING_PENDING_DRAFTS_KEY,
  writingDraftContentSignature,
  type WritingDraft,
} from "../../../features/writing/shared";
import { WRITING_LIBRARY_MIGRATED_KEY } from "../../../features/writing/legacyDraftLibrary";
import { getInvokeMock, resetInvokeMock } from "../../mocks/tauri";

function backendDraft(id: string, projectName: string): WritingDraft {
  return {
    id,
    projectName,
    templateId: "journal",
    mainTex: `\\section{${projectName}}`,
    bibtex: "",
    texFiles: [],
    notes: "",
    imageAssets: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function mockBackend(drafts: WritingDraft[]) {
  const implementation = async (command: string, args?: { request?: WritingDraft }) => {
    if (command === "knowledge_list_interests") return [];
    if (command === "writing_draft_list") return drafts;
    if (command === "writing_draft_create") return args?.request;
    if (command === "writing_draft_update" || command === "writing_draft_delete") return undefined;
    throw new Error(`Unmocked invoke: ${command}`);
  };
  getInvokeMock().mockImplementation(implementation);
  return implementation;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe("useWritingDraftLibrary", () => {
  beforeEach(() => {
    resetInvokeMock();
    localStorage.clear();
    vi.mocked(localStorage.setItem).mockClear();
  });

  it("后端模式：草稿从后端加载，编辑防抖后回写 update 命令", async () => {
    mockBackend([backendDraft("d1", "论文一"), backendDraft("d2", "论文二")]);
    const { result } = renderHook(() => useWritingDraftLibrary());

    await waitFor(() => expect(result.current.libraryReady).toBe(true));
    expect(result.current.drafts.map((draft) => draft.id)).toEqual(["d1", "d2"]);
    expect(result.current.activeDraftId).toBe("d1");
    // 与后端一致的内容不触发回写。
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 450));
    });
    expect(getInvokeMock()).not.toHaveBeenCalledWith("writing_draft_update", expect.anything());

    act(() => {
      result.current.updateActiveDraft({ mainTex: "\\section{新内容}" });
    });
    await waitFor(() => {
      expect(getInvokeMock()).toHaveBeenCalledWith("writing_draft_update", {
        request: expect.objectContaining({ id: "d1", mainTex: "\\section{新内容}" }),
      });
    });
  });

  it("后端模式：新建与删除草稿走后端命令", async () => {
    mockBackend([backendDraft("d1", "论文一"), backendDraft("d2", "论文二")]);
    const { result } = renderHook(() => useWritingDraftLibrary());
    await waitFor(() => expect(result.current.libraryReady).toBe(true));

    let created: WritingDraft | undefined;
    act(() => {
      created = result.current.createDraft();
    });
    expect(created?.id).toBeTruthy();
    await waitFor(() => {
      expect(getInvokeMock()).toHaveBeenCalledWith("writing_draft_create", {
        request: expect.objectContaining({ id: created?.id }),
      });
    });

    act(() => {
      expect(result.current.deleteDraft("d2")).toBe(true);
    });
    await waitFor(() => {
      expect(getInvokeMock()).toHaveBeenCalledWith("writing_draft_delete", { id: "d2" });
    });
  });

  it("检测到旧 localStorage 草稿库时一次性导入后端并写迁移标记", async () => {
    localStorage.setItem(
      WRITING_LIBRARY_STORAGE_KEY,
      JSON.stringify({ drafts: [backendDraft("legacy-1", "旧论文")] }),
    );
    mockBackend([]);
    const { result } = renderHook(() => useWritingDraftLibrary());

    await waitFor(() => expect(result.current.libraryReady).toBe(true));
    await waitFor(() => {
      expect(getInvokeMock()).toHaveBeenCalledWith("writing_draft_create", {
        request: expect.objectContaining({ id: "legacy-1", projectName: "旧论文" }),
      });
    });
    expect(localStorage.getItem(WRITING_LIBRARY_MIGRATED_KEY)).toBeTruthy();
    expect(result.current.migrationSummary?.imported).toBe(1);

    // 再次启动（已有标记）不重复导入。
    resetInvokeMock();
    mockBackend([backendDraft("legacy-1", "旧论文")]);
    const { result: second } = renderHook(() => useWritingDraftLibrary());
    await waitFor(() => expect(second.current.libraryReady).toBe(true));
    expect(getInvokeMock()).not.toHaveBeenCalledWith("writing_draft_create", expect.anything());
  });

  it("非 Tauri 环境降级为 localStorage 读写", async () => {
    localStorage.setItem(
      WRITING_LIBRARY_STORAGE_KEY,
      JSON.stringify({ drafts: [backendDraft("local-1", "本地草稿")] }),
    );
    getInvokeMock().mockImplementation(async () => {
      throw new Error("Cannot read properties of undefined (reading 'invoke')");
    });
    const { result } = renderHook(() => useWritingDraftLibrary());

    await waitFor(() => expect(result.current.libraryReady).toBe(true));
    expect(result.current.drafts.map((draft) => draft.id)).toEqual(["local-1"]);

    act(() => {
      result.current.updateActiveDraft({ notes: "降级便签" });
    });
    await waitFor(() => {
      const raw = localStorage.getItem(WRITING_LIBRARY_STORAGE_KEY);
      expect(raw).toBeTruthy();
      expect(JSON.parse(raw ?? "{}").drafts[0].notes).toBe("降级便签");
    });
    expect(getInvokeMock()).not.toHaveBeenCalledWith("writing_draft_update", expect.anything());
  });

  it("保存真正完成前不报告成功，失败保留草稿并可重试", async () => {
    const pending = deferred<void>();
    const backend = mockBackend([backendDraft("d1", "论文一")]);
    getInvokeMock().mockImplementation((command: string, args?: { request?: WritingDraft }) => (
      command === "writing_draft_update" ? pending.promise : backend(command, args)
    ));
    const { result } = renderHook(() => useWritingDraftLibrary());
    await waitFor(() => expect(result.current.libraryReady).toBe(true));
    act(() => result.current.updateActiveDraft({ notes: "尚未落库的分析" }));
    await waitFor(() => expect(getInvokeMock()).toHaveBeenCalledWith("writing_draft_update", expect.anything()));
    expect(result.current.lastSavedAt).toBeNull();
    await act(async () => pending.reject(new Error("数据库写入失败")));
    expect(result.current.lastSavedAt).toBeNull();
    expect(result.current.libraryError).toContain("数据库写入失败");
    expect(result.current.activeDraft.notes).toBe("尚未落库的分析");

    getInvokeMock().mockImplementation(backend);
    await act(async () => { await result.current.retrySave(); });
    expect(result.current.libraryError).toBe("");
    expect(result.current.lastSavedAt).toBeInstanceOf(Date);
    expect(getInvokeMock().mock.calls.filter(([command]) => command === "writing_draft_update")).toHaveLength(2);
  });

  it("串行保存编辑后的最新内容，迟到旧请求不会覆盖新稿", async () => {
    const pending = deferred<void>();
    const backend = mockBackend([backendDraft("d1", "论文一")]);
    let updates = 0;
    getInvokeMock().mockImplementation((command: string, args?: { request?: WritingDraft }) => {
      if (command === "writing_draft_update" && ++updates === 1) return pending.promise;
      return backend(command, args);
    });
    const { result } = renderHook(() => useWritingDraftLibrary());
    await waitFor(() => expect(result.current.libraryReady).toBe(true));
    act(() => result.current.updateActiveDraft({ notes: "第一稿" }));
    await waitFor(() => expect(updates).toBe(1));
    act(() => result.current.updateActiveDraft({ notes: "最终稿" }));
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 450)); });
    expect(updates).toBe(1);
    await act(async () => pending.resolve());
    await waitFor(() => expect(updates).toBe(2));
    expect(getInvokeMock().mock.calls.filter(([command]) => command === "writing_draft_update")[1]?.[1])
      .toEqual({ request: expect.objectContaining({ notes: "最终稿" }) });
  });

  it("新建失败的草稿重试时继续创建，不能被当成已落库草稿更新", async () => {
    const backend = mockBackend([backendDraft("d1", "论文一")]);
    let createFails = true;
    getInvokeMock().mockImplementation((command: string, args?: { request?: WritingDraft }) => {
      if (command === "writing_draft_create" && createFails) return Promise.reject(new Error("新建失败"));
      return backend(command, args);
    });
    const { result } = renderHook(() => useWritingDraftLibrary());
    await waitFor(() => expect(result.current.libraryReady).toBe(true));
    act(() => { result.current.createDraft(); });
    await waitFor(() => expect(result.current.libraryError).toContain("新建失败"));
    const draftId = result.current.activeDraftId;
    act(() => result.current.updateActiveDraft({ notes: "继续编辑新稿" }));
    createFails = false;
    await act(async () => { await result.current.retrySave(); });
    expect(getInvokeMock()).toHaveBeenLastCalledWith("writing_draft_create", {
      request: expect.objectContaining({ id: draftId, notes: "继续编辑新稿" }),
    });
    expect(getInvokeMock()).not.toHaveBeenCalledWith("writing_draft_update", expect.anything());
  });

  it("数据库读取异常不能切入旧库并伪装保存，重试后恢复后端草稿", async () => {
    localStorage.setItem(WRITING_LIBRARY_STORAGE_KEY, JSON.stringify({ drafts: [backendDraft("old", "旧稿")] }));
    getInvokeMock().mockRejectedValue(new Error("数据库读取失败"));
    const { result } = renderHook(() => useWritingDraftLibrary());
    await waitFor(() => expect(result.current.libraryError).toContain("数据库读取失败"));
    expect(result.current.libraryReady).toBe(false);
    expect(result.current.drafts).toEqual([]);
    mockBackend([backendDraft("d1", "后端稿件")]);
    act(() => result.current.retryLoad());
    await waitFor(() => expect(result.current.libraryReady).toBe(true));
    expect(result.current.activeDraft.projectName).toBe("后端稿件");
    expect(result.current.libraryError).toBe("");
  });

  it("删除失败恢复草稿，不能让界面报告删除后重启又出现", async () => {
    const backend = mockBackend([backendDraft("d1", "论文一"), backendDraft("d2", "论文二")]);
    getInvokeMock().mockImplementation((command: string, args?: { request?: WritingDraft }) => (
      command === "writing_draft_delete" ? Promise.reject(new Error("删除失败")) : backend(command, args)
    ));
    const { result } = renderHook(() => useWritingDraftLibrary());
    await waitFor(() => expect(result.current.libraryReady).toBe(true));
    act(() => { result.current.deleteDraft("d1"); });
    await waitFor(() => expect(result.current.drafts.map((draft) => draft.id)).toContain("d1"));
    expect(result.current.activeDraftId).toBe("d1");
    expect(result.current.libraryError).toContain("删除失败");
  });

  it("离开页面也会保存尚在防抖窗口内的最后编辑", async () => {
    mockBackend([backendDraft("d1", "论文一")]);
    const { result, unmount } = renderHook(() => useWritingDraftLibrary());
    await waitFor(() => expect(result.current.libraryReady).toBe(true));
    act(() => result.current.updateActiveDraft({ notes: "离开前最后一次编辑" }));
    unmount();
    await waitFor(() => expect(getInvokeMock()).toHaveBeenCalledWith("writing_draft_update", {
      request: expect.objectContaining({ notes: "离开前最后一次编辑" }),
    }));
  });

  it("写入失败后切页再进入，从恢复日志恢复原稿并重试落库", async () => {
    const saved = backendDraft("d1", "论文一");
    const backend = mockBackend([saved]);
    getInvokeMock().mockImplementation((command: string, args?: { request?: WritingDraft }) => (
      command === "writing_draft_update" ? Promise.reject(new Error("磁盘不可写")) : backend(command, args)
    ));
    const first = renderHook(() => useWritingDraftLibrary());
    await waitFor(() => expect(first.result.current.libraryReady).toBe(true));
    act(() => first.result.current.updateActiveDraft({ notes: "需要在重启后恢复的分析" }));
    await waitFor(() => expect(first.result.current.libraryError).toContain("磁盘不可写"));
    expect(localStorage.getItem(WRITING_PENDING_DRAFTS_KEY)).toContain("需要在重启后恢复的分析");
    first.unmount();
    await act(async () => { await Promise.resolve(); });

    getInvokeMock().mockImplementation(backend);
    const next = renderHook(() => useWritingDraftLibrary());
    await waitFor(() => expect(next.result.current.libraryReady).toBe(true));
    expect(next.result.current.activeDraft.notes).toBe("需要在重启后恢复的分析");
    expect(next.result.current.recoverySummary).toEqual({ restored: 1, conflicts: 0 });
    await act(async () => { await next.result.current.retrySave(); });
    expect(localStorage.getItem(WRITING_PENDING_DRAFTS_KEY)).toBeNull();
  });

  it("旧保存成功回执不能清除进行中的新编辑恢复日志", async () => {
    const firstSave = deferred<void>();
    const latestSave = deferred<void>();
    const backend = mockBackend([backendDraft("d1", "论文一")]);
    let updates = 0;
    getInvokeMock().mockImplementation((command: string, args?: { request?: WritingDraft }) => {
      if (command === "writing_draft_update") return ++updates === 1 ? firstSave.promise : latestSave.promise;
      return backend(command, args);
    });
    const { result } = renderHook(() => useWritingDraftLibrary());
    await waitFor(() => expect(result.current.libraryReady).toBe(true));
    act(() => result.current.updateActiveDraft({ notes: "旧编辑" }));
    await waitFor(() => expect(updates).toBe(1));
    act(() => result.current.updateActiveDraft({ notes: "新编辑" }));
    await act(async () => firstSave.resolve());
    expect(localStorage.getItem(WRITING_PENDING_DRAFTS_KEY)).toContain("新编辑");
    expect(updates).toBe(2);
    await act(async () => latestSave.resolve());
    expect(localStorage.getItem(WRITING_PENDING_DRAFTS_KEY)).toBeNull();
  });

  it("后端同 ID 资产已更新时恢复为独立副本，不覆盖原资产", async () => {
    const original = backendDraft("d1", "论文一");
    const pending = { ...original, notes: "未落库分析", updatedAt: "2026-02-01T00:00:00.000Z" };
    localStorage.setItem(WRITING_PENDING_DRAFTS_KEY, JSON.stringify([
      { draft: pending, baseSignature: writingDraftContentSignature(original) },
    ]));
    const newer = { ...original, notes: "已经更新的后端分析", updatedAt: "2026-03-01T00:00:00.000Z" };
    mockBackend([newer]);
    const { result } = renderHook(() => useWritingDraftLibrary());
    await waitFor(() => expect(result.current.libraryReady).toBe(true));
    expect(result.current.drafts.find((draft) => draft.id === "d1")?.notes).toBe("已经更新的后端分析");
    expect(result.current.activeDraft.id).not.toBe("d1");
    expect(result.current.activeDraft.projectName).toBe("论文一（恢复副本）");
    expect(result.current.activeDraft.notes).toBe("未落库分析");
    await act(async () => { await result.current.retrySave(); });
    expect(getInvokeMock()).toHaveBeenCalledWith("writing_draft_create", {
      request: expect.objectContaining({ notes: "未落库分析" }),
    });
    expect(getInvokeMock()).not.toHaveBeenCalledWith("writing_draft_update", expect.anything());
  });

  it("切页重载先等待旧写入确认，读到最新内容后继续保存新编辑", async () => {
    const oldSave = deferred<void>();
    const newSave = deferred<void>();
    let stored = backendDraft("d1", "论文一");
    const backend = mockBackend([stored]);
    let updates = 0;
    getInvokeMock().mockImplementation((command: string, args?: { request?: WritingDraft }) => {
      if (command === "writing_draft_list") return Promise.resolve([stored]);
      if (command === "writing_draft_update") {
        const pending = ++updates === 1 ? oldSave.promise : newSave.promise;
        return pending.then(() => { if (args?.request) stored = args.request; });
      }
      return backend(command, args);
    });
    const first = renderHook(() => useWritingDraftLibrary());
    await waitFor(() => expect(first.result.current.libraryReady).toBe(true));
    act(() => first.result.current.updateActiveDraft({ notes: "旧页面编辑" }));
    await waitFor(() => expect(updates).toBe(1));
    first.unmount();

    const next = renderHook(() => useWritingDraftLibrary());
    expect(next.result.current.libraryReady).toBe(false);
    await act(async () => oldSave.resolve());
    await waitFor(() => expect(next.result.current.libraryReady).toBe(true));
    expect(next.result.current.activeDraft.notes).toBe("旧页面编辑");
    act(() => next.result.current.updateActiveDraft({ notes: "新页面编辑" }));
    expect(localStorage.getItem(WRITING_PENDING_DRAFTS_KEY)).toContain("新页面编辑");
    await waitFor(() => expect(updates).toBe(2));
    await act(async () => newSave.resolve());
    expect(localStorage.getItem(WRITING_PENDING_DRAFTS_KEY)).toBeNull();
  });

  it("新建尚未落库时切页重载不会再次创建同一 ID", async () => {
    const pendingCreate = deferred<void>();
    const stored = [backendDraft("d1", "论文一")];
    const backend = mockBackend(stored);
    let creates = 0;
    getInvokeMock().mockImplementation((command: string, args?: { request?: WritingDraft }) => {
      if (command === "writing_draft_create") {
        creates += 1;
        return pendingCreate.promise.then(() => { if (args?.request) stored.push(args.request); return args?.request; });
      }
      return backend(command, args);
    });
    const first = renderHook(() => useWritingDraftLibrary());
    await waitFor(() => expect(first.result.current.libraryReady).toBe(true));
    act(() => { first.result.current.createDraft(); });
    const createdId = first.result.current.activeDraftId;
    await waitFor(() => expect(creates).toBe(1));
    first.unmount();
    const next = renderHook(() => useWritingDraftLibrary());
    expect(next.result.current.libraryReady).toBe(false);
    await act(async () => pendingCreate.resolve());
    await waitFor(() => expect(next.result.current.libraryReady).toBe(true));
    expect(next.result.current.activeDraftId).toBe(createdId);
    await act(async () => { await next.result.current.retrySave(); });
    expect(creates).toBe(1);
  });
});
