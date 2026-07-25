/**
 * 快捷键管理 hook
 * 职责：快捷键注册、冲突与设置同步
 */
import { useState, useCallback, useEffect } from 'react'

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
    // TODO: 调用 Tauri 全局快捷键 API 检查冲突
    // 模拟检查
    const commonConflicts: Record<string, string> = {
      'Command+C': '复制',
      'Command+V': '粘贴',
      'Command+X': '剪切',
      'Command+Z': '撤销',
      'Command+Tab': '应用切换',
      'Alt+Tab': '窗口切换',
    }
    return commonConflicts[shortcutToCheck] ?? null
  }, [])

  const registerShortcut = useCallback(async (): Promise<boolean> => {
    try {
      const conflictApp = await checkConflict(shortcut)
      if (conflictApp) {
        setConflict(conflictApp)
        return false
      }

      // TODO: 调用 Tauri 全局快捷键 API 注册
      // await invoke('plugin:global-shortcut|register', { shortcut })
      setIsRegistered(true)
      setConflict(null)
      return true
    } catch (err) {
      console.error('[assistant] Failed to register shortcut:', err)
      return false
    }
  }, [shortcut, checkConflict])

  const unregisterShortcut = useCallback(async (): Promise<void> => {
    try {
      // TODO: 调用 Tauri 全局快捷键 API 注销
      // await invoke('plugin:global-shortcut|unregister', { shortcut })
      setIsRegistered(false)
    } catch (err) {
      console.error('[assistant] Failed to unregister shortcut:', err)
    }
  }, [shortcut])

  // 监听快捷键触发
  useEffect(() => {
    // TODO: 监听 Tauri 全局快捷键事件
    // const unlisten = await listen('global-shortcut-triggered', () => {
    //   onTrigger?.()
    // })
    // return () => unlisten()
  }, [onTrigger])

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
