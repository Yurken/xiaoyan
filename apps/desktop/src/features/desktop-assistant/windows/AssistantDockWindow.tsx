/**
 * 桌面小妍角色窗口
 * 运行在独立的 assistant-dock Tauri 窗口中
 */
import { useEffect } from 'react'
import { AssistantDock } from '../components'
import { useAssistantDockPlacement, useAssistantWindow } from '../hooks'

export default function AssistantDockWindow() {
  const windowManager = useAssistantWindow()
  const { restorePlacement, persistPlacement } = useAssistantDockPlacement()

  // 窗口挂载时恢复持久化站位；目标显示器不存在时迁移到主显示器并夹取回可见区域。
  useEffect(() => {
    void restorePlacement()
  }, [restorePlacement])

  const handleDockClick = async () => {
    await windowManager.showPanel()
  }

  return (
    <div
      className="flex h-full w-full items-center justify-center overflow-hidden bg-transparent"
      style={{ background: 'transparent', boxShadow: 'none' }}
    >
      <AssistantDock
        variant="window"
        onClick={() => void handleDockClick()}
        onDragEnd={() => void persistPlacement()}
      />
    </div>
  )
}
