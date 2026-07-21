import type { NormalizedRect } from "./readerTypes";

export const TEXT_ANNOTATION_INPUT_WIDTH = 192;
export const TEXT_ANNOTATION_INPUT_HEIGHT = 88;

interface PixelBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function createTextAnnotationRect(clientX: number, clientY: number, bounds: PixelBounds): NormalizedRect {
  const w = Math.min(1, TEXT_ANNOTATION_INPUT_WIDTH / Math.max(1, bounds.width));
  const h = Math.min(1, TEXT_ANNOTATION_INPUT_HEIGHT / Math.max(1, bounds.height));
  const pointerX = (clientX - bounds.left) / Math.max(1, bounds.width);
  const pointerY = (clientY - bounds.top) / Math.max(1, bounds.height);
  return {
    x: Math.min(1 - w, Math.max(0, pointerX)),
    y: Math.min(1 - h, Math.max(0, pointerY)),
    w,
    h,
  };
}

export function clampTextAnnotationInputPosition(
  rect: NormalizedRect,
  pageSize: { w: number; h: number },
) {
  const inputWidth = Math.min(1, TEXT_ANNOTATION_INPUT_WIDTH / Math.max(1, pageSize.w));
  const inputHeight = Math.min(1, TEXT_ANNOTATION_INPUT_HEIGHT / Math.max(1, pageSize.h));
  return {
    x: Math.min(1 - inputWidth, Math.max(0, rect.x)),
    y: Math.min(1 - inputHeight, Math.max(0, rect.y)),
  };
}
