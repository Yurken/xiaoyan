import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { getInvokeMock, resetInvokeMock } from '../../../__tests__/mocks/tauri'
import { useAssistantInbox } from '../hooks/useAssistantInbox'

const overview = {
  later_items: [{
    id: 'later-1',
    title: '稍后整理',
    content_preview: '研究结论',
    research_theme_id: null,
    research_theme_name: null,
    source_type: 'selection',
    source_app: 'Safari',
    window_title: null,
    retention_policy: '7_days',
    expires_at: null,
    created_at: '2026-07-29 10:00:00',
  }],
  paper_candidates: [],
  file_candidates: [],
}

describe('useAssistantInbox', () => {
  beforeEach(() => {
    resetInvokeMock()
    getInvokeMock().mockImplementation(async (command: string) => {
      if (command === 'assistant_inbox_list') return overview
      if (command === 'assistant_list_knowledge_themes') {
        return [{ id: 'theme-1', name: 'Graph RAG', asset_count: 2 }]
      }
      return { target: 'note', target_id: 'note-1' }
    })
  })

  it('loads all inbox sections and sends theme-aware conversion commands', async () => {
    const { result } = renderHook(() => useAssistantInbox())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.overview.later_items).toHaveLength(1)

    act(() => result.current.setSelectedThemeId('theme-1'))
    await act(async () => {
      await result.current.convertLater('later-1')
    })
    expect(getInvokeMock()).toHaveBeenCalledWith('assistant_inbox_convert_later', {
      itemId: 'later-1',
      researchThemeId: 'theme-1',
    })
    expect(result.current.notice).toBe('已转为知识笔记')
  })

  it('uses distinct discard contracts for later and file candidates', async () => {
    const { result } = renderHook(() => useAssistantInbox())
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => {
      await result.current.discard('later', 'later-1')
      await result.current.discard('file', 'file-1')
    })
    expect(getInvokeMock()).toHaveBeenCalledWith('assistant_inbox_discard_later', {
      itemId: 'later-1',
    })
    expect(getInvokeMock()).toHaveBeenCalledWith('assistant_inbox_discard_file', {
      candidateId: 'file-1',
    })
  })
})
