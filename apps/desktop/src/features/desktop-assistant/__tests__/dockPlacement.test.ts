import { describe, expect, it } from 'vitest'
import {
  ASSISTANT_DOCK_DEFAULT_SIZE,
  assistantMonitorForPoint,
  assistantMonitorKey,
  clampFrameToMonitor,
  dockPlacementFromFrame,
  frameFromDockPlacement,
  parseDockPlacement,
  resolveDockFrame,
  serializeDockPlacement,
  type AssistantMonitorInfo,
} from '../shared'

const SIZE = ASSISTANT_DOCK_DEFAULT_SIZE

const primary: AssistantMonitorInfo = {
  name: 'Built-in Retina Display',
  x: 0,
  y: 0,
  width: 2560,
  height: 1440,
  work_x: 0,
  work_y: 48,
  work_width: 2560,
  work_height: 1296,
  scale_factor: 2,
  is_primary: true,
}

const side: AssistantMonitorInfo = {
  name: 'DELL U2720Q',
  x: 2560,
  y: -200,
  width: 1920,
  height: 1080,
  work_x: 2560,
  work_y: -200,
  work_width: 1920,
  work_height: 1080,
  scale_factor: 1,
  is_primary: false,
}

const unnamed: AssistantMonitorInfo = {
  name: null,
  x: 0,
  y: 0,
  width: 1920,
  height: 1080,
  work_x: 0,
  work_y: 0,
  work_width: 1920,
  work_height: 1080,
  scale_factor: 1,
  is_primary: true,
}

describe('assistantMonitorKey', () => {
  it('prefers the system name and falls back to a resolution fingerprint', () => {
    expect(assistantMonitorKey(primary)).toBe('Built-in Retina Display')
    expect(assistantMonitorKey(unnamed)).toBe('1920x1080@1')
    expect(assistantMonitorKey({ ...unnamed, name: '  ' })).toBe('1920x1080@1')
  })
})

describe('assistantMonitorForPoint', () => {
  it('finds the monitor containing the point, including negative coordinates', () => {
    expect(assistantMonitorForPoint({ x: 100, y: 100 }, [primary, side])).toBe(primary)
    expect(assistantMonitorForPoint({ x: 3000, y: -100 }, [primary, side])).toBe(side)
  })

  it('falls back to the primary monitor, then to the first one', () => {
    expect(assistantMonitorForPoint({ x: -5000, y: 5000 }, [side, primary])).toBe(primary)
    expect(assistantMonitorForPoint({ x: -5000, y: 5000 }, [side])).toBe(side)
    expect(assistantMonitorForPoint({ x: 0, y: 0 }, [])).toBeNull()
  })
})

describe('dockPlacementFromFrame', () => {
  it('snaps to the nearest edge and records the offset along it', () => {
    // 主显示器可用区域右下角：距右 16、距下 20 → 右边缘。
    const placement = dockPlacementFromFrame(
      { x: 2560 - SIZE.width - 16, y: 1344 - SIZE.height - 20, ...SIZE },
      primary,
    )
    expect(placement).toEqual({
      monitor_id: 'Built-in Retina Display',
      edge: 'right',
      offset: 1344 - SIZE.height - 20,
    })
  })

  it('snaps to top and bottom edges when they are nearest', () => {
    expect(
      dockPlacementFromFrame({ x: 3000, y: -200, ...SIZE }, side),
    ).toEqual({ monitor_id: 'DELL U2720Q', edge: 'top', offset: 440 })

    expect(
      dockPlacementFromFrame({ x: 3000, y: -200 + 1080 - SIZE.height, ...SIZE }, side),
    ).toEqual({ monitor_id: 'DELL U2720Q', edge: 'bottom', offset: 440 })
  })

  it('snaps to the left edge with a vertical offset', () => {
    expect(
      dockPlacementFromFrame({ x: 0, y: 300, ...SIZE }, primary),
    ).toEqual({ monitor_id: 'Built-in Retina Display', edge: 'left', offset: 300 })
  })
})

