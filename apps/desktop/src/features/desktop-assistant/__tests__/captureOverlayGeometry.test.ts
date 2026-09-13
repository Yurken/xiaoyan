import { describe, expect, it } from 'vitest'
import {
  CAPTURE_OVERLAY_MIN_LOGICAL_SIZE,
  clampRectToDisplays,
  clipRectAcrossDisplays,
  displayLogicalBounds,
  displaysBoundingBox,
  globalRectToLocal,
  intersectLogicalRects,
  isCaptureSelectionLargeEnough,
  localRectToGlobal,
  logicalRectToDisplayPixels,
  normalizeDragRect,
  pixelSizeForLogicalRect,
  type CaptureOverlayDisplay,
} from '../shared'

/** 内屏：Retina，缩放 2，逻辑 1440×900 */
const retinaMain: CaptureOverlayDisplay = {
  x: 0,
  y: 0,
  width: 1440,
  height: 900,
  scaleFactor: 2,
}

/** 外屏：非 Retina，位于内屏左侧（x 为负） */
const leftExternal: CaptureOverlayDisplay = {
  x: -1280,
  y: 0,
  width: 1280,
  height: 1024,
  scaleFactor: 1,
}

/** 外屏：位于内屏上方（y 为负），缩放 1.5 */
const topExternal: CaptureOverlayDisplay = {
  x: 0,
  y: -720,
  width: 1920,
  height: 720,
  scaleFactor: 1.5,
}

