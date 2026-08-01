import { useCallback, useEffect, useState } from 'react'
import {
  DEFAULT_PREFERENCES,
  type AssistantShortcutDiagnostic,
} from '../shared'

async function invoke<T>(
  command: string,
  args?: Record<string, unknown>
): Promise<T> {
  const { invoke: tauriInvoke } = await import('@tauri-apps/api/core')
  return tauriInvoke<T>(command, args)
}

export function useAssistantShortcut() {
  const [shortcut, setShortcut] = useState(DEFAULT_PREFERENCES.shortcut)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [diagnostic, setDiagnostic] = useState<AssistantShortcutDiagnostic | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [registered, currentDiagnostic] = await Promise.all([
        invoke<string>('assistant_get_shortcut'),
        invoke<AssistantShortcutDiagnostic>('assistant_get_shortcut_diagnostic'),
      ])
      setShortcut(registered)
      setDiagnostic(currentDiagnostic)
      setError(null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setLoading(false)
    }
  }, [])

  const save = useCallback(async (nextShortcut: string): Promise<boolean> => {
    setSaving(true)
    setError(null)
    try {
      const registered = await invoke<string>('assistant_set_shortcut', {
        shortcut: nextShortcut,
      })
      setShortcut(registered)
      setDiagnostic({
        status: 'healthy',
        requested_shortcut: registered,
        active_shortcut: registered,
        message: '',
        updated_at: new Date().toISOString(),
      })
      return true
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
      try {
        setDiagnostic(
          await invoke<AssistantShortcutDiagnostic>('assistant_get_shortcut_diagnostic'),
        )
      } catch {
        // 保留当前诊断；原始注册错误仍展示给用户。
      }
      return false
    } finally {
      setSaving(false)
    }
  }, [])

  const retry = useCallback(async (): Promise<boolean> => {
    setSaving(true)
    setError(null)
    try {
      const registered = await invoke<string>('assistant_retry_shortcut')
      setShortcut(registered)
      setDiagnostic({
        status: 'healthy',
        requested_shortcut: registered,
        active_shortcut: registered,
        message: '',
        updated_at: new Date().toISOString(),
      })
      return true
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
      try {
        setDiagnostic(
          await invoke<AssistantShortcutDiagnostic>('assistant_get_shortcut_diagnostic'),
        )
      } catch {
        // 保留当前诊断。
      }
      return false
    } finally {
      setSaving(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { shortcut, diagnostic, loading, saving, error, refresh, save, retry }
}
