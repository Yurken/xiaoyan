import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAiSubmissionReview } from "../../../features/submission/useAiSubmissionReview";

const { aiReview, extractPdfText, reviewFeedbackSummary, listeners } = vi.hoisted(() => ({
  aiReview: vi.fn(),
  extractPdfText: vi.fn(),
  reviewFeedbackSummary: vi.fn(),
  listeners: new Map<string, (event: { payload: Record<string, unknown> }) => void>(),
}));

vi.mock("../../../lib/client", () => ({
  papersApi: { extractPdfText },
  submissionApi: { aiReview, reviewFeedbackSummary },
}));
vi.mock("../../../lib/tauriEvent", () => ({
  safeListen: vi.fn(async (name: string, callback: (event: { payload: Record<string, unknown> }) => void) => {
    listeners.set(name, callback);
    return () => listeners.delete(name);
  }),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (cause: Error) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe("AI 预审会话生命周期", () => {
  beforeEach(() => {
    aiReview.mockReset().mockResolvedValue(undefined);
    extractPdfText.mockReset();
    reviewFeedbackSummary.mockReset().mockResolvedValue({ counts: { pending: 0, adopted: 0, ignored: 0, done: 0 } });
    listeners.clear();
  });

  it("生成中关闭并重开后可再次预审，旧完成事件不结束新一轮", async () => {
    const { result } = renderHook(() => useAiSubmissionReview({ onError: vi.fn(), onDiagnosisSaved: vi.fn() }));
    await act(async () => { result.current.openForSubmission("s1", "论文摘要"); });
    act(() => result.current.generate());
    const firstRun = aiReview.mock.calls[0]?.[0].runId;
    expect(result.current.loading).toBe(true);
    act(() => result.current.close());
    expect(result.current.loading).toBe(false);
    await act(async () => { result.current.openForSubmission("s1", "新的摘要"); });
    act(() => result.current.generate());
    expect(aiReview).toHaveBeenCalledTimes(2);
    const secondRun = aiReview.mock.calls[1]?.[0].runId;
    expect(secondRun).not.toBe(firstRun);
    act(() => listeners.get("submission:ai_review:done")?.({ payload: { submissionId: "s1", runId: firstRun } }));
    expect(result.current.loading).toBe(true);
    act(() => listeners.get("submission:ai_review:done")?.({ payload: { submissionId: "s1", runId: secondRun } }));
    expect(result.current.loading).toBe(false);
  });

  it("关闭前请求迟到失败不能清除重开后的 loading 或弹出旧错误", async () => {
    const oldRequest = deferred<void>();
    aiReview.mockReturnValueOnce(oldRequest.promise);
    const onError = vi.fn();
    const { result } = renderHook(() => useAiSubmissionReview({ onError, onDiagnosisSaved: vi.fn() }));
    await act(async () => { result.current.openForSubmission("s1", "摘要一"); });
    act(() => result.current.generate());
    act(() => result.current.close());
    await act(async () => { result.current.openForSubmission("s2", "摘要二"); });
    act(() => result.current.generate());
    await act(async () => oldRequest.reject(new Error("旧预审失败")));
    expect(result.current.loading).toBe(true);
    expect(onError).not.toHaveBeenCalled();
  });

  it("同一投稿重开后忽略旧 PDF 提取内容与完成状态", async () => {
    const oldExtraction = deferred<string>();
    const newExtraction = deferred<string>();
    extractPdfText.mockReturnValueOnce(oldExtraction.promise).mockReturnValueOnce(newExtraction.promise);
    const { result } = renderHook(() => useAiSubmissionReview({ onError: vi.fn(), onDiagnosisSaved: vi.fn() }));
    await act(async () => { result.current.openForSubmission("s1", "旧摘要", "/old.pdf"); });
    act(() => result.current.close());
    await act(async () => { result.current.openForSubmission("s1", "新摘要", "/new.pdf"); });
    await act(async () => oldExtraction.resolve("过期 PDF 内容"));
    expect(result.current.input.abstract).toBe("新摘要");
    expect(result.current.fileExtracting).toBe(true);
    await act(async () => newExtraction.resolve("新 PDF 内容"));
    expect(result.current.input.abstract).toBe("新 PDF 内容");
    expect(result.current.fileExtracting).toBe(false);
  });
});
