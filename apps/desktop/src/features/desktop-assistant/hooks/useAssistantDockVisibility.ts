import { useCallback, useEffect, useState } from 'react'

const DOCK_VISIBILITY_EVENT = 'assistant://dock-visibility'

export function useAssistantDockVisibility() {
  const [isDockVisible, setIsDockVisible] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      setIsDockVisible(await invoke<boolean>('assistant_is_dock_visible'))
    } catch {
      setIsDockVisible(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    let unlisten: (() => void) | undefined

    const setup = async () => {
      await refresh()
      try {
        const { listen } = await import('@tauri-apps/api/event')
        const stop = await listen<boolean>(DOCK_VISIBILITY_EVENT, (event) => {
          if (!cancelled) setIsDockVisible(event.payload)
        })
        if (cancelled) stop()
        else unlisten = stop
      } catch {
        // 浏览器与测试环境不提供 Tauri 事件。
      }
    }

    void setup()
    window.addEventListener('focus', refresh)

    return () => {
      cancelled = true
      unlisten?.()
      window.removeEventListener('focus', refresh)
    }
  }, [refresh])

  return { isDockVisible, refresh }
}
