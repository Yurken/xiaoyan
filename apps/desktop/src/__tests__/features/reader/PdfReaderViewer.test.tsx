import type { PDFDocumentProxy } from "pdfjs-dist";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PdfReaderViewer from "../../../features/reader/PdfReaderViewer";
import { render, waitFor } from "../../helpers/render";

const renderState = vi.hoisted(() => ({ pages: new Map<number, { w: number; h: number }>() }));
// Control bitmap readiness independently of document metadata and layout.
vi.mock("../../../features/reader/usePdfPageRender", () => ({
  usePdfPageRender: ({ pageNum }: { pageNum: number }) => ({ pageSize: renderState.pages.get(pageNum) ?? null, renderedScale: 1, imgSrc: null, links: [] }),
}));

vi.mock("pdfjs-dist", () => ({
  setLayerDimensions: vi.fn(),
  TextLayer: class {
    render = vi.fn(async () => undefined);
    cancel = vi.fn();
  },
}));

describe("PdfReaderViewer", () => {
  beforeEach(() => renderState.pages.clear());
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("把第 5 页及后续页面交给懒渲染观察器", () => {
    const observedPages = new Set<number>();
    class CapturingIntersectionObserver {
      observe(element: Element) {
        const page = Number((element as HTMLElement).dataset.pageNum);
        if (page > 0) observedPages.add(page);
      }
      unobserve() { return undefined; }
      disconnect() { return undefined; }
    }
    vi.stubGlobal("IntersectionObserver", CapturingIntersectionObserver);
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 1);

    render(
      <PdfReaderViewer
        pdfDoc={{ numPages: 7 } as PDFDocumentProxy}
        notes={[]}
        scale={1.4}
        onTextSelected={vi.fn()}
        onSelectionCleared={vi.fn()}
        onNoteClick={vi.fn()}
        onZoom={vi.fn()}
      />,
    );

    expect([...observedPages]).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("双页模式把 2、3 页并到同一行，首页仍单独占一行", () => {
    class SilentIntersectionObserver {
      observe() { return undefined; }
      unobserve() { return undefined; }
      disconnect() { return undefined; }
    }
    vi.stubGlobal("IntersectionObserver", SilentIntersectionObserver);
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 1);

    const { container } = render(
      <PdfReaderViewer
        pdfDoc={{ numPages: 5 } as PDFDocumentProxy}
        notes={[]}
        scale={1}
        pageLayout="spread"
        onTextSelected={vi.fn()}
        onSelectionCleared={vi.fn()}
        onNoteClick={vi.fn()}
        onZoom={vi.fn()}
      />,
    );

    const page = (num: number) => container.querySelector(`[data-page-num="${num}"]`);
    expect(page(1)?.parentElement).not.toBe(page(2)?.parentElement);
    expect(page(2)?.parentElement).toBe(page(3)?.parentElement);
    expect(page(4)?.parentElement).toBe(page(5)?.parentElement);
    expect(page(2)?.parentElement).not.toBe(page(4)?.parentElement);
  });

  it("单页模式每页各占一行", () => {
    class SilentIntersectionObserver {
      observe() { return undefined; }
      unobserve() { return undefined; }
      disconnect() { return undefined; }
    }
    vi.stubGlobal("IntersectionObserver", SilentIntersectionObserver);
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 1);

    const { container } = render(
      <PdfReaderViewer
        pdfDoc={{ numPages: 3 } as PDFDocumentProxy}
        notes={[]}
        scale={1}
        onTextSelected={vi.fn()}
        onSelectionCleared={vi.fn()}
        onNoteClick={vi.fn()}
        onZoom={vi.fn()}
      />,
    );

    const page = (num: number) => container.querySelector(`[data-page-num="${num}"]`);
    expect(page(1)?.parentElement).not.toBe(page(2)?.parentElement);
    expect(page(2)?.parentElement).not.toBe(page(3)?.parentElement);
  });

  it("未渲染的双页占位在窄阅读区和300%缩放下仍合计不超出内容宽度", async () => {
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(400);
    const pdfDoc = {
      numPages: 7,
      getPage: vi.fn(async () => ({ getViewport: () => ({ width: 600, height: 800 }) })),
    } as unknown as PDFDocumentProxy;
    const { container } = render(
      <PdfReaderViewer
        pdfDoc={pdfDoc}
        notes={[]}
        scale={3}
        pageLayout="spread"
        onTextSelected={vi.fn()}
        onSelectionCleared={vi.fn()}
        onNoteClick={vi.fn()}
        onZoom={vi.fn()}
      />,
    );
    const pages = [...container.querySelectorAll<HTMLElement>("[data-page-num]")];
    await waitFor(() => expect(Number.parseFloat(pages[6].style.width)).toBeGreaterThan(0));
    expect(pages.every((page) => page.dataset.pageReady === "0")).toBe(true);
    const width = (index: number) => Number.parseFloat(pages[index].style.width);
    expect(width(1) + width(2) + 16 + 48).toBeCloseTo(400);
    expect(width(5) + width(6) + 16 + 48).toBeCloseTo(400);
  });

  it("后续横版页使用本行真实宽度适配，不让首页宽度决定整篇适宽", async () => {
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(1000);
    // Only page 3 has finished rendering; the other pages retain lazy placeholders.
    renderState.pages.set(3, { w: 900, h: 600 });
    const pdfDoc = {
      numPages: 7,
      getPage: vi.fn(async () => ({ getViewport: () => ({ width: 600, height: 800 }) })),
    } as unknown as PDFDocumentProxy;
    const { container } = render(
      <PdfReaderViewer
        pdfDoc={pdfDoc}
        notes={[]}
        scale={1}
        pageLayout="spread"
        onTextSelected={vi.fn()}
        onSelectionCleared={vi.fn()}
        onNoteClick={vi.fn()}
        onZoom={vi.fn()}
      />,
    );
    const pages = [...container.querySelectorAll<HTMLElement>("[data-page-num]")];
    await waitFor(() => expect(Number.parseFloat(pages[1].style.width)).toBeCloseTo(374.4));
    const width = (index: number) => Number.parseFloat(pages[index].style.width);
    expect(width(1) + width(2) + 16 + 48).toBeCloseTo(1000);
    expect(width(3) + width(4) + 16 + 48).toBeCloseTo(1000);
    expect(pages[2].dataset.pageReady).toBe("1");
    expect(pages[6].dataset.pageReady).toBe("0");
    // Sizing must not rasterize or even fetch every page up front.
    expect(pdfDoc.getPage).toHaveBeenCalledTimes(1);
    expect(pdfDoc.getPage).toHaveBeenCalledWith(1);
  });
});
