import { invoke } from '@tauri-apps/api/core'
import { useCallback, useEffect, useState } from 'react'
import type { AssistantMetricsDailyBucket, AssistantMetricsPreferences } from '../shared'

const DEFAULT_PREFERENCES: AssistantMetricsPreferences = { enabled: false }

/**
 * 复制动作打点：无参数命令，前端无法借此写入任何内容载荷；
 * 统计关闭或不可用时静默跳过，不影响复制本身。
 */
export async function recordAssistantCopyMetric(): Promise<void> {
  try {
    await invoke('assistant_record_copy')
  } catch {
    // 指标失败不阻断主流程。
  }
}

/**
 * 匿名本地指标（PRD §4.3）：开关、按天聚合计数与设置区概览。
 * 事件只含动作类别、采集来源类型、耗时和结果状态，不记录任何正文。
 */
export function useAssistantMetrics() {
  const [preferences, setPreferences] = useState<AssistantMetricsPreferences>(DEFAULT_PREFERENCES)
  const [overview, setOverview] = useState<AssistantMetricsDailyBucket[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const loaded = await invoke<AssistantMetricsPreferences>(
        'assistant_get_metrics_preferences',
      )
      setPreferences(loaded)
      if (loaded.enabled) {
        setOverview(await invoke<AssistantMetricsDailyBucket[]>('assistant_get_metrics_overview'))
      } else {
        setOverview([])
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const setEnabled = useCallback(async (enabled: boolean) => {
    setSaving(true)
    setError(null)
    try {
      const saved = await invoke<AssistantMetricsPreferences>(
        'assistant_set_metrics_preferences',
        { enabled },
      )
      setPreferences(saved)
      if (!saved.enabled) setOverview([])
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
    overview,
    loading,
    saving,
    error,
    reload: load,
    setEnabled,
  }
}
