import { StrictMode, createElement, type PropsWithChildren } from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { readFile } from "@tauri-apps/plugin-fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWritingPdfPreview } from "../../../features/writing/useWritingPdfPreview";

const pdfRenderer = vi.hoisted(() => ({ getDocument: vi.fn() }));
vi.mock("pdfjs-dist", () => ({
  GlobalWorkerOptions: { workerSrc: "" },
  getDocument: pdfRenderer.getDocument,
}));
vi.mock("pdfjs-dist/build/pdf.worker.min.mjs?url", () => ({ default: "synthetic-pdf-worker" }));

const readMock = vi.mocked(readFile);
const sourceA = "/synthetic/compile/a.pdf";
const sourceB = "/synthetic/compile/b.pdf";
const pdfBytes = new Uint8Array([37, 80, 68, 70]);

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function makeRenderTask() {
  const completion = deferred<void>();
  return {
    ...completion,
    cancel: vi.fn(() => { completion.reject(new Error("Rendering cancelled")); }),
  };
}

function makePage() {
  return {
    getViewport: vi.fn(() => ({ width: 600, height: 800 })),
    render: vi.fn(() => ({ promise: Promise.resolve(), cancel: vi.fn() })),
  };
}

function makeDocument(numPages = 0, page = makePage()) {
  return {
    numPages,
    getPage: vi.fn().mockResolvedValue(page),
    // LoadingTask is the owner; calling both destroy APIs duplicates teardown.
    destroy: vi.fn().mockResolvedValue(undefined),
  };
}
type DocumentFixture = ReturnType<typeof makeDocument>;

function makeLoadingTask(document?: DocumentFixture) {
  const loading = deferred<DocumentFixture>();
  if (document) loading.resolve(document);
  return { ...loading, destroy: vi.fn().mockResolvedValue(undefined) };
}

function makeOptions() {
  const scrollElement = document.createElement("div");
  Object.defineProperties(scrollElement, {
    clientWidth: { value: 300 },
    clientHeight: { value: 400 },
  });
  const canvas = document.createElement("canvas");
  const context = { setTransform: vi.fn() } as unknown as CanvasRenderingContext2D;
  vi.spyOn(canvas, "getContext").mockReturnValue(context);
  return {
    isFullscreen: false,
    scrollRef: { current: scrollElement },
    canvasRefs: { current: new Map([[1, canvas]]) },
    setZoomLevel: vi.fn(),
    clampZoom: (value: number) => Math.min(3, Math.max(0.25, value)),
  };
}

function renderPreview(path: string | null = sourceA, options = makeOptions()) {
  return renderHook(
    ({ pdfPath, isFullscreen }) => useWritingPdfPreview(pdfPath, { ...options, isFullscreen }),
    { initialProps: { pdfPath: path, isFullscreen: options.isFullscreen } },
  );
}

function StrictWrapper({ children }: PropsWithChildren) {
  return createElement(StrictMode, null, children);
}

