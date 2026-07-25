/**
 * 快捷键管理 hook
 * 职责：快捷键注册、冲突与设置同步
 */
import { useState, useCallback, useEffect } from 'react'

// Tauri invoke 包装
async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke: tauriInvoke } = await import('@tauri-apps/api/core')
  return tauriInvoke<T>(command, args)
}

// Tauri listen 包装
async function listen<T>(event: string, handler: (event: { payload: T }) => void): Promise<() => void> {
  const { listen: tauriListen } = await import('@tauri-apps/api/event')
  return tauriListen<T>(event, handler)
}

export interface UseAssistantShortcut {
  shortcut: string
  isRegistered: boolean
  conflict: string | null
  setShortcut: (shortcut: string) => void
  registerShortcut: () => Promise<boolean>
  unregisterShortcut: () => Promise<void>
  checkConflict: (shortcut: string) => Promise<string | null>
}

export function useAssistantShortcut(
  initialShortcut: string = 'Alt+Space',
  onTrigger?: () => void
): UseAssistantShortcut {
  const [shortcut, setShortcutState] = useState(initialShortcut)
  const [isRegistered, setIsRegistered] = useState(false)
  const [conflict, setConflict] = useState<string | null>(null)

  const setShortcut = useCallback((newShortcut: string) => {
    setShortcutState(newShortcut)
    setConflict(null)
  }, [])

  const checkConflict = useCallback(async (shortcutToCheck: string): Promise<string | null> => {
    // 系统快捷键冲突检查
    const systemShortcuts: Record<string, string> = {
      'Command+C': '复制',
      'Command+V': '粘贴',
      'Command+X': '剪切',
      'Command+Z': '撤销',
      'Command+Tab': '应用切换',
      'Command+Space': 'Spotlight',
      'Alt+Tab': '窗口切换',
      'Alt+Command+Esc': '强制退出',
      'Control+Up': 'Mission Control',
      'Control+Down': '应用窗口',
      'Control+Left': '左桌面',
      'Control+Right': '右桌面',
    }
    return systemShortcuts[shortcutToCheck] ?? null
  }, [])

  const registerShortcut = useCallback(async (): Promise<boolean> => {
    try {
      // 检查冲突
      const conflictApp = await checkConflict(shortcut)
      if (conflictApp) {
        setConflict(conflictApp)
        return false
      }

      // 调用 Tauri global-shortcut 插件注册
      await invoke('plugin:global-shortcut|register', {
        shortcut,
      })

      setIsRegistered(true)
      setConflict(null)
      return true
    } catch (err) {
      console.error('[assistant] Failed to register shortcut:', err)
      // 如果是冲突错误，尝试解析
      if (err instanceof Error && err.message.includes('Conflict')) {
        setConflict('与其他应用冲突')
      }
      return false
    }
  }, [shortcut, checkConflict])

  const unregisterShortcut = useCallback(async (): Promise<void> => {
    try {
      await invoke('plugin:global-shortcut|unregister', {
        shortcut,
      })
      setIsRegistered(false)
    } catch (err) {
      console.error('[assistant] Failed to unregister shortcut:', err)
    }
  }, [shortcut])

  // 监听快捷键触发事件
  useEffect(() => {
    if (!onTrigger) return

    let unlisten: (() => void) | null = null

    const setup = async () => {
      unlisten = await listen<{ shortcut?: string }>('global-shortcut://trigger', (event) => {
        // 检查是否是我们的快捷键
        if (event.payload.shortcut === shortcut) {
          onTrigger()
        }
      })
    }

    void setup()

    return () => {
      unlisten?.()
    }
  }, [shortcut, onTrigger])

  // 组件卸载时自动注销
  useEffect(() => {
    return () => {
      if (isRegistered) {
        void unregisterShortcut()
      }
    }
  }, [isRegistered, unregisterShortcut])

  return {
    shortcut,
    isRegistered,
    conflict,
    setShortcut,
    registerShortcut,
    unregisterShortcut,
    checkConflict,
  }
}
