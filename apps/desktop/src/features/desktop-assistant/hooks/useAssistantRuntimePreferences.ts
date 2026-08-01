import { invoke } from '@tauri-apps/api/core'
import { useCallback, useEffect, useState } from 'react'
import type { AssistantRuntimePreferences } from '../shared'

const DEFAULT_RUNTIME_PREFERENCES: AssistantRuntimePreferences = {
  enabled: true,
  diagnostic_logging_enabled: false,
}

export function useAssistantRuntimePreferences() {
  const [preferences, setPreferences] =
    useState<AssistantRuntimePreferences>(DEFAULT_RUNTIME_PREFERENCES)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setPreferences(
        await invoke<AssistantRuntimePreferences>('assistant_get_runtime_preferences'),
      )
      setError(null)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    let unlisten: (() => void) | undefined
    let disposed = false

    const subscribe = async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event')
        const stop = await listen<AssistantRuntimePreferences>(
          'assistant://runtime-preferences-changed',
          (event) => setPreferences(event.payload),
        )
        if (disposed) stop()
        else unlisten = stop
      } catch {
        // 浏览器和单测环境没有 Tauri 事件总线。
      }
    }

    void subscribe()
    return () => {
      disposed = true
      unlisten?.()
    }
  }, [])

  const save = useCallback(async (next: AssistantRuntimePreferences) => {
    setSaving(true)
    setError(null)
    try {
      setPreferences(
        await invoke<AssistantRuntimePreferences>(
          'assistant_set_runtime_preferences',
          {
            enabled: next.enabled,
            diagnosticLoggingEnabled: next.diagnostic_logging_enabled,
          },
        ),
      )
      return true
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError))
      try {
        setPreferences(
          await invoke<AssistantRuntimePreferences>('assistant_get_runtime_preferences'),
        )
      } catch {
        // 保留最后一次可用状态。
      }
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
