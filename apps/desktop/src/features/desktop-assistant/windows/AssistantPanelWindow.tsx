import {
  useAssistantOverlay,
  useAssistantSession,
  useAssistantTranslationPreferences,
  useAssistantTerminologyPreferences,
  useAssistantDataPolicy,
  useAssistantFileCandidates,
  useAssistantOnboarding,
  useAssistantPanelAutoSize,
  useAssistantKnowledge,
  useAssistantImport,
  useAssistantPrivateDataClearSignal,
  useAssistantWindow,
  useCaptureSession,
} from '../hooks'
import {
  AssistantPanel,
  AssistantPermissionGuide,
  CapturePreview,
  FileCandidateDialog,
  ResultCard,
  ImportDialog,
} from '../components'
import {
  CONTEXT_SOURCES,
  limitAssistantContent,
  type AssistantAction,
  type AssistantActionOptions,
  type ContextSourceType,
} from '../shared'
import { defaultImportRetentionPolicy } from '../importShared'
import { useCallback, useEffect } from 'react'
import { FileUp } from 'lucide-react'

export default function AssistantPanelWindow() {
  const overlay = useAssistantOverlay()
  const actionStream = useAssistantSession()
  const translationPreferences = useAssistantTranslationPreferences()
  const terminologyPreferences = useAssistantTerminologyPreferences()
  const windowManager = useAssistantWindow()
  const dataPolicy = useAssistantDataPolicy()
  const onboarding = useAssistantOnboarding()
  const files = useAssistantFileCandidates()
  const knowledge = useAssistantKnowledge()
  const assistantImport = useAssistantImport()
  const capture = useCaptureSession(
    dataPolicy.loading || dataPolicy.policy.preview_required,
    !onboarding.loading && onboarding.onboarding.permission_guide_completed,
  )
  const clearPrivateState = useCallback(() => {
    files.clearTemporaryState()
    actionStream.reset()
    overlay.reset()
    capture.clearSession()
    assistantImport.close()
  }, [actionStream, assistantImport, capture, files, overlay])
  useAssistantPrivateDataClearSignal(clearPrivateState)
  const fileDialogOpen = Boolean(
    files.inspection || files.confirmedCandidates || files.error,
  )
  const panelContentRef = useAssistantPanelAutoSize(assistantImport.open || fileDialogOpen ? 560 : 0)

  const handleAction = async (
    action: AssistantAction,
    options?: AssistantActionOptions,
  ) => {
    if (!capture.session?.content) return
    if (action === 'import') {
      assistantImport.show()
      return
    }
    const actionContent = limitAssistantContent(action, capture.session.content).content

    overlay.setError(null)
    await actionStream.start({
      action,
      sessionId: capture.session.id,
      content: actionContent,
      question:
        action === 'chat'
          ? options?.question || '请详细解释这段内容'
          : options?.question,
      interpretMode: options?.interpretMode,
      targetLang: options?.targetLanguage,
      terminologyStyle: options?.terminologyStyle,
      localKnowledgeEnabled: options?.localKnowledgeEnabled,
      knowledgeThemeId: options?.knowledgeThemeId,
    })
  }

  const handleImportSuccess = async () => {
    actionStream.reset()
    overlay.reset()
    capture.clearSession()
    await windowManager.hidePanel()
  }

  const handlePasteFallback = () => {
    capture.clearSession()
    void capture.startCapture('paste')
  }

  const handleSourceChange = (sourceType: ContextSourceType) => {
    actionStream.reset()
    overlay.setError(null)
    void capture.startCapture(sourceType)
  }

  const handleClose = async () => {
    if (assistantImport.saving) return
    if (files.inspection) await files.cancel()
    files.clearConfirmation()
    actionStream.reset()
    overlay.reset()
    capture.clearSession()
    assistantImport.close()
    await windowManager.hidePanel()
  }

  const handlePermissionGuideFinish = async () => {
    const completed = await onboarding.completePermissionGuide()
    if (completed) void capture.startCapture('selection')
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') void handleClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  const isLoading =
    capture.status === 'capturing' || actionStream.status === 'streaming'
  const needsPreview = Boolean(capture.session && !capture.session.userConfirmed)
  const needsPermissionGuide =
    !onboarding.loading && !onboarding.onboarding.permission_guide_completed
  const captureContextLabel = capture.session
    ? CONTEXT_SOURCES.find((source) => source.type === capture.session?.sourceType)?.label
      ?? '捕获内容'
    : '捕获内容'
  const captureSourceSummary = [
    captureContextLabel,
    capture.session?.sourceApp,
    capture.session?.windowTitle,
  ].filter(Boolean).join(' · ')
  const importOriginalContent = actionStream.session?.includeCaptureContext === false
    ? undefined
    : capture.session?.content ?? undefined
  const sessionThemeName = actionStream.result?.metadata?.knowledgeTheme
    ?? knowledge.themes.find(
      (theme) => theme.id === actionStream.session?.researchThemeId,
    )?.name

  return (
    <div
      ref={panelContentRef}
      className="relative w-full overflow-y-auto"
      style={{ maxHeight: 620, background: 'var(--rc-card-bg)' }}
    >
      {fileDialogOpen ? (
        <FileCandidateDialog
          inspection={files.inspection}
          confirmedCandidates={files.confirmedCandidates}
          confirming={files.confirming}
          error={files.error}
          onConfirm={() => void files.confirm()}
          onCancel={() => void files.cancel()}
          onCloseConfirmation={files.clearConfirmation}
        />
      ) : needsPermissionGuide ? (
        <AssistantPermissionGuide
          saving={onboarding.saving}
          error={onboarding.error}
          onFinish={handlePermissionGuideFinish}
        />
      ) : actionStream.result ? (
        <ResultCard
          result={actionStream.result}
          sourceContent={capture.session?.content ?? undefined}
          status={actionStream.status}
          error={actionStream.error ?? overlay.error}
          onCopy={(content) => void navigator.clipboard.writeText(content)}
          onImport={assistantImport.show}
          onStop={() => void actionStream.stop()}
          onRetry={
            actionStream.session?.includeCaptureContext
              || actionStream.result.action === 'chat'
              ? () => void actionStream.retry()
              : undefined
          }
          conversationMessages={actionStream.historyMessages}
          promotingSession={actionStream.promoting}
          promotedConversationId={actionStream.session?.promotedConversationId}
          promotionError={actionStream.promotionError}
          onFollowUp={(question) => {
            if (!capture.session?.content || !actionStream.session) return false
            overlay.setError(null)
            return actionStream.followUp({
              captureSessionId: capture.session.id,
              content: limitAssistantContent('chat', capture.session.content).content,
              question,
              localKnowledgeEnabled: actionStream.session.useLocalKnowledge,
              knowledgeThemeId: actionStream.session.researchThemeId,
            })
          }}
          onPromoteSession={() => {
            if (!capture.session?.content) return null
            return actionStream.promote({ context: capture.session.content })
          }}
          onOpenConversation={async () => {
            const opened = await actionStream.openConversation()
            if (opened) await handleClose()
            return opened
          }}
          captureContextLabel={captureContextLabel}
          includeCaptureContext={actionStream.session?.includeCaptureContext}
          useLocalKnowledge={actionStream.session?.useLocalKnowledge}
          hadLocalKnowledge={Boolean(actionStream.session?.researchThemeId)}
          knowledgeThemeName={sessionThemeName}
          onRemoveCaptureContext={actionStream.removeCaptureContext}
          onRemoveLocalKnowledge={actionStream.removeLocalKnowledge}
          terminologyPreferences={terminologyPreferences.preferences}
          translationTargetLanguage={
            actionStream.session?.translationTargetLanguage
              ?? translationPreferences.preferences.target_language
          }
          terminologySaving={terminologyPreferences.saving}
          terminologyError={terminologyPreferences.error}
          onSaveTerminologyPreference={terminologyPreferences.save}
          onRemoveTerminologyPreference={terminologyPreferences.remove}
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
          error={overlay.error ?? translationPreferences.error}
          translationPreferences={translationPreferences.preferences}
          translationPreferencesSaving={translationPreferences.saving}
          onTranslationPreferencesChange={(preferences) => {
            void translationPreferences.save(preferences)
          }}
          knowledgeThemes={knowledge.themes}
          localKnowledgeEnabled={knowledge.enabled}
          knowledgeThemeId={knowledge.selectedThemeId}
          knowledgeLoading={knowledge.loading}
          knowledgeError={knowledge.error}
          onLocalKnowledgeEnabledChange={knowledge.setKnowledgeEnabled}
          onKnowledgeThemeChange={knowledge.selectTheme}
          onAction={(action, options) => void handleAction(action, options)}
          onSourceChange={handleSourceChange}
          onClose={() => void handleClose()}
        />
      )}

      {(files.dragActive || files.loading) && (
        <div
          role="status"
          className="absolute inset-0 z-40 flex items-center justify-center rounded-3xl border-2 border-dashed p-6 text-center"
          style={{
            background: 'color-mix(in srgb, var(--rc-card-bg) 92%, transparent)',
            borderColor: 'var(--rc-accent)',
            color: 'var(--rc-accent)',
          }}
        >
          <div>
            <FileUp className="mx-auto h-8 w-8" />
            <p className="mt-2 text-sm font-semibold">
              {files.loading ? '正在安全检查文件…' : '松开以创建导入候选'}
            </p>
            <p className="mt-1 text-xs">
              支持 PDF、PNG、JPEG、WebP、Markdown 和 TXT
            </p>
          </div>
        </div>
      )}

      {assistantImport.open && capture.session?.content && (
        <ImportDialog
          content={actionStream.result?.content ?? capture.session?.content ?? ''}
          originalContent={importOriginalContent}
          sourceLabel={captureSourceSummary}
          themes={knowledge.themes}
          defaultResearchThemeId={
            actionStream.session?.researchThemeId ?? knowledge.selectedThemeId
          }
          defaultRetentionPolicy={defaultImportRetentionPolicy(
            dataPolicy.policy.inbox_retention_days,
          )}
          saving={assistantImport.saving}
          error={assistantImport.error}
          onConfirm={(config) => {
            const content = limitAssistantContent(
              'import',
              actionStream.result?.content ?? capture.session?.content ?? '',
            ).content
            void assistantImport.confirm({
              sessionId: capture.session?.id ?? '',
              content,
              originalContent: importOriginalContent,
              config,
            }).then((imported) => {
              if (imported) void handleImportSuccess()
            })
          }}
          onCancel={assistantImport.close}
        />
      )}
    </div>
  )
}
