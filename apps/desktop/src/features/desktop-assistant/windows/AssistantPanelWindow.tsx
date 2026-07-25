/**
 * 桌面助手动作面板窗口
 * 运行在独立的 assistant-panel Tauri 窗口中
 */
import { useAssistantOverlay, useAssistantWindow, useCaptureSession } from '../hooks'
import { AssistantPanel, CapturePreview, ResultCard, ImportDialog } from '../components'
import type { AssistantAction, ImportConfig, ContextSourceType } from '../shared'

export default function AssistantPanelWindow() {
  const overlay = useAssistantOverlay()
  const windowManager = useAssistantWindow()
  const capture = useCaptureSession()

  const handleAction = async (action: AssistantAction) => {
    if (!capture.session?.content && action !== 'import') return

    overlay.setPanelStatus('loading')

    try {
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

      await invoke('assistant_import', {
        sessionId: capture.session.id,
        content: capture.session.content,
        target: config.target,
        title: config.title || null,
        tags: config.tags || null,
      })

      overlay.reset()
      capture.clearSession()
      await windowManager.hidePanel()
    } catch (err) {
      console.error('[assistant] Import failed:', err)
      overlay.setError(err instanceof Error ? err.message : '导入失败')
    }
  }

  const handlePasteFallback = () => {
    capture.clearSession()
    void capture.startCapture('paste')
  }

  const handleSourceChange = (sourceType: ContextSourceType) => {
    void capture.startCapture(sourceType)
  }

  const handleClose = async () => {
    overlay.reset()
    capture.clearSession()
    await windowManager.hidePanel()
  }

  return (
    <div className="h-full w-full overflow-hidden bg-transparent p-2">
      {!capture.session || capture.status === 'idle' ? (
        <AssistantPanel
          session={capture.session}
          isLoading={capture.status === 'capturing'}
          onAction={(action) => void handleAction(action)}
          onSourceChange={handleSourceChange}
          onClose={() => void handleClose()}
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
