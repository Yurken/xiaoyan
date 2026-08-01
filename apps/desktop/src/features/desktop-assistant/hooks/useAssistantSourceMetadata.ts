import { invoke } from '@tauri-apps/api/core'
import { useCallback, useEffect, useState } from 'react'
import type {
  AssistantSourceMetadata,
  AssistantSourceMetadataDraft,
} from '../shared'

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

export function useAssistantSourceMetadata(
  target: 'note' | 'image' | 'paper',
  targetId: string | undefined,
  enabled: boolean,
) {
  const [metadata, setMetadata] = useState<AssistantSourceMetadata | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!enabled || !targetId) {
      setMetadata(null)
      setError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const result = await invoke<AssistantSourceMetadata | null>(
        'assistant_get_source_metadata',
        { target, targetId },
      )
      setMetadata(result)
    } catch (loadError) {
      setError(errorMessage(loadError))
    } finally {
      setLoading(false)
    }
  }, [enabled, target, targetId])

  useEffect(() => {
    void reload()
  }, [reload])

  const save = useCallback(async (draft: AssistantSourceMetadataDraft) => {
    if (!targetId) return false
    setSaving(true)
    setError(null)
    try {
      const result = await invoke<AssistantSourceMetadata>(
        'assistant_update_source_metadata',
        {
          target,
          targetId,
          sourceApp: draft.sourceApp.trim() || null,
          windowTitle: draft.windowTitle.trim() || null,
          sourceTitle: draft.sourceTitle.trim() || null,
          sourceUrl: draft.sourceUrl.trim() || null,
        },
      )
      setMetadata(result)
      return true
    } catch (saveError) {
      setError(errorMessage(saveError))
      return false
    } finally {
      setSaving(false)
    }
  }, [target, targetId])

  return { metadata, loading, saving, error, reload, save }
}

export type UseAssistantSourceMetadata = ReturnType<typeof useAssistantSourceMetadata>
