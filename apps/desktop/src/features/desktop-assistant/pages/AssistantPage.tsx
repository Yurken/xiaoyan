/**
 * 桌面助手页面入口
 * 用于独立窗口或作为页面组件
 */
import { useAssistantOverlay, useAssistantWindow, useCaptureSession } from '../hooks'
import { AssistantDock, AssistantPanel, CapturePreview, ResultCard, ImportDialog } from '../components'
import type { AssistantAction, ImportConfig } from '../shared'

export default function AssistantPage() {
  const overlay = useAssistantOverlay()
  const windowManager = useAssistantWindow()
  const capture = useCaptureSession()

  const handleDockClick = async () => {
    await windowManager.togglePanel()
  }

  const handleAction = async (action: AssistantAction) => {
    if (!capture.session?.content) return

    overlay.setPanelStatus('loading')
    // TODO: 调用后端执行动作
    console.log('Execute action:', action, capture.session.content)

    // 模拟执行完成
    setTimeout(() => {
      overlay.setCurrentResult({
        id: 'temp',
        sessionId: capture.session!.id,
        action,
        content: `${action} 结果：${capture.session!.content?.slice(0, 100)}...`,
        format: 'text',
        createdAt: Date.now(),
      })
      overlay.setPanelStatus('ready')
    }, 1000)
  }

  const handleImport = (config: ImportConfig) => {
    console.log('Import with config:', config)
    // TODO: 调用后端导入
    overlay.reset()
    capture.clearSession()
    void windowManager.hidePanel()
  }

  return (
    <div className="h-full">
      {/* 悬浮球 - 仅在主窗口模式下显示 */}
      <AssistantDock onClick={() => void handleDockClick()} />

      {/* 动作面板 */}
      {windowManager.isPanelVisible && (
        <div className="fixed right-20 top-1/2 z-50 -translate-y-1/2">
          {!capture.session || capture.status === 'idle' ? (
            <AssistantPanel
              session={capture.session}
              onAction={(action) => void handleAction(action)}
              onSourceChange={(sourceType) => void capture.startCapture(sourceType)}
              onClose={() => void windowManager.hidePanel()}
            />
          ) : capture.status === 'ready' && overlay.currentResult ? (
            <ResultCard
              result={overlay.currentResult}
              onCopy={(content) => navigator.clipboard.writeText(content)}
              onImport={() => {}}
            />
          ) : (
            <CapturePreview
              session={capture.session}
              onConfirm={capture.confirmCapture}
              onCancel={capture.cancelCapture}
              onRetry={() => void capture.retryCapture()}
              onEdit={capture.updateContent}
            />
          )}
        </div>
      )}

      {/* 导入对话框 */}
      {overlay.currentSession?.userConfirmed && overlay.currentResult && (
        <ImportDialog
          content={overlay.currentResult.content}
          onConfirm={handleImport}
          onCancel={() => overlay.setCurrentSession(null)}
        />
      )}
    </div>
  )
}
