import { invoke } from '@tauri-apps/api/core'
import { useCallback, useEffect, useState } from 'react'
import type { AssistantDataPolicy, AssistantPrivateDataClearResult } from '../shared'

const DEFAULT_DATA_POLICY: AssistantDataPolicy = {
  preview_required: true,
  inbox_retention_days: 7,
}

export function useAssistantDataPolicy() {
  const [policy, setPolicy] = useState<AssistantDataPolicy>(DEFAULT_DATA_POLICY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [clearingPrivateData, setClearingPrivateData] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setPolicy(await invoke<AssistantDataPolicy>('assistant_get_data_policy'))
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
        const stop = await listen<AssistantDataPolicy>(
          'assistant://data-policy-changed',
          (event) => setPolicy(event.payload),
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

  const save = useCallback(async (next: AssistantDataPolicy) => {
    setSaving(true)
    setError(null)
    try {
      const saved = await invoke<AssistantDataPolicy>('assistant_set_data_policy', {
        previewRequired: next.preview_required,
        inboxRetentionDays: next.inbox_retention_days,
      })
      setPolicy(saved)
      return true
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError))
      return false
    } finally {
      setSaving(false)
    }
  }, [])

  const clearLaterItems = useCallback(async () => {
    setClearing(true)
    setError(null)
    try {
      return await invoke<number>('assistant_clear_later_items')
    } catch (clearError) {
      setError(clearError instanceof Error ? clearError.message : String(clearError))
      return null
    } finally {
      setClearing(false)
    }
  }, [])

  const clearPrivateData = useCallback(async () => {
    setClearingPrivateData(true)
    setError(null)
    try {
      return await invoke<AssistantPrivateDataClearResult>('assistant_clear_private_data')
    } catch (clearError) {
      setError(clearError instanceof Error ? clearError.message : String(clearError))
      return null
    } finally {
      setClearingPrivateData(false)
    }
  }, [])

  return {
    policy,
    loading,
    saving,
    clearing,
    clearingPrivateData,
    error,
    reload: load,
    save,
    clearLaterItems,
    clearPrivateData,
  }
}
