import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { KnowledgeNote } from "@research-copilot/types";
import { useNoteEditorSession } from "../../../features/knowledge/notes/useNoteEditorSession";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => { resolve = next; });
  return { promise, resolve };
}

const note: KnowledgeNote = {
  id: "note-1",
  title: "原标题",
  content: "原正文",
  source_type: "manual",
  created_at: "2026-09-12T00:00:00Z",
  updated_at: "2026-09-13T00:00:00Z",
};

describe("useNoteEditorSession", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("保存期间继续输入时会补交最新草稿，不用旧响应清除新内容", async () => {
    const first = deferred<KnowledgeNote>();
    const second = deferred<KnowledgeNote>();
    const onSave = vi.fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { result } = renderHook(() => useNoteEditorSession({
      note,
      creating: false,
      onCreate: vi.fn(),
      onSave,
      onCreated: vi.fn(),
    }));

    act(() => result.current.updateDraft({ content: "第一次修改" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(900); });
    expect(onSave).toHaveBeenCalledTimes(1);

    act(() => result.current.updateDraft({ content: "保存期间的最新修改" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(900); });
    first.resolve({ ...note, content: "第一次修改", updated_at: "2026-09-13T00:01:00Z" });
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(900); });

    expect(onSave).toHaveBeenCalledTimes(2);
    expect(onSave.mock.calls[1][1].content).toBe("保存期间的最新修改");
    second.resolve({ ...note, content: "保存期间的最新修改", updated_at: "2026-09-13T00:02:00Z" });
    await act(async () => { await Promise.resolve(); });

    expect(result.current.draft.content).toBe("保存期间的最新修改");
    expect(result.current.dirty).toBe(false);
  });

  it("首次创建期间继续输入时把最新草稿移交给已创建的笔记", async () => {
    const creation = deferred<KnowledgeNote>();
    const created = { ...note, id: "created-note", title: "首版", content: "首版正文" };
    const onCreate = vi.fn().mockReturnValue(creation.promise);
    const onCreated = vi.fn();
    const { result, rerender } = renderHook(
      ({ currentNote, creating }) => useNoteEditorSession({
        note: currentNote,
        creating,
        onCreate,
        onSave: vi.fn(),
        onCreated,
      }),
      { initialProps: { currentNote: null as KnowledgeNote | null, creating: true } },
    );

    act(() => result.current.updateDraft({ title: "首版", content: "首版正文" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(900); });
    act(() => result.current.updateDraft({ content: "创建期间继续写下的正文" }));

    creation.resolve(created);
    await act(async () => { await Promise.resolve(); });
    expect(onCreated).toHaveBeenCalledWith(created);

    rerender({ currentNote: created, creating: false });
    expect(result.current.draft.content).toBe("创建期间继续写下的正文");
    expect(result.current.dirty).toBe(true);
  });

  it("旧保存响应到达后重新打开笔记仍能恢复保存期间的新编辑", async () => {
    const saving = deferred<KnowledgeNote>();
    const saved = { ...note, content: "已提交的正文", updated_at: "2026-09-13T00:01:00Z" };
    const options = {
      creating: false,
      onCreate: vi.fn(),
      onSave: vi.fn().mockReturnValue(saving.promise),
      onCreated: vi.fn(),
    };
    const editor = renderHook(() => useNoteEditorSession({ ...options, note }));

    act(() => editor.result.current.updateDraft({ content: "已提交的正文" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(900); });
    act(() => editor.result.current.updateDraft({ content: "响应前继续写下的正文" }));
    await act(async () => { saving.resolve(saved); });

    expect(editor.result.current.dirty).toBe(true);
    editor.unmount();
    const reopened = renderHook(() => useNoteEditorSession({ ...options, note: saved }));

    expect(reopened.result.current.draft.content).toBe("响应前继续写下的正文");
    expect(reopened.result.current.dirty).toBe(true);
  });

  it("保存失败后的手动重试成功会清除先前错误", async () => {
    const saved = { ...note, content: "重试的正文", updated_at: "2026-09-13T00:01:00Z" };
    const onSave = vi.fn()
      .mockRejectedValueOnce(new Error("数据库暂不可用"))
      .mockResolvedValueOnce(saved);
    const { result } = renderHook(() => useNoteEditorSession({
      note,
      creating: false,
      onCreate: vi.fn(),
      onSave,
      onCreated: vi.fn(),
    }));

    act(() => result.current.updateDraft({ content: saved.content }));
    await act(async () => { await result.current.saveNow(); });
    expect(result.current.saveState).toBe("error");
    expect(result.current.saveError).toBe("数据库暂不可用");

    await act(async () => { await result.current.saveNow(); });

    expect(onSave).toHaveBeenCalledTimes(2);
    expect(result.current.dirty).toBe(false);
    expect(result.current.saveState).toBe("saved");
    expect(result.current.saveError).toBe("");
  });

  it("新建请求在编辑器卸载后完成不会回调并抢回当前选择", async () => {
    const creation = deferred<KnowledgeNote>();
    const onCreated = vi.fn();
    const { result, unmount } = renderHook(() => useNoteEditorSession({
      note: null,
      creating: true,
      onCreate: vi.fn().mockReturnValue(creation.promise),
      onSave: vi.fn(),
      onCreated,
    }));

    act(() => result.current.updateDraft({ title: "待创建", content: "待创建的正文" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(900); });
    unmount();
    await act(async () => { creation.resolve({ ...note, id: "created-after-unmount" }); });

    expect(onCreated).not.toHaveBeenCalled();
  });

  it("创建期间继续编辑并迁移到正式笔记后清除旧的新建草稿", async () => {
    const creation = deferred<KnowledgeNote>();
    const created = { ...note, id: "created-note", title: "新笔记", content: "首版正文" };
    const onCreate = vi.fn().mockReturnValue(creation.promise);
    const onSave = vi.fn();
    const onCreated = vi.fn();
    const { result, rerender } = renderHook(
      ({ currentNote, creating }) => useNoteEditorSession({
        note: currentNote,
        creating,
        onCreate,
        onSave,
        onCreated,
      }),
      { initialProps: { currentNote: null as KnowledgeNote | null, creating: true } },
    );

    act(() => result.current.updateDraft({ title: created.title, content: created.content }));
    await act(async () => { await vi.advanceTimersByTimeAsync(900); });
    act(() => result.current.updateDraft({ content: "迁移后仍需保存的正文" }));
    await act(async () => { creation.resolve(created); });
    rerender({ currentNote: created, creating: false });

    expect(result.current.draft.content).toBe("迁移后仍需保存的正文");
    expect(localStorage.getItem("rc:knowledge:note-draft:new")).toBeNull();
    expect(JSON.parse(localStorage.getItem("rc:knowledge:note-draft:created-note") ?? "null"))
      .toMatchObject({ content: "迁移后仍需保存的正文" });

    rerender({ currentNote: null, creating: true });
    expect(result.current.draft.content).toBe("");
    expect(result.current.dirty).toBe(false);
  });

  it("旧版本本地草稿保留为冲突草稿且不会自动覆盖较新的笔记", async () => {
    const stored = {
      title: "离线修改的标题",
      content: "尚未保存的本地正文",
      research_interest_id: "",
      baseUpdatedAt: "2026-09-12T00:00:00Z",
    };
    localStorage.setItem("rc:knowledge:note-draft:note-1", JSON.stringify(stored));
    const onSave = vi.fn();
    const { result } = renderHook(() => useNoteEditorSession({
      note,
      creating: false,
      onCreate: vi.fn(),
      onSave,
      onCreated: vi.fn(),
    }));

    expect(result.current.draft.content).toBe(stored.content);
    expect(result.current.dirty).toBe(true);
    expect(result.current.saveState).toBe("conflict");
    await act(async () => { await vi.advanceTimersByTimeAsync(1800); });
    await act(async () => { await result.current.saveNow(); });

    expect(onSave).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem("rc:knowledge:note-draft:note-1") ?? "null"))
      .toMatchObject(stored);
  });

  it("本机草稿写入失败会提示并在同窗口重挂载恢复，重试成功后清除提示", () => {
    const storageFailure = vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new DOMException("Storage quota exceeded", "QuotaExceededError");
    });
    const storageNote = { ...note, id: "note-storage-recovery" };
    const options = {
      note: storageNote,
      creating: false,
      onCreate: vi.fn(),
      onSave: vi.fn(),
      onCreated: vi.fn(),
    };
    const editor = renderHook(() => useNoteEditorSession(options));

    act(() => editor.result.current.updateDraft({ content: "当前窗口保留的修改" }));

    expect(editor.result.current.draftPersisted).toBe(false);
    expect(editor.result.current.persistenceError).not.toBe("");
    expect(localStorage.getItem("rc:knowledge:note-draft:note-storage-recovery")).toBeNull();
    editor.unmount();
    const reopened = renderHook(() => useNoteEditorSession(options));

    expect(reopened.result.current.draft.content).toBe("当前窗口保留的修改");
    expect(reopened.result.current.dirty).toBe(true);
    expect(reopened.result.current.draftPersisted).toBe(false);
    expect(reopened.result.current.persistenceError).not.toBe("");

    storageFailure.mockRestore();
    act(() => reopened.result.current.retryDraftPersistence());

    expect(reopened.result.current.draftPersisted).toBe(true);
    expect(reopened.result.current.persistenceError).toBe("");
    expect(JSON.parse(localStorage.getItem("rc:knowledge:note-draft:note-storage-recovery") ?? "null"))
      .toMatchObject({ content: "当前窗口保留的修改" });
  });

  it("本机草稿写入失败后仍可保存到数据库并清除窗口内待恢复草稿", async () => {
    const storageFailure = vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new DOMException("Storage quota exceeded", "QuotaExceededError");
    });
    const storageNote = { ...note, id: "note-database-recovery" };
    const saved = { ...storageNote, content: "已经保存的正文", updated_at: "2026-09-13T00:01:00Z" };
    const options = {
      creating: false,
      onCreate: vi.fn(),
      onSave: vi.fn().mockResolvedValue(saved),
      onCreated: vi.fn(),
    };
    const editor = renderHook(() => useNoteEditorSession({ ...options, note: storageNote }));

    act(() => editor.result.current.updateDraft({ content: saved.content }));
    expect(editor.result.current.persistenceError).not.toBe("");
    await act(async () => { await editor.result.current.saveNow(); });

    expect(editor.result.current.dirty).toBe(false);
    expect(editor.result.current.saveState).toBe("saved");
    expect(editor.result.current.persistenceError).toBe("");
    editor.unmount();
    storageFailure.mockRestore();
    const reopened = renderHook(() => useNoteEditorSession({ ...options, note: saved }));

    expect(reopened.result.current.draft.content).toBe(saved.content);
    expect(reopened.result.current.dirty).toBe(false);
    expect(reopened.result.current.persistenceError).toBe("");
  });

  it("冲突草稿可另存为新笔记而不覆盖已有笔记", async () => {
    const stored = {
      title: "待保留的冲突标题",
      content: "待保留的冲突正文",
      research_interest_id: "",
      baseUpdatedAt: "2026-09-12T00:00:00Z",
    };
    localStorage.setItem("rc:knowledge:note-draft:note-1", JSON.stringify(stored));
    const copy = { ...note, id: "conflict-copy", title: stored.title, content: stored.content };
    const onCreate = vi.fn().mockResolvedValue(copy);
    const onSave = vi.fn();
    const onCreated = vi.fn();
    const { result } = renderHook(() => useNoteEditorSession({
      note,
      creating: false,
      onCreate,
      onSave,
      onCreated,
    }));

    expect(result.current.conflictingNote).toEqual(note);
    await act(async () => { await result.current.saveAsCopy(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1800); });

    expect(onCreate).toHaveBeenCalledExactlyOnceWith({
      title: stored.title, content: stored.content, research_interest_id: "",
    });
    expect(onCreated).toHaveBeenCalledExactlyOnceWith(copy);
    expect(onSave).not.toHaveBeenCalled();
    expect(result.current.dirty).toBe(false);
    expect(result.current.conflictingNote).toBeNull();
    expect(localStorage.getItem("rc:knowledge:note-draft:note-1")).toBeNull();
  });

  it("新建请求未完成时重挂载会接管原请求且不会重复创建笔记", async () => {
    const creation = deferred<KnowledgeNote>();
    const created = { ...note, id: "created-across-remount", title: "重挂载笔记", content: "原请求正文" };
    const onCreate = vi.fn().mockReturnValue(creation.promise);
    const onCreatedBeforeUnmount = vi.fn();
    const onCreatedAfterRemount = vi.fn();
    const options = { note: null, creating: true, onCreate, onSave: vi.fn() };
    const original = renderHook(() => useNoteEditorSession({
      ...options, onCreated: onCreatedBeforeUnmount,
    }));

    act(() => original.result.current.updateDraft({ title: created.title, content: created.content }));
    await act(async () => { await vi.advanceTimersByTimeAsync(900); });
    expect(onCreate).toHaveBeenCalledTimes(1);
    original.unmount();
    const reopened = renderHook(() => useNoteEditorSession({
      ...options, onCreated: onCreatedAfterRemount,
    }));

    await act(async () => { await vi.advanceTimersByTimeAsync(900); });
    act(() => { void reopened.result.current.saveNow(); });
    expect(onCreate).toHaveBeenCalledTimes(1);
    await act(async () => { creation.resolve(created); });

    expect(onCreatedBeforeUnmount).not.toHaveBeenCalled();
    expect(onCreatedAfterRemount).toHaveBeenCalledExactlyOnceWith(created);
    expect(reopened.result.current.dirty).toBe(false);
  });

  it("保存期间载入的较新笔记版本不会被较旧保存响应当成已保存状态", async () => {
    const saving = deferred<KnowledgeNote>();
    const submitted = { ...note, content: "本次提交的正文", updated_at: "2026-09-13T00:01:00Z" };
    const newer = { ...note, content: "另一处更新后的正文", updated_at: "2026-09-13T00:02:00Z" };
    const onSave = vi.fn().mockReturnValue(saving.promise);
    const onCreate = vi.fn();
    const onCreated = vi.fn();
    const { result, rerender } = renderHook(
      ({ currentNote }) => useNoteEditorSession({
        note: currentNote, creating: false, onCreate, onSave, onCreated,
      }),
      { initialProps: { currentNote: note } },
    );

    act(() => result.current.updateDraft({ content: submitted.content }));
    await act(async () => { await vi.advanceTimersByTimeAsync(900); });
    rerender({ currentNote: newer });
    await act(async () => { saving.resolve(submitted); });

    expect(result.current.saveState).toBe("conflict");
    expect(result.current.conflictingNote).toEqual(newer);
    expect(result.current.draft.content).toBe(submitted.content);
    expect(result.current.dirty).toBe(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(1800); });
    await act(async () => { await result.current.saveNow(); });
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("放弃草稿时本机清理失败会提示，重挂载不会恢复已放弃内容且可重试清理", () => {
    const discardNote = { ...note, id: "note-discard-retry" };
    const options = {
      note: discardNote,
      creating: false,
      onCreate: vi.fn(),
      onSave: vi.fn(),
      onCreated: vi.fn(),
    };
    const editor = renderHook(() => useNoteEditorSession(options));
    act(() => editor.result.current.updateDraft({ content: "决定放弃的正文" }));
    const storageFailure = vi.spyOn(localStorage, "removeItem").mockImplementation(() => {
      throw new DOMException("Storage access denied", "SecurityError");
    });

    act(() => editor.result.current.discardDraft());

    expect(editor.result.current.draft.content).toBe(note.content);
    expect(editor.result.current.dirty).toBe(false);
    expect(editor.result.current.persistenceError).toContain("清理失败");
    expect(JSON.parse(localStorage.getItem("rc:knowledge:note-draft:note-discard-retry") ?? "null"))
      .toMatchObject({ content: "决定放弃的正文" });
    editor.unmount();
    const reopened = renderHook(() => useNoteEditorSession(options));

    expect(reopened.result.current.draft.content).toBe(note.content);
    expect(reopened.result.current.dirty).toBe(false);
    expect(reopened.result.current.persistenceError).toContain("清理失败");
    storageFailure.mockRestore();
    act(() => reopened.result.current.retryDraftPersistence());

    expect(reopened.result.current.persistenceError).toBe("");
    expect(localStorage.getItem("rc:knowledge:note-draft:note-discard-retry")).toBeNull();
  });

  it("不同研究主题的新建草稿互相隔离并按当前主题创建笔记", async () => {
    const created = {
      ...note, id: "created-in-interest-b", title: "主题 B 的笔记", content: "主题 B 的正文",
      research_interest_id: "interest-b",
    };
    const onCreate = vi.fn().mockResolvedValue(created);
    const options = {
      note: null, creating: true, onCreate, onSave: vi.fn(), onCreated: vi.fn(),
    };
    const interestA = renderHook(() => useNoteEditorSession({
      ...options, defaultInterestId: "interest-a",
    }));
    act(() => interestA.result.current.updateDraft({ title: "主题 A 的草稿", content: "主题 A 尚未保存的正文" }));
    interestA.unmount();

    const interestB = renderHook(() => useNoteEditorSession({
      ...options, defaultInterestId: "interest-b",
    }));
    expect(interestB.result.current.draft).toEqual({ title: "", content: "", research_interest_id: "interest-b" });
    expect(interestB.result.current.dirty).toBe(false);
    act(() => interestB.result.current.updateDraft({ title: created.title, content: created.content }));
    await act(async () => { await interestB.result.current.saveNow(); });

    expect(onCreate).toHaveBeenCalledExactlyOnceWith({
      title: created.title, content: created.content, research_interest_id: "interest-b",
    });
    interestB.unmount();
    const reopenedA = renderHook(() => useNoteEditorSession({
      ...options, defaultInterestId: "interest-a",
    }));

    expect(reopenedA.result.current.draft).toEqual({
      title: "主题 A 的草稿", content: "主题 A 尚未保存的正文", research_interest_id: "interest-a",
    });
    expect(reopenedA.result.current.dirty).toBe(true);
  });

  it("保存完成后正常载入更新版本会采用新正文而不误报冲突", async () => {
    const saved = { ...note, content: "本次保存的正文", updated_at: "2026-09-13T00:01:00Z" };
    const newer = { ...note, content: "之后刷新得到的正文", updated_at: "2026-09-13T00:02:00Z" };
    const onSave = vi.fn().mockResolvedValue(saved);
    const onCreate = vi.fn();
    const onCreated = vi.fn();
    const { result, rerender } = renderHook(
      ({ currentNote }) => useNoteEditorSession({
        note: currentNote, creating: false, onCreate, onSave, onCreated,
      }),
      { initialProps: { currentNote: note } },
    );

    act(() => result.current.updateDraft({ content: saved.content }));
    await act(async () => { await result.current.saveNow(); });
    expect(result.current.dirty).toBe(false);
    rerender({ currentNote: saved });
    rerender({ currentNote: newer });

    expect(result.current.draft.content).toBe(newer.content);
    expect(result.current.dirty).toBe(false);
    expect(result.current.saveState).not.toBe("conflict");
    expect(result.current.conflictingNote).toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(1800); });
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("新建完成后正式笔记会保留源草稿的清理失败提示并允许重试清理", async () => {
    const created = { ...note, id: "created-with-cleanup-failure", title: "已创建的笔记", content: "已创建的正文" };
    const onCreate = vi.fn().mockResolvedValue(created);
    const onCreated = vi.fn();
    const options = { onCreate, onSave: vi.fn(), onCreated };
    const creating = renderHook(() => useNoteEditorSession({ ...options, note: null, creating: true }));
    act(() => creating.result.current.updateDraft({ title: created.title, content: created.content }));
    const storageFailure = vi.spyOn(localStorage, "removeItem").mockImplementation(() => {
      throw new DOMException("Storage access denied", "SecurityError");
    });

    await act(async () => { await creating.result.current.saveNow(); });
    expect(onCreated).toHaveBeenCalledExactlyOnceWith(created);
    expect(creating.result.current.dirty).toBe(false);
    creating.unmount();
    const reopened = renderHook(() => useNoteEditorSession({ ...options, note: created, creating: false }));

    expect(reopened.result.current.draft.content).toBe(created.content);
    expect(reopened.result.current.dirty).toBe(false);
    expect(reopened.result.current.persistenceError).toContain("清理失败");
    expect(JSON.parse(localStorage.getItem("rc:knowledge:note-draft:new") ?? "null"))
      .toMatchObject({ content: created.content });
    storageFailure.mockRestore();
    act(() => reopened.result.current.retryDraftPersistence());

    expect(reopened.result.current.persistenceError).toBe("");
    expect(localStorage.getItem("rc:knowledge:note-draft:new")).toBeNull();
  });
});
