import { act, renderHook, waitFor } from '@testing-library/react'
import { listen } from '@tauri-apps/api/event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getInvokeMock, resetInvokeMock } from '../../../__tests__/mocks/tauri'
import { useAssistantTranslationPreferences } from '../hooks/useAssistantTranslationPreferences'

describe('useAssistantTranslationPreferences', () => {
  beforeEach(() => {
    resetInvokeMock()
    vi.mocked(listen).mockReset()
    vi.mocked(listen).mockResolvedValue(vi.fn())
  })

  it('loads and persists target language with terminology style', async () => {
    getInvokeMock().mockImplementation(async (command: string, args?: unknown) => {
      if (command === 'assistant_get_translation_preferences') {
        return { target_language: 'zh', terminology_style: 'bilingual' }
      }
      if (command === 'assistant_set_translation_preferences') {
        expect(args).toEqual({
          targetLanguage: 'fr',
          terminologyStyle: 'translated',
        })
        return { target_language: 'fr', terminology_style: 'translated' }
      }
      throw new Error(`Unmocked invoke: ${command}`)
    })

    const { result } = renderHook(() => useAssistantTranslationPreferences())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      expect(await result.current.save({
        target_language: 'fr',
        terminology_style: 'translated',
      })).toBe(true)
    })
    expect(result.current.preferences).toEqual({
      target_language: 'fr',
      terminology_style: 'translated',
    })
  })
})