describe("useWritingPdfPreview resource lifetime", () => {
  beforeEach(() => {
    readMock.mockReset().mockResolvedValue(pdfBytes);
    pdfRenderer.getDocument.mockReset().mockImplementation(() => makeLoadingTask(makeDocument()));
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    readMock.mockReset();
    pdfRenderer.getDocument.mockReset();
  });

  it("没有 PDF 时不读文件、不创建 worker，并返回空闲预览", async () => {
    const { result } = renderPreview(null);
    act(() => { result.current.retryPreview(); });
    await act(async () => {});
    expect(result.current).toMatchObject({ pdfDoc: null, numPages: 0, pdfLoading: false, pdfError: false });
    expect(readMock).not.toHaveBeenCalled();
    expect(pdfRenderer.getDocument).not.toHaveBeenCalled();
  });

  it.each(["switch", "unmount"] as const)("原生模块导入恢复前发生 %s 时不启动旧文件读取", async (change) => {
    const { rerender, unmount } = renderPreview();
    if (change === "switch") rerender({ pdfPath: sourceB, isFullscreen: false });
    else unmount();
    await act(async () => {});
    expect(readMock).not.toHaveBeenCalledWith(sourceA);
    if (change === "switch") {
      await waitFor(() => expect(readMock).toHaveBeenCalledWith(sourceB));
      await waitFor(() => expect(pdfRenderer.getDocument).toHaveBeenCalledTimes(1));
    } else {
      expect(readMock).not.toHaveBeenCalled();
      expect(pdfRenderer.getDocument).not.toHaveBeenCalled();
    }
  });

  it.each(["switch", "unmount"] as const)("文件读取期间发生 %s 时迟到字节不会创建旧 worker", async (change) => {
    const reading = deferred<typeof pdfBytes>();
    readMock.mockReturnValueOnce(reading.promise);
    const { rerender, unmount } = renderPreview();
    await waitFor(() => expect(readMock).toHaveBeenCalledWith(sourceA));
    if (change === "switch") {
      rerender({ pdfPath: sourceB, isFullscreen: false });
      await waitFor(() => expect(pdfRenderer.getDocument).toHaveBeenCalledTimes(1));
    } else unmount();
    await act(async () => { reading.resolve(new Uint8Array([1, 2, 3])); });
    expect(pdfRenderer.getDocument).toHaveBeenCalledTimes(change === "switch" ? 1 : 0);
    if (change === "switch") {
      expect(pdfRenderer.getDocument).toHaveBeenCalledWith({ data: pdfBytes });
    }
  });

  it.each(["pending", "loaded"] as const)("卸载 %s 文档只销毁 loadingTask 一次，迟到成功不另行销毁 document", async (stage) => {
    const document = makeDocument();
    const task = makeLoadingTask(stage === "loaded" ? document : undefined);
    pdfRenderer.getDocument.mockReturnValueOnce(task);
    const { result, unmount } = renderPreview();
    await waitFor(() => expect(pdfRenderer.getDocument).toHaveBeenCalledTimes(1));
    if (stage === "loaded") await waitFor(() => expect(result.current.pdfDoc).toBe(document));
    unmount();
    expect(task.destroy).toHaveBeenCalledTimes(1);
    if (stage === "pending") await act(async () => { task.resolve(document); });
    expect(task.destroy).toHaveBeenCalledTimes(1);
    expect(document.destroy).not.toHaveBeenCalled();
  });

  it("加载失败释放 loadingTask，随后卸载不重复销毁", async () => {
    const task = makeLoadingTask();
    pdfRenderer.getDocument.mockReturnValueOnce(task);
    const { result, unmount } = renderPreview();
    await waitFor(() => expect(pdfRenderer.getDocument).toHaveBeenCalledTimes(1));
    await act(async () => { task.reject(new Error("Malformed PDF")); });
    expect(result.current).toMatchObject({ pdfDoc: null, numPages: 0, pdfLoading: false, pdfError: true });
    expect(task.destroy).toHaveBeenCalledTimes(1);
    unmount();
    expect(task.destroy).toHaveBeenCalledTimes(1);
  });

  it.each(["read", "worker"] as const)("%s 失败退出 loading 状态，切到下一份 PDF 后可以恢复", async (stage) => {
    if (stage === "read") readMock.mockRejectedValueOnce(new Error("Permission denied"));
    else pdfRenderer.getDocument.mockImplementationOnce(() => { throw new Error("Worker failed"); });
    const { result, rerender } = renderPreview();
    await waitFor(() => expect(result.current.pdfError).toBe(true));
    expect(result.current.pdfLoading).toBe(false);
    expect(result.current.pdfDoc).toBeNull();
    rerender({ pdfPath: sourceB, isFullscreen: false });
    await waitFor(() => expect(result.current.pdfDoc).not.toBeNull());
    expect(result.current.pdfError).toBe(false);
  });

  it.each(["read", "load"] as const)("%s 失败可在同一路径重试，同 tick 重复和 loading/ready 重试都不重读", async (stage) => {
    const failedTask = makeLoadingTask();
    const recoveredTask = makeLoadingTask();
    const recoveredDocument = makeDocument();
    if (stage === "read") {
      readMock.mockRejectedValueOnce(new Error("Temporary read failure"));
      pdfRenderer.getDocument.mockReturnValueOnce(recoveredTask);
    } else {
      pdfRenderer.getDocument.mockReturnValueOnce(failedTask).mockReturnValueOnce(recoveredTask);
    }
    const { result, unmount } = renderPreview();
    if (stage === "load") {
      await waitFor(() => expect(pdfRenderer.getDocument).toHaveBeenCalledTimes(1));
      await act(async () => { failedTask.reject(new Error("Temporary document load failure")); });
    }
    await waitFor(() => expect(result.current.pdfError).toBe(true));
    const retryRead = deferred<typeof pdfBytes>();
    readMock.mockReturnValueOnce(retryRead.promise);
    const originalRetry = result.current.retryPreview;
    act(() => {
      originalRetry();
      originalRetry();
    });

    expect(result.current).toMatchObject({ pdfDoc: null, numPages: 0, pdfLoading: true, pdfError: false });
    await waitFor(() => expect(readMock).toHaveBeenCalledTimes(2));
    expect(readMock).toHaveBeenNthCalledWith(2, sourceA);
    act(() => {
      originalRetry();
      result.current.retryPreview();
    });
    await act(async () => { retryRead.resolve(pdfBytes); });
    await waitFor(() => expect(pdfRenderer.getDocument).toHaveBeenCalledTimes(stage === "load" ? 2 : 1));
    expect(result.current.pdfLoading).toBe(true);
    act(() => { result.current.retryPreview(); });

    await act(async () => { recoveredTask.resolve(recoveredDocument); });
    expect(result.current).toMatchObject({
      pdfDoc: recoveredDocument, numPages: 0, pdfLoading: false, pdfError: false,
    });
    act(() => {
      originalRetry();
      result.current.retryPreview();
    });
    await act(async () => {});
    expect(readMock).toHaveBeenCalledTimes(2);
    expect(pdfRenderer.getDocument).toHaveBeenCalledTimes(stage === "load" ? 2 : 1);
    if (stage === "load") expect(failedTask.destroy).toHaveBeenCalledTimes(1);
    expect(recoveredTask.destroy).not.toHaveBeenCalled();
    unmount();
    if (stage === "load") expect(failedTask.destroy).toHaveBeenCalledTimes(1);
    expect(recoveredTask.destroy).toHaveBeenCalledTimes(1);
  });

  it.each(["fit", "page", "render"] as const)(
    "失败后重试同路径销毁旧 owner 一次，迟到的旧 %s 不干扰新预览或渲染所有权",
    async (lateWork) => {
      const fitting = deferred<ReturnType<typeof makePage>>();
      const fetchingPage = deferred<ReturnType<typeof makePage>>();
      const oldRendering = makeRenderTask();
      // Cancellation need not settle the renderer immediately.
      oldRendering.cancel.mockImplementation(() => {});
      const oldPage = makePage();
      oldPage.render.mockReturnValueOnce(oldRendering);
      const oldDocument = makeDocument(1, oldPage);
      oldDocument.getPage.mockReturnValueOnce(fitting.promise);
      if (lateWork === "page") oldDocument.getPage.mockReturnValueOnce(fetchingPage.promise);
      const oldTask = makeLoadingTask(oldDocument);

      const currentRendering = makeRenderTask();
      const currentPage = makePage();
      currentPage.render.mockReturnValueOnce(currentRendering);
      const currentDocument = makeDocument(1, currentPage);
      const nextTask = makeLoadingTask(currentDocument);
      pdfRenderer.getDocument.mockReturnValueOnce(oldTask).mockReturnValueOnce(nextTask);
      const options = makeOptions();
      const { result, unmount } = renderPreview(sourceA, options);
      await waitFor(() => expect(oldDocument.getPage).toHaveBeenCalledTimes(2));
      if (lateWork !== "page") await waitFor(() => expect(oldPage.render).toHaveBeenCalledTimes(1));
      await act(async () => {
        if (lateWork === "fit") oldRendering.reject(new Error("Initial render failure"));
        else fitting.reject(new Error("Initial fit failure"));
      });
      expect(result.current).toMatchObject({ pdfDoc: null, numPages: 0, pdfLoading: false, pdfError: true });
      expect(oldTask.destroy).toHaveBeenCalledTimes(1);
      expect(oldDocument.destroy).not.toHaveBeenCalled();
      if (lateWork === "render") {
        expect(oldRendering.cancel).toHaveBeenCalledTimes(1);
        expect(oldRendering.cancel.mock.invocationCallOrder[0]).toBeLessThan(oldTask.destroy.mock.invocationCallOrder[0]);
      }

      act(() => { result.current.retryPreview(); });
      expect(result.current).toMatchObject({ pdfDoc: null, numPages: 0, pdfLoading: true, pdfError: false });
      await waitFor(() => expect(currentPage.render).toHaveBeenCalledTimes(1));
      expect(result.current.pdfDoc).toBe(currentDocument);
      expect(readMock).toHaveBeenNthCalledWith(2, sourceA);
      const zoomCalls = options.setZoomLevel.mock.calls.length;
      const viewportCalls = oldPage.getViewport.mock.calls.length;
      const oldRenderCalls = oldPage.render.mock.calls.length;
      await act(async () => {
        if (lateWork === "fit") fitting.resolve(oldPage);
        else if (lateWork === "page") fetchingPage.resolve(oldPage);
        else oldRendering.reject(new Error("Late cancelled render failure"));
      });

      expect(result.current).toMatchObject({
        pdfDoc: currentDocument, numPages: 1, pdfLoading: false, pdfError: false,
      });
      expect(options.setZoomLevel).toHaveBeenCalledTimes(zoomCalls);
      expect(oldPage.getViewport).toHaveBeenCalledTimes(viewportCalls);
      expect(oldPage.render).toHaveBeenCalledTimes(oldRenderCalls);
      expect(oldTask.destroy).toHaveBeenCalledTimes(1);
      expect(nextTask.destroy).not.toHaveBeenCalled();
      expect(currentRendering.cancel).not.toHaveBeenCalled();
      expect(readMock).toHaveBeenCalledTimes(2);
      unmount();
      expect(oldTask.destroy).toHaveBeenCalledTimes(1);
      expect(currentRendering.cancel).toHaveBeenCalledTimes(1);
      expect(nextTask.destroy).toHaveBeenCalledTimes(1);
      expect(currentRendering.cancel.mock.invocationCallOrder[0]).toBeLessThan(nextTask.destroy.mock.invocationCallOrder[0]);
      await act(async () => {});
    },
  );

  it("旧 retry 闭包在换源、A→B→A、一次重试和卸载后都不能重新读文件", async () => {
    readMock.mockRejectedValue(new Error("Synthetic persistent read failure"));
    const { result, rerender, unmount } = renderPreview();
    await waitFor(() => expect(result.current.pdfError).toBe(true));
    const firstA = result.current.retryPreview;
    rerender({ pdfPath: sourceB, isFullscreen: false });
    await waitFor(() => expect(result.current.pdfError).toBe(true));
    act(() => { firstA(); });
    await act(async () => {});
    expect(readMock).toHaveBeenCalledTimes(2);

    rerender({ pdfPath: sourceA, isFullscreen: false });
    await waitFor(() => expect(result.current.pdfError).toBe(true));
    act(() => { firstA(); });
    await act(async () => {});
    expect(readMock).toHaveBeenCalledTimes(3);
    const returnedA = result.current.retryPreview;
    act(() => { returnedA(); });
    await waitFor(() => expect(readMock).toHaveBeenCalledTimes(4));
    await waitFor(() => expect(result.current.pdfError).toBe(true));
    act(() => { returnedA(); });
    await act(async () => {});
    expect(readMock).toHaveBeenCalledTimes(4);

    const currentRetry = result.current.retryPreview;
    unmount();
    act(() => {
      firstA();
      returnedA();
      currentRetry();
    });
    await act(async () => {});
    expect(readMock).toHaveBeenCalledTimes(4);
    expect(pdfRenderer.getDocument).not.toHaveBeenCalled();
  });

  it("StrictMode 重放后仍可原路径重试，重复操作不创建额外 worker 且卸载只释放一次", async () => {
    readMock.mockRejectedValueOnce(new Error("Synthetic first read failure"));
    const document = makeDocument();
    const task = makeLoadingTask(document);
    pdfRenderer.getDocument.mockReturnValueOnce(task);
    const options = makeOptions();
    const { result, unmount } = renderHook(() => useWritingPdfPreview(sourceA, options), { wrapper: StrictWrapper });
    await waitFor(() => expect(result.current.pdfError).toBe(true));
    const retry = result.current.retryPreview;
    act(() => {
      retry();
      retry();
    });
    await waitFor(() => expect(result.current.pdfDoc).toBe(document));
    act(() => {
      retry();
      result.current.retryPreview();
    });
    await act(async () => {});

    expect(result.current.pdfError).toBe(false);
    expect(readMock).toHaveBeenCalledTimes(2);
    expect(pdfRenderer.getDocument).toHaveBeenCalledTimes(1);
    expect(task.destroy).not.toHaveBeenCalled();
    unmount();
    expect(task.destroy).toHaveBeenCalledTimes(1);
    expect(document.destroy).not.toHaveBeenCalled();
  });

  it.each(["throw", "reject"] as const)("destroy %s 被接住且不会阻止下一份 PDF 加载", async (failureMode) => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    const failure = new Error("Worker teardown failed");
    const task = makeLoadingTask(makeDocument());
    if (failureMode === "throw") task.destroy.mockImplementationOnce(() => { throw failure; });
    else task.destroy.mockRejectedValueOnce(failure);
    pdfRenderer.getDocument.mockReturnValueOnce(task);
    const { result, rerender, unmount } = renderPreview();
    await waitFor(() => expect(result.current.pdfDoc).not.toBeNull());
    rerender({ pdfPath: sourceB, isFullscreen: false });
    await waitFor(() => expect(warning).toHaveBeenCalledWith("PDF 预览资源释放失败", failure));
    await waitFor(() => expect(result.current.pdfLoading).toBe(false));
    expect(result.current.pdfError).toBe(false);
    expect(result.current.pdfDoc).not.toBeNull();
    unmount();
    expect(task.destroy).toHaveBeenCalledTimes(1);
  });

  it.each([false, true])("换源首 render 就移除旧文档和页数，回到空预览：%s", async (toNull) => {
    const oldDocument = makeDocument(4);
    const oldTask = makeLoadingTask(oldDocument);
    const nextTask = makeLoadingTask();
    pdfRenderer.getDocument.mockReturnValueOnce(oldTask).mockReturnValueOnce(nextTask);
    const options = makeOptions();
    options.canvasRefs.current.clear();
    const seen: Array<ReturnType<typeof useWritingPdfPreview>> = [];
    const { result, rerender } = renderHook(({ pdfPath }) => {
      const preview = useWritingPdfPreview(pdfPath, options);
      seen.push(preview);
      return preview;
    }, { initialProps: { pdfPath: sourceA as string | null } });
    await waitFor(() => expect(result.current.pdfDoc).toBe(oldDocument));
    const firstNewRender = seen.length;
    rerender({ pdfPath: toNull ? null : sourceB });
    expect(seen.slice(firstNewRender).length).toBeGreaterThan(0);
    for (const preview of seen.slice(firstNewRender)) {
      expect(preview).toMatchObject({
        pdfDoc: null, numPages: 0, pdfLoading: !toNull, pdfError: false,
      });
    }
    expect(oldTask.destroy).toHaveBeenCalledTimes(1);
    if (!toNull) {
      const nextDocument = makeDocument();
      await waitFor(() => expect(pdfRenderer.getDocument).toHaveBeenCalledTimes(2));
      await act(async () => { nextTask.resolve(nextDocument); });
      expect(result.current.pdfDoc).toBe(nextDocument);
    }
  });

  describe.each([false, true])("隔离旧加载结果（A→B→A：%s）", (returnToA) => {
    it.each(["success", "failure"] as const)("旧 %s 不覆盖当前预览或错误状态", async (completion) => {
      const firstTask = makeLoadingTask();
      const middleTask = makeLoadingTask();
      const finalTask = makeLoadingTask();
      pdfRenderer.getDocument.mockReturnValueOnce(firstTask).mockReturnValueOnce(middleTask)
        .mockReturnValueOnce(finalTask);
      const { result, rerender } = renderPreview();
      await waitFor(() => expect(pdfRenderer.getDocument).toHaveBeenCalledTimes(1));
      rerender({ pdfPath: sourceB, isFullscreen: false });
      await waitFor(() => expect(pdfRenderer.getDocument).toHaveBeenCalledTimes(2));
      if (returnToA) {
        rerender({ pdfPath: sourceA, isFullscreen: false });
        await waitFor(() => expect(pdfRenderer.getDocument).toHaveBeenCalledTimes(3));
      }
      const currentDocument = makeDocument();
      await act(async () => { (returnToA ? finalTask : middleTask).resolve(currentDocument); });
      expect(result.current.pdfDoc).toBe(currentDocument);
      await act(async () => {
        if (completion === "success") firstTask.resolve(makeDocument());
        else firstTask.reject(new Error("Old load failed"));
        if (returnToA) middleTask.reject(new Error("Intermediate load failed"));
      });
      expect(result.current).toMatchObject({
        pdfDoc: currentDocument, numPages: 0, pdfLoading: false, pdfError: false,
      });
      expect(firstTask.destroy).toHaveBeenCalledTimes(1);
      if (returnToA) expect(middleTask.destroy).toHaveBeenCalledTimes(1);
    });
  });

  it("StrictMode 重放独立清理旧 lifetime，当前读取、worker 和预览保持可用", async () => {
    const document = makeDocument();
    const task = makeLoadingTask(document);
    pdfRenderer.getDocument.mockReturnValueOnce(task);
    const options = makeOptions();
    const { result, unmount } = renderHook(() => useWritingPdfPreview(sourceA, options), { wrapper: StrictWrapper });
    await waitFor(() => expect(result.current.pdfDoc).toBe(document));
    expect(readMock).toHaveBeenCalledTimes(1);
    expect(pdfRenderer.getDocument).toHaveBeenCalledTimes(1);
    expect(task.destroy).not.toHaveBeenCalled();
    expect(options.setZoomLevel).toHaveBeenCalledWith(1);
    unmount();
    expect(task.destroy).toHaveBeenCalledTimes(1);
    expect(document.destroy).not.toHaveBeenCalled();
  });

  it("进入和退出全屏只取消旧绘制并重绘，不重读、销毁文档或重置缩放；卸载先 cancel 再 destroy", async () => {
    const page = makePage();
    const firstRender = makeRenderTask();
    const fullscreenRender = makeRenderTask();
    const restoredRender = makeRenderTask();
    page.render.mockReturnValueOnce(firstRender).mockReturnValueOnce(fullscreenRender)
      .mockReturnValueOnce(restoredRender);
    const document = makeDocument(1, page);
    const task = makeLoadingTask(document);
    pdfRenderer.getDocument.mockReturnValueOnce(task);
    const options = makeOptions();
    const { result, rerender, unmount } = renderPreview(sourceA, options);
    await waitFor(() => expect(page.render).toHaveBeenCalledTimes(1));
    const zoomCalls = options.setZoomLevel.mock.calls.length;
    rerender({ pdfPath: sourceA, isFullscreen: true });
    await waitFor(() => expect(page.render).toHaveBeenCalledTimes(2));
    expect(firstRender.cancel).toHaveBeenCalledTimes(1);
    rerender({ pdfPath: sourceA, isFullscreen: false });
    await waitFor(() => expect(page.render).toHaveBeenCalledTimes(3));
    expect(fullscreenRender.cancel).toHaveBeenCalledTimes(1);
    expect(options.setZoomLevel).toHaveBeenCalledTimes(zoomCalls);
    expect(readMock).toHaveBeenCalledTimes(1);
    expect(pdfRenderer.getDocument).toHaveBeenCalledTimes(1);
    expect(task.destroy).not.toHaveBeenCalled();
    expect(result.current.pdfError).toBe(false);
    unmount();
    expect(restoredRender.cancel).toHaveBeenCalledTimes(1);
    expect(task.destroy).toHaveBeenCalledTimes(1);
    expect(restoredRender.cancel.mock.invocationCallOrder[0]).toBeLessThan(task.destroy.mock.invocationCallOrder[0]);
    expect(document.destroy).not.toHaveBeenCalled();
    await act(async () => {});
  });

  it.each(["fit page", "render page", "viewport", "context", "render start", "render completion"] as const)(
    "%s 失败清除失效文档并释放 loadingTask，卸载不重复释放",
    async (stage) => {
      const failure = new Error(stage);
      const page = makePage();
      const document = makeDocument(1, page);
      const task = makeLoadingTask(document);
      const options = makeOptions();
      if (stage === "fit page") document.getPage.mockRejectedValueOnce(failure);
      if (stage === "render page") document.getPage.mockResolvedValueOnce(page).mockRejectedValueOnce(failure);
      if (stage === "viewport") page.getViewport.mockImplementation(() => { throw failure; });
      if (stage === "context") vi.mocked(options.canvasRefs.current.get(1)!.getContext).mockReturnValue(null);
      if (stage === "render start") page.render.mockImplementation(() => { throw failure; });
      if (stage === "render completion") page.render.mockImplementation(() => ({
        promise: Promise.reject(failure), cancel: vi.fn(),
      }));
      pdfRenderer.getDocument.mockReturnValueOnce(task);
      const { result, unmount } = renderPreview(sourceA, options);
      await waitFor(() => expect(result.current.pdfError).toBe(true));
      expect(result.current.pdfLoading).toBe(false);
      expect(result.current.pdfDoc).toBeNull();
      expect(task.destroy).toHaveBeenCalledTimes(1);
      unmount();
      expect(task.destroy).toHaveBeenCalledTimes(1);
    },
  );

  it("fit 迟到失败先取消绘制再释放 owner，全屏切换不重启失败文档", async () => {
    const fitting = deferred<ReturnType<typeof makePage>>();
    const rendering = makeRenderTask();
    const page = makePage();
    page.render.mockReturnValueOnce(rendering);
    const document = makeDocument(1, page);
    document.getPage.mockReturnValueOnce(fitting.promise);
    const task = makeLoadingTask(document);
    pdfRenderer.getDocument.mockReturnValueOnce(task);
    const { result, rerender, unmount } = renderPreview();
    await waitFor(() => expect(page.render).toHaveBeenCalledTimes(1));
    await act(async () => { fitting.reject(new Error("Fit failed")); });
    expect(result.current.pdfError).toBe(true);
    expect(result.current.pdfDoc).toBeNull();
    expect(rendering.cancel).toHaveBeenCalledTimes(1);
    expect(task.destroy).toHaveBeenCalledTimes(1);
    expect(rendering.cancel.mock.invocationCallOrder[0]).toBeLessThan(task.destroy.mock.invocationCallOrder[0]);
    rerender({ pdfPath: sourceA, isFullscreen: true });
    await act(async () => {});
    expect(page.render).toHaveBeenCalledTimes(1);
    expect(task.destroy).toHaveBeenCalledTimes(1);
    unmount();
    expect(rendering.cancel).toHaveBeenCalledTimes(1);
    expect(task.destroy).toHaveBeenCalledTimes(1);
  });

  it.each(["success", "failure"] as const)("旧 fit 和 getPage 迟到 %s 不改新文档缩放、错误或启动旧绘制", async (completion) => {
    const fitting = deferred<ReturnType<typeof makePage>>();
    const fetchingPage = deferred<ReturnType<typeof makePage>>();
    const oldPage = makePage();
    const oldDocument = makeDocument(1, oldPage);
    oldDocument.getPage.mockReturnValueOnce(fitting.promise).mockReturnValueOnce(fetchingPage.promise);
    const oldTask = makeLoadingTask(oldDocument);
    const currentDocument = makeDocument();
    const nextTask = makeLoadingTask(currentDocument);
    pdfRenderer.getDocument.mockReturnValueOnce(oldTask).mockReturnValueOnce(nextTask);
    const options = makeOptions();
    const { result, rerender } = renderPreview(sourceA, options);
    await waitFor(() => expect(oldDocument.getPage).toHaveBeenCalledTimes(2));
    rerender({ pdfPath: sourceB, isFullscreen: false });
    await waitFor(() => expect(result.current.pdfDoc).toBe(currentDocument));
    const zoomCalls = options.setZoomLevel.mock.calls.length;
    await act(async () => {
      if (completion === "success") {
        fitting.resolve(oldPage);
        fetchingPage.resolve(oldPage);
      } else {
        fitting.reject(new Error("Old fit failed"));
        fetchingPage.reject(new Error("Old page failed"));
      }
    });
    expect(result.current.pdfDoc).toBe(currentDocument);
    expect(result.current.pdfError).toBe(false);
    expect(options.setZoomLevel).toHaveBeenCalledTimes(zoomCalls);
    expect(oldPage.getViewport).not.toHaveBeenCalled();
    expect(oldPage.render).not.toHaveBeenCalled();
    expect(oldTask.destroy).toHaveBeenCalledTimes(1);
    expect(nextTask.destroy).not.toHaveBeenCalled();
  });

  it("全屏旧绘制的迟到 finally 不丢失新绘制的取消所有权", async () => {
    const oldRendering = makeRenderTask();
    oldRendering.cancel.mockImplementation(() => {});
    const currentRendering = makeRenderTask();
    const page = makePage();
    page.render.mockReturnValueOnce(oldRendering).mockReturnValueOnce(currentRendering);
    const task = makeLoadingTask(makeDocument(1, page));
    pdfRenderer.getDocument.mockReturnValueOnce(task);
    const { result, rerender, unmount } = renderPreview();
    await waitFor(() => expect(page.render).toHaveBeenCalledTimes(1));
    rerender({ pdfPath: sourceA, isFullscreen: true });
    await waitFor(() => expect(page.render).toHaveBeenCalledTimes(2));
    expect(oldRendering.cancel).toHaveBeenCalledTimes(1);
    await act(async () => { oldRendering.reject(new Error("Late cancelled render")); });
    expect(result.current.pdfError).toBe(false);
    expect(currentRendering.cancel).not.toHaveBeenCalled();
    expect(task.destroy).not.toHaveBeenCalled();
    unmount();
    expect(oldRendering.cancel).toHaveBeenCalledTimes(1);
    expect(currentRendering.cancel).toHaveBeenCalledTimes(1);
    expect(currentRendering.cancel.mock.invocationCallOrder[0]).toBeLessThan(task.destroy.mock.invocationCallOrder[0]);
    expect(task.destroy).toHaveBeenCalledTimes(1);
    await act(async () => {});
  });

  it("已取消的旧绘制迟到失败不会污染新文档，也不会重复取消或销毁", async () => {
    const rendering = makeRenderTask();
    // Simulate a renderer whose cancellation cannot immediately settle its work.
    rendering.cancel.mockImplementation(() => {});
    const page = makePage();
    page.render.mockReturnValueOnce(rendering);
    const oldTask = makeLoadingTask(makeDocument(1, page));
    const currentDocument = makeDocument();
    const nextTask = makeLoadingTask(currentDocument);
    pdfRenderer.getDocument.mockReturnValueOnce(oldTask).mockReturnValueOnce(nextTask);
    const { result, rerender } = renderPreview();
    await waitFor(() => expect(page.render).toHaveBeenCalledTimes(1));
    rerender({ pdfPath: sourceB, isFullscreen: false });
    await waitFor(() => expect(result.current.pdfDoc).toBe(currentDocument));
    await act(async () => { rendering.reject(new Error("Late render failure")); });
    expect(result.current.pdfError).toBe(false);
    expect(result.current.pdfDoc).toBe(currentDocument);
    expect(rendering.cancel).toHaveBeenCalledTimes(1);
    expect(oldTask.destroy).toHaveBeenCalledTimes(1);
    expect(nextTask.destroy).not.toHaveBeenCalled();
  });
});
