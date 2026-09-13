import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useResearchSession } from '../useResearchSession'

// Mock backend module
const mockGetHealth = vi.fn()
const mockListSessions = vi.fn()
const mockGetSession = vi.fn()
const mockCreateSession = vi.fn()
const mockDeleteSession = vi.fn()
const mockUploadFile = vi.fn()
const mockGetCandidates = vi.fn()

vi.mock('../../services/backend', () => ({
  getHealth: (...args: unknown[]) => mockGetHealth(...args),
  listSessions: (...args: unknown[]) => mockListSessions(...args),
  getSession: (...args: unknown[]) => mockGetSession(...args),
  createSession: (...args: unknown[]) => mockCreateSession(...args),
  deleteSession: (...args: unknown[]) => mockDeleteSession(...args),
  uploadFile: (...args: unknown[]) => mockUploadFile(...args),
  getCandidates: (...args: unknown[]) => mockGetCandidates(...args),
}))

describe('useResearchSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetHealth.mockResolvedValue({ llm_ready: true })
    mockListSessions.mockResolvedValue([])
  })

  it('should initialize with default state', async () => {
    const { result } = renderHook(() => useResearchSession())

    expect(result.current.sessionId).toBeNull()
    expect(result.current.sessionStatus).toBe('idle')
    expect(result.current.sessionList).toEqual([])
    expect(result.current.llmReady).toBeNull()
  })

  it('should load session list on mount', async () => {
    const mockSessions = [
      { id: '1', question: { title: 'Test' }, status: 'idle', created_at: '2024-01-01' },
    ]
    mockListSessions.mockResolvedValue(mockSessions)

    const { result } = renderHook(() => useResearchSession())

    // Wait for async initialization
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
    })

    expect(mockListSessions).toHaveBeenCalled()
    expect(result.current.sessionList).toHaveLength(1)
    expect(result.current.sessionList[0].title).toBe('Test')
  })

  it('should expose an unavailable backend without making follow-up requests', async () => {
    mockGetHealth.mockRejectedValue(new Error('Failed to fetch'))

    const { result } = renderHook(() => useResearchSession())

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
    })

    expect(result.current.backendStatus).toBe('unavailable')
    expect(result.current.backendError).toBe('Failed to fetch')
    expect(result.current.llmReady).toBe(false)
    expect(mockListSessions).not.toHaveBeenCalled()
  })

  it('should handle selectSession with race condition', async () => {
    const session1 = { id: '1', question: { title: 'Session 1' }, status: 'idle', protocol: null, candidate_sets: [], candidate_decisions: [], experiment_protocols: [], papers: [], evidence_claims: [], workflow_steps: [], agent_runs: [], audit_events: [] }
    const session2 = { id: '2', question: { title: 'Session 2' }, status: 'idle', protocol: null, candidate_sets: [], candidate_decisions: [], experiment_protocols: [], papers: [], evidence_claims: [], workflow_steps: [], agent_runs: [], audit_events: [] }

    mockGetSession.mockImplementation(async (id: string) => {
      // Simulate slow first request
      if (id === '1') {
        await new Promise((resolve) => setTimeout(resolve, 100))
        return session1
      }
      // Fast second request
      return session2
    })

    const { result } = renderHook(() => useResearchSession())

    // Fire both requests quickly
    await act(async () => {
      const p1 = result.current.selectSession('1')
      const p2 = result.current.selectSession('2')
      await Promise.all([p1, p2])
    })

    // Should have the second session due to race condition handling
    expect(result.current.sessionId).toBe('2')
    expect(result.current.questionTitle).toBe('Session 2')
  })

  it('should leave session and clear state', async () => {
    mockGetSession.mockResolvedValue({
      id: '1',
      question: { title: 'Test' },
      status: 'idle',
      protocol: null,
      candidate_sets: [],
      candidate_decisions: [],
      experiment_protocols: [],
      papers: [],
      evidence_claims: [],
      workflow_steps: [],
      agent_runs: [],
      audit_events: [],
    })

    const { result } = renderHook(() => useResearchSession())

    await act(async () => {
      await result.current.selectSession('1')
    })

    expect(result.current.sessionId).toBe('1')

    act(() => {
      result.current.leaveSession()
    })

    expect(result.current.sessionId).toBeNull()
    expect(result.current.sessionStatus).toBe('idle')
  })

  it('rolls back a new session when an attachment upload fails', async () => {
    mockCreateSession.mockResolvedValue({
      id: 'new-session',
      question: { title: 'New research' },
      status: 'idle',
      protocol: null,
      candidate_sets: [],
      candidate_decisions: [],
      experiment_protocols: [],
      papers: [],
      evidence_claims: [],
    })
    mockUploadFile.mockRejectedValue(new Error('upload unavailable'))
    mockDeleteSession.mockResolvedValue(undefined)
    const file = new File(['paper'], 'paper.txt', { type: 'text/plain' })
    const { result } = renderHook(() => useResearchSession())

    await act(async () => {
      await expect(
        result.current.createResearch(
          {
            title: 'New research',
            field: '',
            subfield: '',
            description: '',
            depth: 'standard',
            iterations: 3,
            language: 'zh',
          },
          [file]
        )
      ).rejects.toThrow('附件「paper.txt」上传失败：upload unavailable')
    })

    expect(mockDeleteSession).toHaveBeenCalledWith('new-session')
    expect(result.current.sessionId).toBeNull()
  })

  it('propagates deletion failures to the caller', async () => {
    mockDeleteSession.mockRejectedValue(new Error('delete unavailable'))
    const { result } = renderHook(() => useResearchSession())

    await act(async () => {
      await expect(result.current.deleteResearch('session-1')).rejects.toThrow('delete unavailable')
    })

    expect(mockListSessions).toHaveBeenCalledTimes(1)
  })
})
