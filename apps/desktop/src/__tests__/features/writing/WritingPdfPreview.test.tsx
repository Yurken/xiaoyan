import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { getDocument } from "pdfjs-dist";
import { readFile, writeFile } from "@tauri-apps/plugin-fs";
import { save } from "@tauri-apps/plugin-dialog";
import WritingPdfPreview from "../../../features/writing/WritingPdfPreview";
import type { WritingCompileSummary } from "../../../features/writing/shared";

// jsdom 没有 canvas/DOMMatrix：pdfjs 整体 mock，2D 上下文只提供组件用到的 setTransform。
vi.mock("pdfjs-dist", () => ({
  GlobalWorkerOptions: { workerSrc: "" },
  getDocument: vi.fn(),
}));

interface FakeRenderTask {
  promise: Promise<void>;
  cancel: Mock;
}

interface FakePdfPage {
  pageNumber: number;
  getViewport: Mock;
  render: Mock<() => FakeRenderTask>;
}

interface FakePdfDoc {
  numPages: number;
  destroy: Mock<() => Promise<void>>;
  getPage: Mock<(pageNum: number) => Promise<FakePdfPage>>;
  pages: FakePdfPage[];
}

function createFakePdfDoc(numPages: number, options?: { pendingRender?: boolean }): FakePdfDoc {
  const pages: FakePdfPage[] = Array.from({ length: numPages }, (_, i) => ({
    pageNumber: i + 1,
    getViewport: vi.fn(({ scale }: { scale: number }) => ({ width: 400 * scale, height: 600 * scale, scale })),
    render: vi.fn(() => ({
      promise: options?.pendingRender ? new Promise<void>(() => {}) : Promise.resolve(),
      cancel: vi.fn(),
    })),
  }));
  return {
    numPages,
    destroy: vi.fn(() => Promise.resolve()),
    getPage: vi.fn((pageNum: number) => Promise.resolve(pages[pageNum - 1])),
    pages,
  };
}

const getDocumentMock = getDocument as unknown as Mock<
  (opts: { data: Uint8Array }) => { promise: Promise<FakePdfDoc> }
>;

let docQueue: FakePdfDoc[] = [];

function successResult(pdfPath: string): WritingCompileSummary {
  return { success: true, pdfPath, workDir: "/tmp/work", engine: "xelatex", log: "" };
}

function scrollerOf(container: HTMLElement): HTMLElement {
  const parent = container.querySelector("canvas")?.parentElement?.parentElement;
  if (!parent) throw new Error("PDF 滚动容器不存在");
  return parent;
}

