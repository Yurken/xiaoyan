import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useResearchWorkflow } from '../useResearchWorkflow'

// Mock backend module
vi.mock('../../services/backend', () => ({
  onChunk: vi.fn(() => vi.fn()),
  subscribeSession: vi.fn(),
  runWorkflow: vi.fn(),
  cancelWorkflow: vi.fn(),
}))

describe('useResearchWorkflow', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useResearchWorkflow())

    expect(result.current.isRunning).toBe(false)
    expect(result.current.overallProgress).toBe(0)
    expect(result.current.currentStage).toBe('等待开始')
    expect(result.current.workflowSteps).toEqual([])
    expect(result.current.processLog).toEqual([])
  })

  it('should add log entries', () => {
    const { result } = renderHook(() => useResearchWorkflow())

    act(() => {
      result.current.log('Test message')
    })

    expect(result.current.processLog).toHaveLength(1)
    expect(result.current.processLog[0].text).toBe('Test message')
    expect(result.current.processLog[0].level).toBe('info')
  })

  it('should add log entries with specified level', () => {
    const { result } = renderHook(() => useResearchWorkflow())

    act(() => {
      result.current.log('Error message', 'error')
    })

    expect(result.current.processLog[0].level).toBe('error')
  })

  it('should limit process log to 100 entries', () => {
    const { result } = renderHook(() => useResearchWorkflow())

    act(() => {
      for (let i = 0; i < 150; i++) {
        result.current.log(`Message ${i}`)
      }
    })

    expect(result.current.processLog).toHaveLength(100)
    // Most recent should be first
    expect(result.current.processLog[0].text).toBe('Message 149')
  })

  it('should cleanup on unmount', () => {
    const { unmount } = renderHook(() => useResearchWorkflow())

    // Should not throw on unmount
    unmount()
  })
})
