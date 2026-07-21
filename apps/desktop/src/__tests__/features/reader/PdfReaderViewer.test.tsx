import type { PDFDocumentProxy } from "pdfjs-dist";
import { afterEach, describe, expect, it, vi } from "vitest";
import PdfReaderViewer from "../../../features/reader/PdfReaderViewer";
import { render } from "../../helpers/render";

vi.mock("pdfjs-dist", () => ({
  setLayerDimensions: vi.fn(),
  TextLayer: class {
    render = vi.fn(async () => undefined);
    cancel = vi.fn();
  },
}));

describe("PdfReaderViewer", () => {
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
});
