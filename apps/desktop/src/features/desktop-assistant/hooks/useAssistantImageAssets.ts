import { invoke } from '@tauri-apps/api/core'
import { useCallback, useEffect, useState } from 'react'
import type {
  AssistantImageAsset,
  AssistantSourceMetadata,
  AssistantSourceMetadataDraft,
} from '../shared'

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

export function useAssistantImageAssets() {
  const [assets, setAssets] = useState<AssistantImageAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [activeAssetId, setActiveAssetId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await invoke<AssistantImageAsset[]>('assistant_list_image_assets')
      setAssets(Array.isArray(result) ? result : [])
    } catch (loadError) {
      setError(errorMessage(loadError))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const saveSource = useCallback(async (
    assetId: string,
    draft: AssistantSourceMetadataDraft,
  ) => {
    setActiveAssetId(assetId)
    setError(null)
    setNotice(null)
    try {
      const source = await invoke<AssistantSourceMetadata>(
        'assistant_update_source_metadata',
        {
          target: 'image',
          targetId: assetId,
          sourceApp: draft.sourceApp.trim() || null,
          windowTitle: draft.windowTitle.trim() || null,
          sourceTitle: draft.sourceTitle.trim() || null,
          sourceUrl: draft.sourceUrl.trim() || null,
        },
      )
      setAssets((current) => current.map((asset) => asset.id === assetId ? {
        ...asset,
        source_app: source.source_app,
        window_title: source.window_title,
        source_title: source.source_title,
        source_url: source.source_url,
      } : asset))
      setNotice('图片来源已更新')
      return true
    } catch (saveError) {
      setError(errorMessage(saveError))
      return false
    } finally {
      setActiveAssetId(null)
    }
  }, [])

  const deleteAsset = useCallback(async (assetId: string) => {
    setActiveAssetId(assetId)
    setError(null)
    setNotice(null)
    try {
      await invoke('assistant_delete_image_asset', { assetId })
      setAssets((current) => current.filter((asset) => asset.id !== assetId))
      setNotice('图片资产及其来源记录已删除')
      return true
    } catch (deleteError) {
      setError(errorMessage(deleteError))
      return false
    } finally {
      setActiveAssetId(null)
    }
  }, [])

  return {
    assets,
    loading,
    activeAssetId,
    error,
    notice,
    reload,
    saveSource,
    deleteAsset,
  }
}

export type UseAssistantImageAssets = ReturnType<typeof useAssistantImageAssets>
