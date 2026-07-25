import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useResearchCandidates } from '../useResearchCandidates'

// Mock backend module
const mockDecideCandidate = vi.fn()
const mockCreateExperimentDraft = vi.fn()
const mockFreezeExperiment = vi.fn()

vi.mock('../../services/backend', () => ({
  decideCandidate: (...args: unknown[]) => mockDecideCandidate(...args),
  createExperimentDraft: (...args: unknown[]) => mockCreateExperimentDraft(...args),
  freezeExperiment: (...args: unknown[]) => mockFreezeExperiment(...args),
}))

describe('useResearchCandidates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('decide', () => {
    it('should return error if operator is empty', async () => {
      const { result } = renderHook(() => useResearchCandidates())

      const error = await result.current.decide('session-1', 'candidate-1', 'select', '', 'reason')

      expect(error).toBe('请先填写操作者签名')
      expect(mockDecideCandidate).not.toHaveBeenCalled()
    })

    it('should call decideCandidate and return null on success', async () => {
      mockDecideCandidate.mockResolvedValue({ id: 'decision-1' })

      const { result } = renderHook(() => useResearchCandidates())

      const error = await result.current.decide('session-1', 'candidate-1', 'select', 'operator', 'reason')

      expect(error).toBeNull()
      expect(mockDecideCandidate).toHaveBeenCalledWith('session-1', 'candidate-1', 'select', 'operator', 'reason')
    })

    it('should return error message on failure', async () => {
      mockDecideCandidate.mockRejectedValue(new Error('API error'))

      const { result } = renderHook(() => useResearchCandidates())

      const error = await result.current.decide('session-1', 'candidate-1', 'select', 'operator', 'reason')

      expect(error).toBe('API error')
    })
  })

  describe('openExperiment', () => {
    it('should return null if operator is empty', async () => {
      const { result } = renderHook(() => useResearchCandidates())

      const protocol = await result.current.openExperiment('session-1', 'candidate-1', '', 'design')

      expect(protocol).toBeNull()
      expect(mockCreateExperimentDraft).not.toHaveBeenCalled()
    })

    it('should call createExperimentDraft and return protocol on success', async () => {
      const mockProtocol = { id: 'exp-1', title: 'Test', design: 'design', status: 'draft' }
      mockCreateExperimentDraft.mockResolvedValue(mockProtocol)

      const { result } = renderHook(() => useResearchCandidates())

      const protocol = await result.current.openExperiment('session-1', 'candidate-1', 'operator', 'design')

      expect(protocol).toEqual(mockProtocol)
      expect(mockCreateExperimentDraft).toHaveBeenCalledWith('session-1', 'candidate-1', 'operator', '', 'design')
    })

    it('should return null on failure', async () => {
      mockCreateExperimentDraft.mockRejectedValue(new Error('API error'))

      const { result } = renderHook(() => useResearchCandidates())

      const protocol = await result.current.openExperiment('session-1', 'candidate-1', 'operator', 'design')

      expect(protocol).toBeNull()
    })
  })

  describe('freeze', () => {
    it('should return null if operator is empty', async () => {
      const { result } = renderHook(() => useResearchCandidates())

      const protocol = await result.current.freeze('session-1', 'exp-1', '')

      expect(protocol).toBeNull()
      expect(mockFreezeExperiment).not.toHaveBeenCalled()
    })

    it('should call freezeExperiment and return protocol on success', async () => {
      const mockProtocol = { id: 'exp-1', title: 'Test', design: 'design', status: 'frozen' }
      mockFreezeExperiment.mockResolvedValue(mockProtocol)

      const { result } = renderHook(() => useResearchCandidates())

      const protocol = await result.current.freeze('session-1', 'exp-1', 'operator')

      expect(protocol).toEqual(mockProtocol)
      expect(mockFreezeExperiment).toHaveBeenCalledWith('session-1', 'exp-1', 'operator')
    })

    it('should return null on failure', async () => {
      mockFreezeExperiment.mockRejectedValue(new Error('API error'))

      const { result } = renderHook(() => useResearchCandidates())

      const protocol = await result.current.freeze('session-1', 'exp-1', 'operator')

      expect(protocol).toBeNull()
    })
  })
})
