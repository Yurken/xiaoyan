import { useEffect, type RefObject } from "react";
import { mergeNormalizedRects, type NormalizedRect, type ReaderSelection } from "./readerTypes";

interface UsePdfTextSelectionOptions {
  containerRef: RefObject<HTMLElement | null>;
  enabled: boolean;
  onTextSelected: (selection: ReaderSelection) => void;
  onSelectionCleared: () => void;
}

function nodeElement(node: Node): Element | null {
  return node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
}

function eventElement(target: EventTarget | null): Element | null {
  if (target instanceof Element) return target;
  if (target instanceof Node) return nodeElement(target);
  return null;
}

function findPageElement(range: Range): HTMLElement | null {
  const startElement = nodeElement(range.startContainer)?.closest("[data-page-num]");
  if (startElement instanceof HTMLElement) return startElement;

  const endElement = nodeElement(range.endContainer)?.closest("[data-page-num]");
  if (endElement instanceof HTMLElement) return endElement;

  const rangeRect = range.getBoundingClientRect();
  if (rangeRect.width > 0 && rangeRect.height > 0) {
    const element = document.elementFromPoint(
      rangeRect.left + rangeRect.width / 2,
      rangeRect.top + rangeRect.height / 2,
    )?.closest("[data-page-num]");
    if (element instanceof HTMLElement) return element;
  }

  for (const rect of Array.from(range.getClientRects())) {
    if (rect.width < 1 || rect.height < 1) continue;
    const element = document.elementFromPoint(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
    )?.closest("[data-page-num]");
    if (element instanceof HTMLElement) return element;
  }

  return null;
}

function selectionRects(range: Range, pageRect: DOMRect): NormalizedRect[] {
  const normalized = Array.from(range.getClientRects())
    .filter((rect) => rect.width >= 1 && rect.height >= 1)
    .map((rect) => ({
      x: (rect.left - pageRect.left) / pageRect.width,
      y: (rect.top - pageRect.top) / pageRect.height,
      w: rect.width / pageRect.width,
      h: rect.height / pageRect.height,
    }));
  return mergeNormalizedRects(normalized);
}

function popupPoint(range: Range, fallback: MouseEvent) {
  const rects = Array.from(range.getClientRects()).filter((rect) => rect.width >= 1 && rect.height >= 1);
  const lastRect = rects[rects.length - 1];
  if (!lastRect) {
    return { x: fallback.clientX, y: fallback.clientY - 12 };
  }
  return { x: lastRect.left + lastRect.width / 2, y: lastRect.top };
}

export function usePdfTextSelection({
  containerRef,
  enabled,
  onTextSelected,
  onSelectionCleared,
}: UsePdfTextSelectionOptions) {
  useEffect(() => {
    if (!enabled) return;

    const handleMouseUp = (event: MouseEvent) => {
      const target = eventElement(event.target);
      if (target?.closest(".pdf-selection-popup")) return;
      // 点击已有高亮交给 PdfPage 的 onClick 打开编辑弹窗，这里不要把它当作“清空选区”。
      if (target?.closest(".pdf-highlight-overlay")) return;

      // WKWebView 会稍晚同步原生选区，延后一拍读取更稳。
      window.setTimeout(() => {
        const container = containerRef.current;
        const selection = window.getSelection();
        const selectedText = selection?.toString().trim() ?? "";
        if (!container || !selection || selection.rangeCount === 0 || selection.isCollapsed || selectedText.length < 2) {
          onSelectionCleared();
          return;
        }

        const range = selection.getRangeAt(0);
        const pageElement = findPageElement(range);
        if (!pageElement || !container.contains(pageElement)) return;

        const page = Number(pageElement.getAttribute("data-page-num"));
        const pageRect = pageElement.getBoundingClientRect();
        if (!Number.isFinite(page) || page <= 0 || pageRect.width === 0 || pageRect.height === 0) return;

        const positions = selectionRects(range, pageRect);
        const point = popupPoint(range, event);
        onTextSelected({
          text: selectedText,
          page,
          positions,
          popupX: point.x,
          popupY: point.y,
        });
      }, 20);
    };

    const handleMouseDown = (event: MouseEvent) => {
      const target = eventElement(event.target);
      if (target?.closest(".pdf-selection-popup")) return;
      if (target?.closest(".pdf-highlight-overlay")) return;
      if (!target?.closest(".textLayer")) {
        onSelectionCleared();
      }
    };

    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("mousedown", handleMouseDown);
    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, [containerRef, enabled, onTextSelected, onSelectionCleared]);
}
