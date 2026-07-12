import type { NormalizedRect, ReaderImageSelection } from "./readerTypes";

const MAX_CROP_SIDE = 1600;
const MIN_CROP_PIXELS = 8;
const OUTPUT_MEDIA_TYPE = "image/png";

function cropBounds(rect: NormalizedRect, width: number, height: number) {
  const x = Math.max(0, Math.min(width, rect.x * width));
  const y = Math.max(0, Math.min(height, rect.y * height));
  const w = Math.max(0, Math.min(width - x, rect.w * width));
  const h = Math.max(0, Math.min(height - y, rect.h * height));
  return { x, y, w, h };
}

export function cropPdfPageImage(
  image: HTMLImageElement,
  rect: NormalizedRect,
  page: number,
): ReaderImageSelection {
  const naturalWidth = image.naturalWidth;
  const naturalHeight = image.naturalHeight;
  if (naturalWidth <= 0 || naturalHeight <= 0) {
    throw new Error("当前 PDF 页面图像尚未加载完成，请稍后再框选。");
  }

  const source = cropBounds(rect, naturalWidth, naturalHeight);
  if (source.w < MIN_CROP_PIXELS || source.h < MIN_CROP_PIXELS) {
    throw new Error("框选区域太小，请重新拖出更大的区域。");
  }

  const outputScale = Math.min(1, MAX_CROP_SIDE / Math.max(source.w, source.h));
  const outputWidth = Math.max(1, Math.round(source.w * outputScale));
  const outputHeight = Math.max(1, Math.round(source.h * outputScale));
  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("无法创建图像裁剪画布。");

  ctx.drawImage(image, source.x, source.y, source.w, source.h, 0, 0, outputWidth, outputHeight);
  const dataUrl = canvas.toDataURL(OUTPUT_MEDIA_TYPE);
  const data = dataUrl.slice(dataUrl.indexOf(",") + 1);

  return {
    page,
    rect,
    data,
    mediaType: OUTPUT_MEDIA_TYPE,
    width: outputWidth,
    height: outputHeight,
  };
}
