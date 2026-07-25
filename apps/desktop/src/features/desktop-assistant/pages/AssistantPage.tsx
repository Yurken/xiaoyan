/**
 * 桌面助手页面入口
 * 用于独立窗口或作为页面组件
 */
import { useAssistantOverlay, useAssistantWindow, useCaptureSession } from '../hooks'
import { AssistantDock, AssistantPanel, CapturePreview, ResultCard, ImportDialog } from '../components'
import type { AssistantAction, ImportConfig, ContextSourceType } from '../shared'

export default function AssistantPage() {
  const overlay = useAssistantOverlay()
  const windowManager = useAssistantWindow()
  const capture = useCaptureSession()

  const handleDockClick = async () => {
    await windowManager.togglePanel()
  }

  const handleAction = async (action: AssistantAction) => {
    if (!capture.session?.content && action !== 'import') return

    overlay.setPanelStatus('loading')

    try {
      // 根据动作类型调用不同的 Tauri 命令
      const { invoke } = await import('@tauri-apps/api/core')

      let result: { id: string; session_id: string; action: string; content: string; format: string }

      switch (action) {
        case 'interpret':
          result = await invoke('assistant_interpret', {
            sessionId: capture.session?.id || 'temp',
            content: capture.session?.content || '',
            question: null,
          })
          break
        case 'translate':
          result = await invoke('assistant_translate', {
            sessionId: capture.session?.id || 'temp',
            content: capture.session?.content || '',
            targetLang: null,
          })
          break
        case 'chat':
          result = await invoke('assistant_chat', {
            sessionId: capture.session?.id || 'temp',
            context: capture.session?.content || '',
            question: '请详细解释这段内容',
          })
          break
        case 'import':
          result = await invoke('assistant_import', {
            sessionId: capture.session?.id || 'temp',
            content: capture.session?.content || '',
            target: 'note',
            title: null,
            tags: null,
          })
          break
        default:
          throw new Error(`Unknown action: ${action}`)
      }

      overlay.setCurrentResult({
        id: result.id,
        sessionId: result.session_id,
        action,
        content: result.content,
        format: 'text',
        createdAt: Date.now(),
      })
      overlay.setPanelStatus('ready')
    } catch (err) {
      console.error('[assistant] Action failed:', err)
      overlay.setError(err instanceof Error ? err.message : '动作执行失败')
      overlay.setPanelStatus('error')
    }
  }

  const handleImport = async (config: ImportConfig) => {
    if (!capture.session?.content) return

    try {
      const { invoke } = await import('@tauri-apps/api/core')

      const result = await invoke('assistant_import', {
        sessionId: capture.session.id,
        content: capture.session.content,
        target: config.target,
        title: config.title || null,
        tags: config.tags || null,
      })

      console.log('Import result:', result)
      overlay.reset()
      capture.clearSession()
      await windowManager.hidePanel()
    } catch (err) {
      console.error('[assistant] Import failed:', err)
      overlay.setError(err instanceof Error ? err.message : '导入失败')
    }
  }

  const handlePasteFallback = () => {
    // 切换到粘贴模式
    capture.clearSession()
    void capture.startCapture('paste')
  }

  const handleSourceChange = (sourceType: ContextSourceType) => {
    void capture.startCapture(sourceType)
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
              isLoading={capture.status === 'capturing'}
              onAction={(action) => void handleAction(action)}
              onSourceChange={handleSourceChange}
              onClose={() => void windowManager.hidePanel()}
            />
          ) : capture.status === 'ready' && overlay.currentResult ? (
            <ResultCard
              result={overlay.currentResult}
              onCopy={(content) => navigator.clipboard.writeText(content)}
              onImport={() => handleImport({ target: 'note', preserveOriginal: false })}
              onRetry={() => void handleAction('interpret')}
            />
          ) : (
            <CapturePreview
              session={capture.session}
              privacyError={capture.privacyError}
              onConfirm={capture.confirmCapture}
              onCancel={capture.cancelCapture}
              onRetry={() => void capture.retryCapture()}
              onEdit={capture.updateContent}
              onPasteFallback={handlePasteFallback}
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
