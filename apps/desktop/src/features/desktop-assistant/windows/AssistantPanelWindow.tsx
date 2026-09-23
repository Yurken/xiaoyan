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
  useAssistantWindow,
  useAssistantExtractText,
  useAssistantFreeChat,
  useCaptureSession,
  recordAssistantCopyMetric,
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
} from '../shared'
import { defaultImportRetentionPolicy } from '../importShared'
import { useCallback } from 'react'
import { useAssistantPanelActions } from '../hooks/useAssistantPanelActions'
import { useAssistantInputScope } from '../hooks/useAssistantInputScope'
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
  const extractText = useAssistantExtractText()
  const freeChat = useAssistantFreeChat()
  const { inputGeneration, resetPendingInput } = useAssistantInputScope(extractText.reset, freeChat.reset)
  const { reset: resetActionStream } = actionStream
  const { setError: setOverlayError } = overlay
  const handleCaptureStart = useCallback(() => {
    resetPendingInput()
    resetActionStream()
    setOverlayError(null)
  }, [resetActionStream, setOverlayError, resetPendingInput])
  const capture = useCaptureSession(
    dataPolicy.loading || dataPolicy.policy.preview_required,
    !onboarding.loading && onboarding.onboarding.permission_guide_completed,
    handleCaptureStart,
  )
  const {
    handleAction, handleImportSuccess, handlePasteFallback, handleSourceChange,
    handleExtractText, handleFreeQuestion, handleClose, handlePermissionGuideFinish,
  } = useAssistantPanelActions({
    capture, actionStream, overlay, assistantImport, files, windowManager,
    extractText, freeChat, knowledge, onboarding, resetPendingInput, inputGeneration,
  })
  const fileDialogOpen = Boolean(
    files.inspection || files.confirmedCandidates || files.error,
  )
  const panelContentRef = useAssistantPanelAutoSize(assistantImport.open || fileDialogOpen ? 560 : 0)

  const isLoading =
    capture.status === 'capturing'
    || actionStream.status === 'streaming'
    || extractText.extracting
    || freeChat.starting
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
  // 导入必须绑定结果所属的后端会话：自由提问（P1-3）没有采集会话，
  // 其已确认的后端 session_id 记录在临时会话的 captureSessionId 上；
  // 仅在尚未启动动作（动作选择页直接导入）时才回退到当前采集会话。
  const importSessionId =
    actionStream.session?.captureSessionId ?? capture.session?.id ?? ''
  const importableContent =
    actionStream.result?.content ?? capture.session?.content ?? ''
  const importSourceLabel = actionStream.session?.includeCaptureContext === false
    ? '自由提问'
    : captureSourceSummary
  const sessionThemeName = actionStream.result?.metadata?.knowledgeTheme
    ?? knowledge.themes.find(
      (theme) => theme.id === actionStream.session?.researchThemeId,
    )?.name

  return (
    <div
      ref={panelContentRef}
      className="assistant-panel-surface relative w-full overflow-y-auto"
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
          onCopy={(content) => {
            void navigator.clipboard.writeText(content)
            void recordAssistantCopyMetric()
          }}
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
            const temporarySession = actionStream.session
            if (!temporarySession) return false
            const captureContent = capture.session?.content
            // 自由输入会话没有采集内容；其余会话必须带采集内容才能追问。
            if (temporarySession.includeCaptureContext && !captureContent) return false
            overlay.setError(null)
            return actionStream.followUp({
              captureSessionId: temporarySession.captureSessionId,
              content: captureContent
                ? limitAssistantContent('chat', captureContent).content
                : '',
              question,
              localKnowledgeEnabled: temporarySession.useLocalKnowledge,
              knowledgeThemeId: temporarySession.researchThemeId,
            })
          }}
          onPromoteSession={() => {
            if (
              actionStream.session?.includeCaptureContext !== false
              && !capture.session?.content
            ) {
              return null
            }
            return actionStream.promote({ context: capture.session?.content ?? '' })
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
          confirming={capture.confirming}
          extractedFromImage={capture.extractedFromImage}
          pendingAction={capture.pendingAction}
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
          error={
            overlay.error
            ?? extractText.error
            ?? translationPreferences.error
            ?? freeChat.error
          }
          onExtractText={() => void handleExtractText()}
          extractTextRunning={extractText.extracting}
          onFreeQuestionSubmit={(question) => void handleFreeQuestion(question)}
          freeQuestionStarting={freeChat.starting}
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

      {assistantImport.open && importableContent && (
        <ImportDialog
          content={importableContent}
          originalContent={importOriginalContent}
          sourceLabel={importSourceLabel}
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
            const content = limitAssistantContent('import', importableContent).content
            void assistantImport.confirm({
              sessionId: importSessionId,
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
