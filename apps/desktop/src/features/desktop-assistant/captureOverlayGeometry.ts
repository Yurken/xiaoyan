/**
 * 截图选区层的纯几何模型。
 *
 * 坐标约定：全局逻辑坐标以主屏左上角为原点、y 轴向下；外屏位于主屏
 * 左侧或上方时原点为负。像素坐标以每台显示器自身的缩放比例换算。
 */

export interface CaptureOverlayDisplay {
  x: number
  y: number
  width: number
  height: number
  scaleFactor: number
}

export interface CaptureLogicalRect {
  x: number
  y: number
  width: number
  height: number
}

export interface CapturePixelRect {
  x: number
  y: number
  width: number
  height: number
}

export interface CaptureDisplayCrop {
  display: CaptureOverlayDisplay
  logical: CaptureLogicalRect
  pixel: CapturePixelRect
}

export const CAPTURE_OVERLAY_MIN_LOGICAL_SIZE = 4

export function normalizeDragRect(
  startX: number,
  startY: number,
  currentX: number,
  currentY: number,
): CaptureLogicalRect {
  return {
    x: Math.min(startX, currentX),
    y: Math.min(startY, currentY),
    width: Math.abs(currentX - startX),
    height: Math.abs(currentY - startY),
  }
}

export function localRectToGlobal(
  rect: CaptureLogicalRect,
  display: CaptureOverlayDisplay,
): CaptureLogicalRect {
  return {
    x: rect.x + display.x,
    y: rect.y + display.y,
    width: rect.width,
    height: rect.height,
  }
}

export function globalRectToLocal(
  rect: CaptureLogicalRect,
  display: CaptureOverlayDisplay,
): CaptureLogicalRect {
  return {
    x: rect.x - display.x,
    y: rect.y - display.y,
    width: rect.width,
    height: rect.height,
  }
}

export function intersectLogicalRects(
  a: CaptureLogicalRect,
  b: CaptureLogicalRect,
): CaptureLogicalRect | null {
  const x = Math.max(a.x, b.x)
  const y = Math.max(a.y, b.y)
  const right = Math.min(a.x + a.width, b.x + b.width)
  const bottom = Math.min(a.y + a.height, b.y + b.height)
  if (right <= x || bottom <= y) return null
  return { x, y, width: right - x, height: bottom - y }
}

export function displayLogicalBounds(
  display: CaptureOverlayDisplay,
): CaptureLogicalRect {
  return {
    x: display.x,
    y: display.y,
    width: display.width,
    height: display.height,
  }
}

export function logicalRectToDisplayPixels(
  rect: CaptureLogicalRect,
  display: CaptureOverlayDisplay,
): CapturePixelRect {
  return {
    x: Math.round((rect.x - display.x) * display.scaleFactor),
    y: Math.round((rect.y - display.y) * display.scaleFactor),
    width: Math.round(rect.width * display.scaleFactor),
    height: Math.round(rect.height * display.scaleFactor),
  }
}

export function pixelSizeForLogicalRect(
  rect: CaptureLogicalRect,
  scaleFactor: number,
): { width: number; height: number } {
  return {
    width: Math.round(rect.width * scaleFactor),
    height: Math.round(rect.height * scaleFactor),
  }
}

export function clipRectAcrossDisplays(
  rect: CaptureLogicalRect,
  displays: CaptureOverlayDisplay[],
): CaptureDisplayCrop[] {
  const crops: CaptureDisplayCrop[] = []
  for (const display of displays) {
    const logical = intersectLogicalRects(rect, displayLogicalBounds(display))
    if (!logical) continue
    crops.push({
      display,
      logical,
      pixel: logicalRectToDisplayPixels(logical, display),
    })
  }
  return crops
}

export function displaysBoundingBox(
  displays: CaptureOverlayDisplay[],
): CaptureLogicalRect | null {
  if (displays.length === 0) return null
  let left = Infinity
  let top = Infinity
  let right = -Infinity
  let bottom = -Infinity
  for (const display of displays) {
    left = Math.min(left, display.x)
    top = Math.min(top, display.y)
    right = Math.max(right, display.x + display.width)
    bottom = Math.max(bottom, display.y + display.height)
  }
  return { x: left, y: top, width: right - left, height: bottom - top }
}

export function clampRectToDisplays(
  rect: CaptureLogicalRect,
  displays: CaptureOverlayDisplay[],
): CaptureLogicalRect | null {
  const bounds = displaysBoundingBox(displays)
  return bounds ? intersectLogicalRects(rect, bounds) : null
}

export function isCaptureSelectionLargeEnough(rect: CaptureLogicalRect): boolean {
  return (
    rect.width >= CAPTURE_OVERLAY_MIN_LOGICAL_SIZE
    && rect.height >= CAPTURE_OVERLAY_MIN_LOGICAL_SIZE
  )
}
