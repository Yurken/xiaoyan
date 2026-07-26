/**
 * 桌面助手悬浮球窗口
 * 运行在独立的 assistant-dock Tauri 窗口中
 */
import { AssistantDock } from '../components'
import { useAssistantWindow } from '../hooks'

export default function AssistantDockWindow() {
  const windowManager = useAssistantWindow()

  const handleDockClick = async () => {
    await windowManager.showPanel()
  }

  return (
    <div
      className="flex h-full w-full items-center justify-center overflow-hidden bg-transparent"
      style={{ background: 'transparent', boxShadow: 'none' }}
    >
      <AssistantDock variant="window" onClick={() => void handleDockClick()} />
    </div>
  )
}
