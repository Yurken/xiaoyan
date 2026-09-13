import { invoke } from '@tauri-apps/api/core'
import { useCallback, useEffect, useState } from 'react'
import type { AssistantPrivacyPreferences } from '../shared'

const EMPTY_PREFERENCES: AssistantPrivacyPreferences = {
  allowed_apps: [],
  blocked_apps: [],
  window_title_enabled: false,
}

export function useAssistantPrivacyPreferences() {
  const [preferences, setPreferences] =
    useState<AssistantPrivacyPreferences>(EMPTY_PREFERENCES)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setPreferences(
        await invoke<AssistantPrivacyPreferences>('assistant_get_privacy_preferences'),
      )
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const save = useCallback(async (next: AssistantPrivacyPreferences) => {
    setSaving(true)
    setError(null)
    try {
      const saved = await invoke<AssistantPrivacyPreferences>(
        'assistant_set_privacy_preferences',
        {
          allowedApps: next.allowed_apps,
          blockedApps: next.blocked_apps,
          windowTitleEnabled: next.window_title_enabled,
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
    reload: load,
    save,
  }
}
