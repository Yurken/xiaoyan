import { useCallback, useState, type MouseEvent, type RefObject } from "react";
import { cropPdfPageImage } from "./pdfImageCrop";
import type { NormalizedRect, ReaderImageSelection } from "./readerTypes";

interface PageSize {
  w: number;
  h: number;
}

interface UsePdfAreaSelectionOptions {
  enabled: boolean;
  page: number;
  pageSize: PageSize | null;
  imageRef: RefObject<HTMLImageElement | null>;
  onAreaSelected?: (selection: ReaderImageSelection) => void;
  onError?: (message: string) => void;
}

const MIN_NORMALIZED_SIZE = 0.015;

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function rectFromPoints(start: { x: number; y: number }, current: { x: number; y: number }): NormalizedRect {
  return {
    x: Math.min(start.x, current.x),
    y: Math.min(start.y, current.y),
    w: Math.abs(current.x - start.x),
    h: Math.abs(current.y - start.y),
  };
}

export function usePdfAreaSelection({
  enabled,
  page,
  pageSize,
  imageRef,
  onAreaSelected,
  onError,
}: UsePdfAreaSelectionOptions) {
  const [draftRect, setDraftRect] = useState<NormalizedRect | null>(null);

  const startAreaSelection = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (!enabled || !pageSize) return;
      event.preventDefault();
      event.stopPropagation();

      const bounds = event.currentTarget.getBoundingClientRect();
      if (bounds.width === 0 || bounds.height === 0) return;

      const toPoint = (clientX: number, clientY: number) => ({
        x: clamp01((clientX - bounds.left) / bounds.width),
        y: clamp01((clientY - bounds.top) / bounds.height),
      });
      const start = toPoint(event.clientX, event.clientY);
      setDraftRect({ x: start.x, y: start.y, w: 0, h: 0 });

      const onMove = (moveEvent: globalThis.MouseEvent) => {
        setDraftRect(rectFromPoints(start, toPoint(moveEvent.clientX, moveEvent.clientY)));
      };
      const onUp = (upEvent: globalThis.MouseEvent) => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        const rect = rectFromPoints(start, toPoint(upEvent.clientX, upEvent.clientY));
        setDraftRect(null);
        if (rect.w < MIN_NORMALIZED_SIZE || rect.h < MIN_NORMALIZED_SIZE) return;

        try {
          const image = imageRef.current;
          if (!image) throw new Error("当前 PDF 页面图像尚未准备好，请稍后再试。");
          onAreaSelected?.(cropPdfPageImage(image, rect, page));
        } catch (err) {
          onError?.(err instanceof Error ? err.message : "框选图像失败。");
        }
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [enabled, imageRef, onAreaSelected, onError, page, pageSize],
  );

  return { draftRect, startAreaSelection };
}
