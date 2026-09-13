import { useEffect, useRef } from 'react'
import type { AssistantPrivateDataClearResult } from '../shared'

export function useAssistantPrivateDataClearSignal(onClear: () => void) {
  const onClearRef = useRef(onClear)
  onClearRef.current = onClear

  useEffect(() => {
    let unlisten: (() => void) | undefined
    let disposed = false

    const subscribe = async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event')
        const stop = await listen<AssistantPrivateDataClearResult>(
          'assistant://private-data-cleared',
          () => onClearRef.current(),
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
}
