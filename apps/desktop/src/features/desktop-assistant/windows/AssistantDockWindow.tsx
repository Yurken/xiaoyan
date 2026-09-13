/**
 * 桌面小妍角色窗口
 * 运行在独立的 assistant-dock Tauri 窗口中
 */
import { useEffect, useState } from 'react'
import { AssistantDock } from '../components'
import { useAssistantDockPlacement, useAssistantWindow } from '../hooks'
import { useFileShelf } from '../../file-shelf'

export default function AssistantDockWindow() {
  const windowManager = useAssistantWindow()
  const { restorePlacement, persistPlacement } = useAssistantDockPlacement()
  const shelf = useFileShelf({ listenForDrops: true })
  const [shelfFeedback, setShelfFeedback] = useState<string | null>(null)

  // 窗口挂载时恢复持久化站位；目标显示器不存在时迁移到主显示器并夹取回可见区域。
  useEffect(() => {
    void restorePlacement()
  }, [restorePlacement])

  useEffect(() => {
    const message = shelf.error ?? shelf.notice
    if (!message) return
    setShelfFeedback(message)
    const timeout = window.setTimeout(() => setShelfFeedback(null), 1800)
    return () => window.clearTimeout(timeout)
  }, [shelf.error, shelf.notice])

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
        onPasteFiles={() => { void shelf.stashClipboard() }}
        fileDropActive={shelf.dragActive}
        fileShelfBusy={shelf.action === 'stashing'}
        fileShelfCount={shelf.items.length}
        fileShelfFeedback={shelfFeedback}
      />
    </div>
  )
}
