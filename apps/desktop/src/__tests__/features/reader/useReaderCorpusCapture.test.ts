import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useReaderCorpusCapture } from "../../../features/reader/useReaderCorpusCapture";
import type { CorpusEntry } from "../../../features/papers/corpusTypes";
import type { ReaderSelection } from "../../../features/reader/readerTypes";

const addEntry = vi.hoisted(() => vi.fn());
vi.mock("../../../features/papers/useCorpus", () => ({ useCorpus: () => ({ addEntry, error: "" }) }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((success) => { resolve = success; });
  return { promise, resolve };
}

function selection(text = "原文"): ReaderSelection {
  return { text, page: 1, positions: [], popupX: 10, popupY: 10 };
}

const saved: CorpusEntry = { id: "saved", paper_id: "paper-a", text: "原文", note: "", created_at: "" };

describe("阅读选区收入语料库的反馈", () => {
  beforeEach(() => { addEntry.mockReset(); addEntry.mockResolvedValue(saved); });
  afterEach(() => vi.useRealTimers());

  it("落库完成之前不提示成功，也不清除可重试的选区", async () => {
    const request = deferred<CorpusEntry | null>();
    addEntry.mockReturnValue(request.promise);
    const clearSelection = vi.fn();
    const { result } = renderHook(() => useReaderCorpusCapture({ paperId: "paper-a", selection: selection(), clearSelection }));
    let pending!: unknown;
    act(() => { pending = result.current.saveSelection("备注"); });
    expect(result.current.toast).toBe("");
    expect(clearSelection).not.toHaveBeenCalled();
    await act(async () => { request.resolve(saved); await pending; });
    expect(result.current.toast).toBe("已收入语料库");
    expect(clearSelection).toHaveBeenCalledOnce();
  });

  it("落库失败保留选区并显示失败反馈", async () => {
    addEntry.mockResolvedValue(null);
    const clearSelection = vi.fn();
    const { result } = renderHook(() => useReaderCorpusCapture({ paperId: "paper-a", selection: selection(), clearSelection }));
    await act(async () => { await result.current.saveSelection(); });
    expect(result.current.toast).not.toBe("已收入语料库");
    expect(result.current.toast).toMatch(/失败/);
    expect(clearSelection).not.toHaveBeenCalled();
  });

  it("切换论文后旧保存回执不提示成功或清除新选区", async () => {
    const request = deferred<CorpusEntry | null>();
    addEntry.mockReturnValue(request.promise);
    const clearSelection = vi.fn();
    const { result, rerender } = renderHook((props) => useReaderCorpusCapture(props), {
      initialProps: { paperId: "paper-a", selection: selection(), clearSelection },
    });
    let pending!: unknown;
    act(() => { pending = result.current.saveSelection(); });
    rerender({ paperId: "paper-b", selection: selection("另一篇论文"), clearSelection });
    await act(async () => { request.resolve(saved); await pending; });
    expect(result.current.toast).toBe("");
    expect(clearSelection).not.toHaveBeenCalled();
  });

  it("保存期间的新选区不会被旧选区成功回执清除", async () => {
    const request = deferred<CorpusEntry | null>();
    addEntry.mockReturnValue(request.promise);
    const clearSelection = vi.fn();
    const { result, rerender } = renderHook((props) => useReaderCorpusCapture(props), {
      initialProps: { paperId: "paper-a", selection: selection(), clearSelection },
    });
    let pending!: unknown;
    act(() => { pending = result.current.saveSelection(); });
    rerender({ paperId: "paper-a", selection: selection("新选区"), clearSelection });
    await act(async () => { request.resolve(saved); await pending; });
    expect(clearSelection).not.toHaveBeenCalled();
    expect(result.current.toast).toBe("已收入语料库");
  });

  it("同一选区保存尚未完成时再次点击不会重复落库", async () => {
    const request = deferred<CorpusEntry | null>();
    addEntry.mockReturnValue(request.promise);
    const selected = selection();
    const { result } = renderHook(() => useReaderCorpusCapture({ paperId: "paper-a", selection: selected, clearSelection: vi.fn() }));
    act(() => { result.current.saveSelection(); result.current.saveSelection(); });
    expect(addEntry).toHaveBeenCalledOnce();
    await act(async () => { request.resolve(saved); });
  });

  it("后显示的反馈拥有完整的展示时间", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useReaderCorpusCapture({ paperId: "paper-a", selection: null, clearSelection: vi.fn() }));
    act(() => { result.current.flashToast("第一条"); });
    act(() => { vi.advanceTimersByTime(1000); result.current.flashToast("第二条"); });
    act(() => { vi.advanceTimersByTime(800); });
    expect(result.current.toast).toBe("第二条");
    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current.toast).toBe("");
  });

  it("阅读页卸载后迟到的保存回执不再触发选区操作", async () => {
    const request = deferred<CorpusEntry | null>();
    addEntry.mockReturnValue(request.promise);
    const clearSelection = vi.fn();
    const { result, unmount } = renderHook(() => useReaderCorpusCapture({ paperId: "paper-a", selection: selection(), clearSelection }));
    let pending!: Promise<void>;
    act(() => { pending = result.current.saveSelection(); });
    unmount();
    await act(async () => { request.resolve(saved); await pending; });
    expect(clearSelection).not.toHaveBeenCalled();
  });

  it("离开后重返同一论文也不会接受上一阅读会话的保存反馈", async () => {
    const request = deferred<CorpusEntry | null>();
    addEntry.mockReturnValue(request.promise);
    const clearSelection = vi.fn();
    const { result, rerender } = renderHook((props) => useReaderCorpusCapture(props), {
      initialProps: { paperId: "paper-a", selection: selection(), clearSelection },
    });
    let pending!: Promise<void>;
    act(() => { pending = result.current.saveSelection(); });
    rerender({ paperId: "paper-b", selection: selection("其他论文"), clearSelection });
    rerender({ paperId: "paper-a", selection: selection("返回后的新选区"), clearSelection });
    await act(async () => { request.resolve(saved); await pending; });
    expect(clearSelection).not.toHaveBeenCalled();
    expect(result.current.toast).toBe("");
  });
});
