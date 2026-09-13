import { invoke } from '@tauri-apps/api/core'
import { useCallback, useEffect, useState } from 'react'
import type { AssistantOnboardingState } from '../shared'

const INITIAL_STATE: AssistantOnboardingState = {
  permission_guide_completed: false,
}

export function useAssistantOnboarding() {
  const [onboarding, setOnboarding] = useState(INITIAL_STATE)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setOnboarding(await invoke<AssistantOnboardingState>('assistant_get_onboarding'))
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
        const stop = await listen<AssistantOnboardingState>(
          'assistant://onboarding-changed',
          (event) => setOnboarding(event.payload),
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

  const completePermissionGuide = useCallback(async () => {
    setSaving(true)
    setError(null)
    try {
      setOnboarding(
        await invoke<AssistantOnboardingState>('assistant_complete_permission_guide'),
      )
      return true
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError))
      return false
    } finally {
      setSaving(false)
    }
  }, [])

  return {
    onboarding,
    loading,
    saving,
    error,
    reload: load,
    completePermissionGuide,
  }
}
