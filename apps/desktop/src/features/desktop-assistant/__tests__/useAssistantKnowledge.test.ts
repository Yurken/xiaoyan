import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { getInvokeMock, resetInvokeMock } from '../../../__tests__/mocks/tauri'
import { useAssistantKnowledge } from '../hooks/useAssistantKnowledge'

describe('useAssistantKnowledge', () => {
  beforeEach(() => {
    resetInvokeMock()
  })

  it('loads themes, selects the first one and stays opt-in', async () => {
    getInvokeMock().mockResolvedValue([
      { id: 'theme-1', name: 'Graph RAG', asset_count: 3 },
      { id: 'theme-2', name: 'Agents', asset_count: 1 },
    ])
    const { result } = renderHook(() => useAssistantKnowledge())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.selectedThemeId).toBe('theme-1')
    expect(result.current.enabled).toBe(false)

    act(() => result.current.setKnowledgeEnabled(true))
    expect(result.current.enabled).toBe(true)
    act(() => result.current.selectTheme('theme-2'))
    expect(result.current.selectedThemeId).toBe('theme-2')
  })

  it('does not enable retrieval when there are no local themes', async () => {
    getInvokeMock().mockResolvedValue([])
    const { result } = renderHook(() => useAssistantKnowledge())
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => result.current.setKnowledgeEnabled(true))

    expect(result.current.enabled).toBe(false)
    expect(result.current.error).toContain('请先创建研究主题')
  })
})
