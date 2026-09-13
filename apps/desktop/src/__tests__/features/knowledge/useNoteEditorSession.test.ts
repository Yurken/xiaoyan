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

  afterEach(() => vi.useRealTimers());

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
});
