import { useCallback, useEffect, useState } from 'react'

export interface AssistantPermissionStatus {
  accessibility: boolean
  screen_recording: boolean
  clipboard: boolean
}

export function useAssistantPermissions() {
  const [status, setStatus] = useState<AssistantPermissionStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const invoke = useCallback(async <T,>(command: string): Promise<T> => {
    const { invoke: tauriInvoke } = await import('@tauri-apps/api/core')
    return tauriInvoke<T>(command)
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setStatus(await invoke<AssistantPermissionStatus>('assistant_check_permissions'))
      setError(null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setLoading(false)
    }
  }, [invoke])

  const request = useCallback(async (command: string) => {
    setError(null)
    try {
      await invoke<boolean>(command)
      await refresh()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    }
  }, [invoke, refresh])

  const requestAccessibility = useCallback(
    () => request('assistant_request_accessibility'),
    [request]
  )

  const requestScreenRecording = useCallback(
    () => request('assistant_request_screen_recording'),
    [request]
  )

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { status, loading, error, refresh, requestAccessibility, requestScreenRecording }
}