describe('frameFromDockPlacement', () => {
  it('round-trips a placement back to the edge-snapped frame', () => {
    // 距右边缘 16px 的位置会吸附为完全贴边，偏移（纵坐标）保持不变
    const frame = { x: 2560 - SIZE.width - 16, y: 700, ...SIZE }
    const placement = dockPlacementFromFrame(frame, primary)
    expect(frameFromDockPlacement(placement, primary, SIZE)).toEqual({
      x: 2560 - SIZE.width,
      y: 700,
      ...SIZE,
    })
  })

  it('clamps the offset when the monitor resolution shrank', () => {
    const placement = {
      monitor_id: assistantMonitorKey(primary),
      edge: 'right' as const,
      offset: 1300,
    }
    const shrunk: AssistantMonitorInfo = { ...primary, height: 800, work_height: 752 }
    expect(frameFromDockPlacement(placement, shrunk, SIZE)).toEqual({
      x: 2560 - SIZE.width,
      y: 48 + 752 - SIZE.height,
      ...SIZE,
    })
  })
})

describe('clampFrameToMonitor', () => {
  it('keeps frames inside the monitor and tolerates windows larger than the screen', () => {
    expect(
      clampFrameToMonitor({ x: -50, y: 2000, ...SIZE }, primary),
    ).toEqual({ x: 0, y: 1344 - SIZE.height, ...SIZE })
    expect(
      clampFrameToMonitor({ x: 500, y: 500, width: 4000, height: 2000 }, primary),
    ).toEqual({ x: 0, y: 48, width: 4000, height: 2000 })
  })
})

describe('resolveDockFrame', () => {
  it('returns the persisted frame when the target monitor still exists', () => {
    const placement = { monitor_id: 'DELL U2720Q', edge: 'left' as const, offset: 100 }
    expect(resolveDockFrame(placement, [primary, side], SIZE)).toEqual({
      x: 2560,
      y: -100,
      ...SIZE,
    })
  })

  it('migrates to the primary monitor when the target monitor is gone', () => {
    const placement = { monitor_id: 'DELL U2720Q', edge: 'left' as const, offset: 100 }
    expect(resolveDockFrame(placement, [primary], SIZE)).toEqual({
      x: 0,
      y: 100,
      ...SIZE,
    })
  })

  it('uses the primary monitor work area and stays above the system Dock', () => {
    expect(resolveDockFrame(null, [side, primary], SIZE)).toEqual({
      x: 2560 - SIZE.width - 16,
      y: 1344 - SIZE.height - 20,
      ...SIZE,
    })
  })

  it('returns null when no monitor is available', () => {
    expect(resolveDockFrame(null, [], SIZE)).toBeNull()
  })
})

describe('parseDockPlacement / serializeDockPlacement', () => {
  it('round-trips a valid placement', () => {
    const placement = { monitor_id: 'DELL U2720Q', edge: 'bottom' as const, offset: 440 }
    expect(parseDockPlacement(JSON.parse(serializeDockPlacement(placement)))).toEqual(placement)
    expect(parseDockPlacement(placement)).toEqual(placement)
  })

  it('rejects malformed payloads', () => {
    expect(parseDockPlacement(null)).toBeNull()
    expect(parseDockPlacement('left')).toBeNull()
    expect(parseDockPlacement({ monitor_id: '', edge: 'left', offset: 0 })).toBeNull()
    expect(parseDockPlacement({ monitor_id: 'm', edge: 'middle', offset: 0 })).toBeNull()
    expect(parseDockPlacement({ monitor_id: 'm', edge: 'left', offset: Number.NaN })).toBeNull()
    expect(parseDockPlacement({ monitor_id: 'm', edge: 'left' })).toBeNull()
  })

  it('rounds fractional offsets', () => {
    expect(
      parseDockPlacement({ monitor_id: 'm', edge: 'top', offset: 12.6 }),
    ).toEqual({ monitor_id: 'm', edge: 'top', offset: 13 })
  })
})
