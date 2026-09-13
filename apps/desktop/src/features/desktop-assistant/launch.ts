/**
 * 桌面助手启动入口
 * 负责显示桌面小妍形象和动作面板；全局快捷键由 Rust 在应用启动时注册。
 */

/**
 * 显示桌面小妍形象和动作面板。
 */
export async function launchDesktopAssistant(): Promise<void> {
  const { invoke } = await import('@tauri-apps/api/core')
  await invoke('assistant_show_dock')
  await invoke('assistant_show_panel')
}
