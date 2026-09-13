import { act, renderHook, waitFor } from '@testing-library/react'
import { listen } from '@tauri-apps/api/event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getInvokeMock, resetInvokeMock } from '../../../__tests__/mocks/tauri'
import { useAssistantTerminologyPreferences } from '../hooks/useAssistantTerminologyPreferences'

describe('useAssistantTerminologyPreferences', () => {
  beforeEach(() => {
    resetInvokeMock()
    vi.mocked(listen).mockReset()
    vi.mocked(listen).mockResolvedValue(vi.fn())
  })

  it('loads, saves and removes a stable terminology preference', async () => {
    getInvokeMock().mockImplementation(async (command: string, args?: unknown) => {
      if (command === 'assistant_list_terminology_preferences') return []
      if (command === 'assistant_save_terminology_preference') {
        expect(args).toEqual({
          sourceTerm: 'agent',
          preferredTranslation: '智能体',
          targetLanguage: 'zh',
        })
        return [{
          source_term: 'agent',
          preferred_translation: '智能体',
          target_language: 'zh',
          updated_at: '2026-07-29T00:00:00Z',
        }]
      }
      if (command === 'assistant_delete_terminology_preference') {
        expect(args).toEqual({ sourceTerm: 'agent', targetLanguage: 'zh' })
        return []
      }
      throw new Error(`Unmocked invoke: ${command}`)
    })

    const { result } = renderHook(() => useAssistantTerminologyPreferences())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      expect(await result.current.save('agent', '智能体', 'zh')).toBe(true)
    })
    expect(result.current.preferences[0]?.preferred_translation).toBe('智能体')

    await act(async () => {
      expect(await result.current.remove('agent', 'zh')).toBe(true)
    })
    expect(result.current.preferences).toEqual([])
  })
})
