/**
 * 桌面助手动作面板窗口
 * 运行在独立的 assistant-panel Tauri 窗口中
 */
import {
  useAssistantOverlay,
  useAssistantPanelAutoSize,
  useAssistantWindow,
  useCaptureSession,
} from '../hooks'
import { AssistantPanel, CapturePreview, ResultCard, ImportDialog } from '../components'
import type { AssistantAction, ImportConfig, ContextSourceType } from '../shared'
import { useEffect, useState } from 'react'

export default function AssistantPanelWindow() {
  const overlay = useAssistantOverlay()
  const windowManager = useAssistantWindow()
  const capture = useCaptureSession()
  const [importOpen, setImportOpen] = useState(false)
  const [lastAction, setLastAction] = useState<Exclude<AssistantAction, 'import'>>('interpret')
  const panelContentRef = useAssistantPanelAutoSize(importOpen ? 560 : 0)

  const handleAction = async (action: AssistantAction, question?: string) => {
    if (!capture.session?.content) return
    if (action === 'import') {
      setImportOpen(true)
      return
    }

    setLastAction(action)
    overlay.setError(null)
    overlay.setPanelStatus('loading')

    try {
      const { invoke } = await import('@tauri-apps/api/core')

      let result: { id: string; session_id: string; action: string; content: string; format: string }

      switch (action) {
        case 'interpret':
          result = await invoke('assistant_interpret', {
            sessionId: capture.session?.id || 'temp',
            content: capture.session?.content || '',
            question: question || null,
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
            question: question || '请详细解释这段内容',
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
        format: result.format === 'markdown' || result.format === 'html' ? result.format : 'text',
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
    const content = overlay.currentResult?.content ?? capture.session?.content
    if (!capture.session || !content) return

    try {
      const { invoke } = await import('@tauri-apps/api/core')

      await invoke('assistant_import', {
        sessionId: capture.session.id,
        content,
        target: config.target,
        title: config.title || null,
        tags: config.tags || null,
      })

      overlay.reset()
      capture.clearSession()
      setImportOpen(false)
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
    overlay.setCurrentResult(null)
    overlay.setError(null)
    void capture.startCapture(sourceType)
  }

  const handleClose = async () => {
    overlay.reset()
    capture.clearSession()
    setImportOpen(false)
    await windowManager.hidePanel()
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') void handleClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  const isLoading = capture.status === 'capturing' || overlay.panelStatus === 'loading'
  const needsPreview = Boolean(capture.session && !capture.session.userConfirmed)

  return (
    <div
      ref={panelContentRef}
      className="w-full overflow-y-auto"
      style={{ maxHeight: 620, background: 'var(--rc-card-bg)' }}
    >
      {overlay.currentResult ? (
        <ResultCard
          result={overlay.currentResult}
          onCopy={(content) => void navigator.clipboard.writeText(content)}
          onImport={() => setImportOpen(true)}
          onRetry={() => void handleAction(lastAction)}
        />
      ) : needsPreview && capture.session ? (
        <CapturePreview
          session={capture.session}
          privacyError={capture.privacyError}
          onConfirm={capture.confirmCapture}
          onCancel={capture.cancelCapture}
          onRetry={() => void capture.retryCapture()}
          onEdit={capture.updateContent}
          onPasteFallback={handlePasteFallback}
        />
      ) : (
        <AssistantPanel
          session={capture.session}
          isLoading={isLoading}
          error={overlay.error}
          onAction={(action, question) => void handleAction(action, question)}
          onSourceChange={handleSourceChange}
          onClose={() => void handleClose()}
        />
      )}

      {importOpen && (overlay.currentResult?.content || capture.session?.content) && (
        <ImportDialog
          content={overlay.currentResult?.content ?? capture.session?.content ?? ''}
          onConfirm={handleImport}
          onCancel={() => setImportOpen(false)}
        />
      )}
    </div>
  )
}