/** 可手动触发交集回调的观察器，用于验证懒渲染只渲染可视页。 */
class ControllableIntersectionObserver {
  static instances: ControllableIntersectionObserver[] = [];
  elements: Element[] = [];
  private readonly callback: IntersectionObserverCallback;
  readonly options?: IntersectionObserverInit;
  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.callback = callback;
    this.options = options;
    ControllableIntersectionObserver.instances.push(this);
  }
  observe(element: Element) {
    this.elements.push(element);
  }
  unobserve(element: Element) {
    this.elements = this.elements.filter((el) => el !== element);
  }
  disconnect() {
    this.elements = [];
  }
  intersect(element: Element) {
    this.callback(
      [{ target: element, isIntersecting: true } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
}

async function renderLoaded(
  doc: FakePdfDoc,
  props?: Partial<{ compileResult: WritingCompileSummary | null; draftId: string; onSave: () => void }>,
) {
  docQueue.push(doc);
  const utils = render(
    <WritingPdfPreview compileResult={successResult("/papers/a.pdf")} draftId="d1" {...props} />,
  );
  await waitFor(() => expect(utils.container.querySelectorAll("canvas")).toHaveLength(doc.numPages));
  await screen.findByTitle("重置缩放");
  return utils;
}

describe("WritingPdfPreview", () => {
  beforeEach(() => {
    docQueue = [];
    vi.mocked(readFile).mockReset().mockResolvedValue(new Uint8Array([37, 80, 68, 70]));
    vi.mocked(writeFile).mockReset().mockResolvedValue(undefined);
    vi.mocked(save).mockReset().mockResolvedValue(null);
    getDocumentMock.mockReset();
    getDocumentMock.mockImplementation(() => ({ promise: Promise.resolve(docQueue.shift() as FakePdfDoc) }));
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      setTransform: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("无成功结果时展示自动预览引导，不出现编译提示", () => {
    render(<WritingPdfPreview compileResult={null} draftId="d1" />);
    expect(screen.getByText("开始写作后，这里会自动生成论文预览。")).toBeInTheDocument();
    expect(screen.queryByText(/编译/)).not.toBeInTheDocument();
  });

  it("失败结果不会覆盖当前草稿已成功的预览", async () => {
    const doc = createFakePdfDoc(2);
    const { rerender } = await renderLoaded(doc);
    rerender(
      <WritingPdfPreview
        compileResult={{ success: false, pdfPath: null, workDir: "/tmp/work", engine: "xelatex", log: "boom" }}
        draftId="d1"
      />,
    );
    expect(await screen.findByTitle("重置缩放")).toBeInTheDocument();
    expect(doc.destroy).not.toHaveBeenCalled();
  });

  it("只渲染进入视野的页面，重复进入不重复渲染", async () => {
    ControllableIntersectionObserver.instances = [];
    vi.stubGlobal("IntersectionObserver", ControllableIntersectionObserver);
    const doc = createFakePdfDoc(4);
    const { container } = await renderLoaded(doc);

    const observer = ControllableIntersectionObserver.instances[0];
    const canvases = Array.from(container.querySelectorAll("canvas"));
    expect(observer.elements).toHaveLength(4);

    observer.intersect(canvases[1]);
    await waitFor(() => expect(doc.pages[1].render).toHaveBeenCalledTimes(1));
    expect(doc.pages[0].render).not.toHaveBeenCalled();
    expect(doc.pages[2].render).not.toHaveBeenCalled();
    expect(doc.pages[3].render).not.toHaveBeenCalled();

    observer.intersect(canvases[1]);
    await Promise.resolve();
    expect(doc.pages[1].render).toHaveBeenCalledTimes(1);
  });

  it("缺少 IntersectionObserver 时回退渲染全部页面", async () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const doc = createFakePdfDoc(4);
    await renderLoaded(doc);
    await waitFor(() => {
      for (const page of doc.pages) expect(page.render).toHaveBeenCalledTimes(1);
    });
  });

  it("同一草稿换 PDF 时保留缩放与滚动，加载完成后销毁旧文档", async () => {
    const first = createFakePdfDoc(2);
    const second = createFakePdfDoc(3);
    docQueue.push(first, second);
    const { container, rerender } = render(
      <WritingPdfPreview compileResult={successResult("/papers/a.pdf")} draftId="d1" />,
    );
    await waitFor(() => expect(container.querySelectorAll("canvas")).toHaveLength(2));
    await screen.findByTitle("重置缩放");

    fireEvent.click(screen.getByTitle("放大"));
    fireEvent.click(screen.getByTitle("放大"));
    expect(screen.getByTitle("重置缩放")).toHaveTextContent("120%");

    const scroller = scrollerOf(container);
    scroller.scrollTop = 120;

    rerender(<WritingPdfPreview compileResult={successResult("/papers/b.pdf")} draftId="d1" />);
    await waitFor(() => expect(container.querySelectorAll("canvas")).toHaveLength(3));

    expect(screen.getByTitle("重置缩放")).toHaveTextContent("120%");
    expect(scroller.scrollTop).toBe(120);
    await waitFor(() => expect(first.destroy).toHaveBeenCalledTimes(1));
  });

  it("切换草稿时重置缩放", async () => {
    docQueue.push(createFakePdfDoc(1), createFakePdfDoc(1));
    const { rerender } = render(
      <WritingPdfPreview compileResult={successResult("/papers/a.pdf")} draftId="d1" />,
    );
    await screen.findByTitle("重置缩放");
    fireEvent.click(screen.getByTitle("放大"));
    expect(screen.getByTitle("重置缩放")).toHaveTextContent("110%");

    rerender(<WritingPdfPreview compileResult={successResult("/papers/b.pdf")} draftId="d2" />);
    await waitFor(() => expect(getDocumentMock).toHaveBeenCalledTimes(2));
    expect(screen.getByTitle("重置缩放")).toHaveTextContent("100%");
  });

  it("卸载时取消在途渲染并销毁文档", async () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const doc = createFakePdfDoc(3, { pendingRender: true });
    docQueue.push(doc);
    const { unmount } = render(
      <WritingPdfPreview compileResult={successResult("/papers/a.pdf")} draftId="d1" />,
    );
    await waitFor(() => expect(doc.pages[0].render).toHaveBeenCalled());

    unmount();
    expect(doc.pages[0].render.mock.results[0]?.value.cancel).toHaveBeenCalled();
    expect(doc.destroy).toHaveBeenCalledTimes(1);
  });

  it("注入 onSave 时接管保存，未注入时保留另存为流程", async () => {
    const onSave = vi.fn();
    const first = createFakePdfDoc(1);
    const { unmount } = await renderLoaded(first, { onSave });
    fireEvent.click(screen.getByTitle("下载 PDF"));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(vi.mocked(save)).not.toHaveBeenCalled();
    unmount();

    docQueue.push(createFakePdfDoc(1));
    vi.mocked(save).mockResolvedValue("/papers/export.pdf");
    render(<WritingPdfPreview compileResult={successResult("/papers/a.pdf")} draftId="d1" />);
    fireEvent.click(await screen.findByTitle("下载 PDF"));
    await waitFor(() =>
      expect(vi.mocked(writeFile)).toHaveBeenCalledWith("/papers/export.pdf", expect.any(Uint8Array)),
    );
  });

  it("缩放快捷键只在预览悬停或聚焦时生效", async () => {
    const doc = createFakePdfDoc(1);
    const { container } = await renderLoaded(doc);
    const scroller = scrollerOf(container);

    fireEvent.keyDown(window, { key: "=", metaKey: true });
    expect(screen.getByTitle("重置缩放")).toHaveTextContent("100%");

    fireEvent.mouseEnter(scroller);
    fireEvent.keyDown(window, { key: "=", metaKey: true });
    expect(screen.getByTitle("重置缩放")).toHaveTextContent("110%");

    fireEvent.mouseLeave(scroller);
    fireEvent.keyDown(window, { key: "=", metaKey: true });
    expect(screen.getByTitle("重置缩放")).toHaveTextContent("110%");
  });
});
