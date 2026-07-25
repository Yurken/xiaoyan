/**
 * 桌面助手启动入口
 * 负责显示悬浮球窗口并注册全局快捷键
 */

/**
 * 显示桌面助手悬浮球并注册全局快捷键（Alt+Space）。
 * 在浏览器/测试环境中静默失败。
 */
export async function launchDesktopAssistant(): Promise<void> {
  try {
    const { invoke } = await import('@tauri-apps/api/core')

    // 显示悬浮球窗口
    await invoke('assistant_show_dock')

    // 注册全局快捷键
    await invoke('plugin:global-shortcut|register', {
      shortcut: 'Alt+Space',
    })
  } catch (err) {
    console.error('[assistant] Failed to launch desktop assistant:', err)
  }
}
