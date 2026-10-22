import { useCallback, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { AssistantRuntimePreferences } from '../shared'

interface DockMenuActions {
  showPanel: () => Promise<void>
  pasteFiles: () => Promise<unknown>
}

/** Native menus can extend beyond the companion's small transparent window. */
export function useAssistantDockContextMenu({ showPanel, pasteFiles }: DockMenuActions) {
  const [error, setError] = useState<string | null>(null)
  const opening = useRef(false)

  const open = useCallback(async () => {
    if (opening.current) return
    opening.current = true
    setError(null)
    const run = (action: () => Promise<unknown>) => () => {
      void Promise.resolve().then(action).catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : String(cause))
      })
    }
    try {
      const { Menu } = await import('@tauri-apps/api/menu')
      const menu = await Menu.new({ items: [
        { id: 'assistant-panel', text: '打开面板', action: run(showPanel) },
        { id: 'assistant-paste', text: '粘贴文件', action: run(pasteFiles) },
        { id: 'assistant-settings', text: '设置', action: run(() => invoke('assistant_open_settings')) },
        { item: 'Separator' },
        { id: 'assistant-close', text: '关闭桌面小妍', action: run(async () => {
          const preferences = await invoke<AssistantRuntimePreferences>('assistant_get_runtime_preferences')
          await invoke('assistant_set_runtime_preferences', {
            enabled: false,
            diagnosticLoggingEnabled: preferences.diagnostic_logging_enabled,
          })
        }) },
      ] })
      try {
        await menu.popup()
      } finally {
        await menu.close()
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      opening.current = false
    }
  }, [pasteFiles, showPanel])

  return { open, error }
}
