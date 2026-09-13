import { invoke } from '@tauri-apps/api/core'
import { useCallback, useEffect, useState } from 'react'
import { safeListen } from '../../../lib/tauriEvent'
import type {
  AssistantTerminologyPreference,
  AssistantTranslationTargetLanguage,
} from '../shared'

const TERMINOLOGY_CHANGED_EVENT = 'assistant://terminology-preferences-changed'

export function useAssistantTerminologyPreferences() {
  const [preferences, setPreferences] = useState<AssistantTerminologyPreference[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let disposed = false
    let unlisten: (() => void) | undefined
    void Promise.all([
      invoke<AssistantTerminologyPreference[]>('assistant_list_terminology_preferences'),
      safeListen<AssistantTerminologyPreference[]>(TERMINOLOGY_CHANGED_EVENT, (event) => {
        if (!disposed) setPreferences(event.payload)
      }),
    ])
      .then(([loaded, stop]) => {
        if (disposed) {
          stop()
          return
        }
        setPreferences(loaded ?? [])
        unlisten = stop
      })
      .catch((loadError) => {
        if (!disposed) {
          setError(loadError instanceof Error ? loadError.message : String(loadError))
        }
      })
      .finally(() => {
        if (!disposed) setLoading(false)
      })

    return () => {
      disposed = true
      unlisten?.()
    }
  }, [])

  const save = useCallback(async (
    sourceTerm: string,
    preferredTranslation: string,
    targetLanguage: AssistantTranslationTargetLanguage,
  ) => {
    setSaving(true)
    setError(null)
    try {
      const saved = await invoke<AssistantTerminologyPreference[]>(
        'assistant_save_terminology_preference',
        { sourceTerm, preferredTranslation, targetLanguage },
      )
      setPreferences(saved)
      return true
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError))
      return false
    } finally {
      setSaving(false)
    }
  }, [])

  const remove = useCallback(async (
    sourceTerm: string,
    targetLanguage: AssistantTranslationTargetLanguage,
  ) => {
    setSaving(true)
    setError(null)
    try {
      const saved = await invoke<AssistantTerminologyPreference[]>(
        'assistant_delete_terminology_preference',
        { sourceTerm, targetLanguage },
      )
      setPreferences(saved)
      return true
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError))
      return false
    } finally {
      setSaving(false)
    }
  }, [])

  return { preferences, loading, saving, error, save, remove }
}