describe('capture overlay geometry', () => {
  describe('normalizeDragRect', () => {
    it('keeps forward drags as-is', () => {
      expect(normalizeDragRect(10, 20, 110, 120)).toEqual({
        x: 10,
        y: 20,
        width: 100,
        height: 100,
      })
    })

    it('normalizes reverse drags to positive size', () => {
      expect(normalizeDragRect(110, 120, 10, 20)).toEqual({
        x: 10,
        y: 20,
        width: 100,
        height: 100,
      })
    })
  })

  describe('local/global coordinate conversion', () => {
    it('adds the display origin when the display sits at (0, 0)', () => {
      expect(
        localRectToGlobal({ x: 100, y: 50, width: 200, height: 100 }, retinaMain),
      ).toEqual({ x: 100, y: 50, width: 200, height: 100 })
    })

    it('produces negative global coordinates on a display left of the main screen', () => {
      expect(
        localRectToGlobal({ x: 100, y: 50, width: 200, height: 100 }, leftExternal),
      ).toEqual({ x: -1180, y: 50, width: 200, height: 100 })
    })

    it('produces negative global coordinates on a display above the main screen', () => {
      expect(
        localRectToGlobal({ x: 300, y: 100, width: 200, height: 100 }, topExternal),
      ).toEqual({ x: 300, y: -620, width: 200, height: 100 })
    })

    it('round-trips between local and global coordinates', () => {
      const local = { x: 40, y: 60, width: 320, height: 180 }
      const global = localRectToGlobal(local, leftExternal)
      expect(globalRectToLocal(global, leftExternal)).toEqual(local)
    })
  })

  describe('logicalRectToDisplayPixels', () => {
    it('doubles coordinates on Retina (scale 2)', () => {
      expect(
        logicalRectToDisplayPixels({ x: 10, y: 20, width: 100, height: 50 }, retinaMain),
      ).toEqual({ x: 20, y: 40, width: 200, height: 100 })
    })

    it('keeps coordinates on non-Retina (scale 1)', () => {
      expect(
        logicalRectToDisplayPixels(
          { x: -1100, y: 20, width: 100, height: 50 },
          leftExternal,
        ),
      ).toEqual({ x: 180, y: 20, width: 100, height: 50 })
    })

    it('applies fractional scale factors and rounds to whole pixels', () => {
      expect(
        logicalRectToDisplayPixels({ x: 1, y: -719, width: 101, height: 51 }, topExternal),
      ).toEqual({ x: 2, y: 2, width: 152, height: 77 })
    })
  })

  describe('intersectLogicalRects', () => {
    it('returns the overlap of two rects', () => {
      expect(
        intersectLogicalRects(
          { x: 0, y: 0, width: 100, height: 100 },
          { x: 50, y: 50, width: 100, height: 100 },
        ),
      ).toEqual({ x: 50, y: 50, width: 50, height: 50 })
    })

    it('returns null for disjoint rects', () => {
      expect(
        intersectLogicalRects(
          { x: 0, y: 0, width: 10, height: 10 },
          { x: 20, y: 20, width: 10, height: 10 },
        ),
      ).toBeNull()
    })

    it('returns null for edge-touching rects (zero-area overlap)', () => {
      expect(
        intersectLogicalRects(
          { x: 0, y: 0, width: 10, height: 10 },
          { x: 10, y: 0, width: 10, height: 10 },
        ),
      ).toBeNull()
    })
  })

  describe('clipRectAcrossDisplays', () => {
    it('splits a selection spanning two displays with different scales', () => {
      // 选区从左侧外屏（-100）跨到内屏（+200），共 300 逻辑点宽。
      const selection = { x: -100, y: 100, width: 300, height: 200 }
      const crops = clipRectAcrossDisplays(selection, [leftExternal, retinaMain])

      expect(crops).toHaveLength(2)

      // 左侧外屏部分：逻辑 100 宽，scale 1 → 像素与逻辑一致，相对外屏图像原点。
      expect(crops[0].display).toBe(leftExternal)
      expect(crops[0].logical).toEqual({ x: -100, y: 100, width: 100, height: 200 })
      expect(crops[0].pixel).toEqual({ x: 1180, y: 100, width: 100, height: 200 })

      // 内屏部分：逻辑 200 宽，scale 2 → 像素翻倍。
      expect(crops[1].display).toBe(retinaMain)
      expect(crops[1].logical).toEqual({ x: 0, y: 100, width: 200, height: 200 })
      expect(crops[1].pixel).toEqual({ x: 0, y: 200, width: 400, height: 400 })
    })

    it('clips a selection reaching into the display above the main screen', () => {
      const selection = { x: 100, y: -100, width: 200, height: 300 }
      const crops = clipRectAcrossDisplays(selection, [topExternal, retinaMain])

      expect(crops).toHaveLength(2)
      // 上方外屏部分（scale 1.5）。
      expect(crops[0].logical).toEqual({ x: 100, y: -100, width: 200, height: 100 })
      expect(crops[0].pixel).toEqual({ x: 150, y: 930, width: 300, height: 150 })
      // 内屏部分（scale 2）。
      expect(crops[1].logical).toEqual({ x: 100, y: 0, width: 200, height: 200 })
      expect(crops[1].pixel).toEqual({ x: 200, y: 0, width: 400, height: 400 })
    })

    it('ignores displays the selection does not touch', () => {
      const selection = { x: 10, y: 10, width: 100, height: 100 }
      const crops = clipRectAcrossDisplays(selection, [
        leftExternal,
        retinaMain,
        topExternal,
      ])
      expect(crops).toHaveLength(1)
      expect(crops[0].display).toBe(retinaMain)
    })
  })

  describe('displaysBoundingBox / clampRectToDisplays', () => {
    it('builds a bounding box covering negative origins', () => {
      expect(displaysBoundingBox([leftExternal, retinaMain, topExternal])).toEqual({
        x: -1280,
        y: -720,
        width: 3200,
        height: 1744,
      })
      expect(displaysBoundingBox([])).toBeNull()
    })

    it('clamps a selection to the virtual screen bounds', () => {
      const clamped = clampRectToDisplays(
        { x: -1300, y: 800, width: 200, height: 300 },
        [leftExternal, retinaMain],
      )
      expect(clamped).toEqual({ x: -1280, y: 800, width: 180, height: 224 })
    })

    it('returns null when the selection lies fully outside all displays', () => {
      expect(
        clampRectToDisplays({ x: 5000, y: 5000, width: 100, height: 100 }, [retinaMain]),
      ).toBeNull()
    })
  })

  describe('displayLogicalBounds / pixelSizeForLogicalRect', () => {
    it('exposes display bounds in global logical coordinates', () => {
      expect(displayLogicalBounds(leftExternal)).toEqual({
        x: -1280,
        y: 0,
        width: 1280,
        height: 1024,
      })
    })

    it('converts logical size to pixel size for the size hint label', () => {
      expect(pixelSizeForLogicalRect({ x: 0, y: 0, width: 100, height: 50 }, 2)).toEqual({
        width: 200,
        height: 100,
      })
    })
  })

  describe('isCaptureSelectionLargeEnough', () => {
    it('rejects selections below the minimum logical size', () => {
      expect(
        isCaptureSelectionLargeEnough({
          x: 0,
          y: 0,
          width: CAPTURE_OVERLAY_MIN_LOGICAL_SIZE - 1,
          height: 100,
        }),
      ).toBe(false)
    })

    it('accepts selections at or above the minimum logical size', () => {
      expect(
        isCaptureSelectionLargeEnough({
          x: 0,
          y: 0,
          width: CAPTURE_OVERLAY_MIN_LOGICAL_SIZE,
          height: CAPTURE_OVERLAY_MIN_LOGICAL_SIZE,
        }),
      ).toBe(true)
    })
  })
})
