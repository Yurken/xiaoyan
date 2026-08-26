/**
 * 直达动作快捷键管理 hook（P1-1，PRD §16.2）
 * 职责：加载/保存/重试三个可选直达动作的全局快捷键，默认不注册。
 * 冲突处理复用主快捷键模式：注册失败读取按动作的持久诊断，提供重试入口。
 */
import { useCallback, useEffect, useState } from 'react'
import {
  ASSISTANT_DIRECT_ACTIONS,
  type AssistantDirectAction,
  type AssistantDirectShortcutStatus,
} from '../shared'

async function invoke<T>(
  command: string,
  args?: Record<string, unknown>
): Promise<T> {
  const { invoke: tauriInvoke } = await import('@tauri-apps/api/core')
  return tauriInvoke<T>(command, args)
}

function fallbackStatuses(): AssistantDirectShortcutStatus[] {
  return ASSISTANT_DIRECT_ACTIONS.map((config) => ({
    action: config.id,
    configured_shortcut: null,
    active_shortcut: null,
    diagnostic: null,
  }))
}

export function useAssistantDirectShortcuts() {
  const [statuses, setStatuses] = useState<AssistantDirectShortcutStatus[]>(fallbackStatuses)
  const [loading, setLoading] = useState(true)
  const [savingAction, setSavingAction] = useState<AssistantDirectAction | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const loaded = await invoke<AssistantDirectShortcutStatus[]>(
        'assistant_get_direct_shortcuts',
      )
      setStatuses(loaded)
      setError(null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setLoading(false)
    }
  }, [])

  /** shortcut 为 null 时关闭该直达动作并注销组合键。 */
  const save = useCallback(
    async (
      action: AssistantDirectAction,
      shortcut: string | null,
    ): Promise<boolean> => {
      setSavingAction(action)
      setError(null)
      try {
        const status = await invoke<AssistantDirectShortcutStatus>(
          'assistant_set_direct_shortcut',
          { action, shortcut },
        )
        setStatuses((current) =>
          current.map((item) => (item.action === action ? status : item)),
        )
        return true
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : String(reason))
        try {
          setStatuses(
            await invoke<AssistantDirectShortcutStatus[]>(
              'assistant_get_direct_shortcuts',
            ),
          )
        } catch {
          // 保留当前状态；原始注册错误仍展示给用户。
        }
        return false
      } finally {
        setSavingAction(null)
      }
    },
    [],
  )

  const retry = useCallback(async (action: AssistantDirectAction): Promise<boolean> => {
    setSavingAction(action)
    setError(null)
    try {
      const status = await invoke<AssistantDirectShortcutStatus>(
        'assistant_retry_direct_shortcut',
        { action },
      )
      setStatuses((current) =>
        current.map((item) => (item.action === action ? status : item)),
      )
      return true
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
      try {
        setStatuses(
          await invoke<AssistantDirectShortcutStatus[]>(
            'assistant_get_direct_shortcuts',
          ),
        )
      } catch {
        // 保留当前状态。
      }
      return false
    } finally {
      setSavingAction(null)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { statuses, loading, savingAction, error, refresh, save, retry }
}
