import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { getInvokeMock, resetInvokeMock } from '../../../__tests__/mocks/tauri'
import { useAssistantImageAssets } from '../hooks/useAssistantImageAssets'

const asset = {
  id: 'asset-1',
  media_type: 'image/png',
  size_bytes: 2048,
  available: true,
  created_at: '2026-07-30 10:00:00',
  source_type: 'screenshot',
  source_app: 'Preview',
  source_app_bundle_id: 'com.apple.Preview',
  window_title: 'Figure 2',
  source_title: null,
  source_url: null,
  captured_at: '2026-07-30T10:00:00Z',
  capture_region: { x: null, y: null, width: 1280, height: 720 },
}

describe('useAssistantImageAssets', () => {
  beforeEach(() => {
    resetInvokeMock()
    getInvokeMock().mockImplementation(async (command: string) => {
      if (command === 'assistant_list_image_assets') return [asset]
      if (command === 'assistant_update_source_metadata') {
        return {
          import_id: 'import-1', target: 'image', target_id: 'asset-1',
          source_type: 'screenshot', source_app: 'Preview', source_app_bundle_id: null,
          window_title: 'Figure 2', source_title: '结果图', source_url: 'https://example.com',
          captured_at: null, capture_region: null, attachments: [],
        }
      }
      return null
    })
  })

  it('loads assets and updates editable source fields through the shared provenance command', async () => {
    const { result } = renderHook(() => useAssistantImageAssets())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.assets).toHaveLength(1)

    await act(async () => {
      expect(await result.current.saveSource('asset-1', {
        sourceApp: ' Preview ',
        windowTitle: ' Figure 2 ',
        sourceTitle: ' 结果图 ',
        sourceUrl: ' https://example.com ',
      })).toBe(true)
    })
    expect(getInvokeMock()).toHaveBeenCalledWith('assistant_update_source_metadata', {
      target: 'image',
      targetId: 'asset-1',
      sourceApp: 'Preview',
      windowTitle: 'Figure 2',
      sourceTitle: '结果图',
      sourceUrl: 'https://example.com',
    })
    expect(result.current.assets[0].source_title).toBe('结果图')
  })

  it('removes an asset only after the backend confirms deletion', async () => {
    const { result } = renderHook(() => useAssistantImageAssets())
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => {
      expect(await result.current.deleteAsset('asset-1')).toBe(true)
    })
    expect(getInvokeMock()).toHaveBeenCalledWith('assistant_delete_image_asset', {
      assetId: 'asset-1',
    })
    expect(result.current.assets).toEqual([])
  })
})
