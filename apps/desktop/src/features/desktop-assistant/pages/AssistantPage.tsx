/**
 * 桌面助手页面入口
 * 用于独立窗口或作为页面组件
 */
import { useAssistantOverlay, useCaptureSession } from '../hooks'
import { AssistantDock, AssistantPanel, CapturePreview, ResultCard, ImportDialog } from '../components'
import type { AssistantAction, ImportConfig } from '../shared'

export default function AssistantPage() {
  const overlay = useAssistantOverlay()
  const capture = useCaptureSession()

  const handleAction = async (action: AssistantAction) => {
    if (!capture.session?.content) return

    overlay.showPanel()
    // TODO: 调用后端执行动作
    console.log('Execute action:', action, capture.session.content)
  }

  const handleImport = (config: ImportConfig) => {
    console.log('Import with config:', config)
    // TODO: 调用后端导入
    overlay.hidePanel()
    capture.clearSession()
  }

  return (
    <div className="h-full">
      {/* 悬浮球 */}
      <AssistantDock onClick={overlay.togglePanel} />

      {/* 动作面板 */}
      {overlay.isPanelVisible && (
        <div className="fixed right-20 top-1/2 z-50 -translate-y-1/2">
          {!capture.session || capture.status === 'idle' ? (
            <AssistantPanel
              session={capture.session}
              onAction={(action) => void handleAction(action)}
              onSourceChange={(sourceType) => void capture.startCapture(sourceType)}
              onClose={overlay.hidePanel}
            />
          ) : capture.status === 'ready' ? (
            <ResultCard
              result={{
                id: 'temp',
                sessionId: capture.session.id,
                action: 'interpret',
                content: capture.session.content ?? '',
                format: 'text',
                createdAt: Date.now(),
              }}
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
