import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { getInvokeMock, resetInvokeMock } from '../../../__tests__/mocks/tauri'
import { useAssistantSourceMetadata } from '../hooks/useAssistantSourceMetadata'

const metadata = {
  import_id: 'import-1',
  target: 'note' as const,
  target_id: 'note-1',
  source_type: 'screenshot',
  source_app: 'Preview',
  source_app_bundle_id: 'com.apple.Preview',
  window_title: 'Figure 2',
  source_title: null,
  source_url: null,
  captured_at: '2026-07-30T10:00:00Z',
  capture_region: { x: null, y: null, width: 1280, height: 720 },
  attachments: [],
}

describe('useAssistantSourceMetadata', () => {
  beforeEach(() => resetInvokeMock())

  it('loads and updates durable provenance without changing immutable capture fields', async () => {
    getInvokeMock().mockImplementation(async (command: string) => {
      if (command === 'assistant_get_source_metadata') return metadata
      return { ...metadata, source_title: '实验结果图', source_url: 'https://example.com/paper' }
    })
    const { result } = renderHook(() => useAssistantSourceMetadata('note', 'note-1', true))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.metadata?.capture_region?.width).toBe(1280)

    await act(async () => {
      expect(await result.current.save({
        sourceApp: 'Preview',
        windowTitle: 'Figure 2',
        sourceTitle: ' 实验结果图 ',
        sourceUrl: ' https://example.com/paper ',
      })).toBe(true)
    })
    expect(getInvokeMock()).toHaveBeenCalledWith('assistant_update_source_metadata', {
      target: 'note',
      targetId: 'note-1',
      sourceApp: 'Preview',
      windowTitle: 'Figure 2',
      sourceTitle: '实验结果图',
      sourceUrl: 'https://example.com/paper',
    })
  })

  it('does not invoke the backend for manual or missing targets', async () => {
    const { result } = renderHook(() => useAssistantSourceMetadata('note', undefined, false))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(getInvokeMock()).not.toHaveBeenCalled()
  })
})
