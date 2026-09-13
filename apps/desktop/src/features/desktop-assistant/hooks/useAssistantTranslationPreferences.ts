import { invoke } from '@tauri-apps/api/core'
import { useCallback, useEffect, useState } from 'react'
import { safeListen } from '../../../lib/tauriEvent'
import type { AssistantTranslationPreferences } from '../shared'

const DEFAULT_TRANSLATION_PREFERENCES: AssistantTranslationPreferences = {
  target_language: 'zh',
  terminology_style: 'bilingual',
}

export function useAssistantTranslationPreferences() {
  const [preferences, setPreferences] = useState<AssistantTranslationPreferences>(
    DEFAULT_TRANSLATION_PREFERENCES,
  )
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let disposed = false
    let unlisten: (() => void) | undefined
    void Promise.all([
      invoke<AssistantTranslationPreferences>(
        'assistant_get_translation_preferences',
      ),
      safeListen<AssistantTranslationPreferences>(
        'assistant://translation-preferences-changed',
        (event) => {
          if (!disposed) setPreferences(event.payload)
        },
      ),
    ])
      .then(([loaded, stop]) => {
        if (disposed) {
          stop()
          return
        }
        setPreferences(loaded)
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

  const save = useCallback(async (next: AssistantTranslationPreferences) => {
    setSaving(true)
    setError(null)
    try {
      const saved = await invoke<AssistantTranslationPreferences>(
        'assistant_set_translation_preferences',
        {
          targetLanguage: next.target_language,
          terminologyStyle: next.terminology_style,
        },
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

  return {
    preferences,
    loading,
    saving,
    error,
    save,
  }
}
