import { useEffect, type RefObject } from 'react'
import type { useAssistantSession } from './useAssistantSession'
import type { useAssistantImport } from './useAssistantImport'
import type { useAssistantFileCandidates } from './useAssistantFileCandidates'
import type { useAssistantKnowledge } from './useAssistantKnowledge'
import type { useAssistantOnboarding } from './useAssistantOnboarding'
import type { UseAssistantOverlay } from './useAssistantOverlay'
import type { UseAssistantWindow } from './useAssistantWindow'
import type { UseCaptureSession } from './useCaptureSession'
import type { UseAssistantExtractText } from './useAssistantExtractText'
import type { UseAssistantFreeChat } from './useAssistantFreeChat'
import { useAssistantPrivateDataClearSignal } from './useAssistantPrivateDataClearSignal'
import { limitAssistantContent, type AssistantAction, type AssistantActionOptions, type ContextSourceType } from '../shared'
import { discardCaptureSession } from './useCaptureRequest'

export function useAssistantPanelActions({
  capture, actionStream, overlay, assistantImport, files, windowManager,
  extractText, freeChat, knowledge, onboarding, resetPendingInput, inputGeneration,
}: {
  capture: UseCaptureSession
  actionStream: ReturnType<typeof useAssistantSession>
  overlay: UseAssistantOverlay
  assistantImport: ReturnType<typeof useAssistantImport>
  files: ReturnType<typeof useAssistantFileCandidates>
  windowManager: UseAssistantWindow
  extractText: UseAssistantExtractText
  freeChat: UseAssistantFreeChat
  knowledge: ReturnType<typeof useAssistantKnowledge>
  onboarding: ReturnType<typeof useAssistantOnboarding>
  resetPendingInput: () => void
  inputGeneration: RefObject<number>
}) {
  const clearPrivateState = () => {
    resetPendingInput()
    files.clearTemporaryState()
    actionStream.reset()
    overlay.reset()
    capture.clearSession()
    assistantImport.close()
  }
  useAssistantPrivateDataClearSignal(clearPrivateState)

  const handleAction = async (action: AssistantAction, options?: AssistantActionOptions) => {
    if (!capture.session?.content) return
    if (action === 'import') {
      assistantImport.show()
      return
    }
    overlay.setError(null)
    await actionStream.start({
      action,
      sessionId: capture.session.id,
      content: limitAssistantContent(action, capture.session.content).content,
      question: action === 'chat' ? options?.question || '请详细解释这段内容' : options?.question,
      interpretMode: options?.interpretMode,
      targetLang: options?.targetLanguage,
      terminologyStyle: options?.terminologyStyle,
      localKnowledgeEnabled: options?.localKnowledgeEnabled,
      knowledgeThemeId: options?.knowledgeThemeId,
    })
  }

  const handleImportSuccess = async () => {
    resetPendingInput()
    actionStream.reset()
    overlay.reset()
    capture.clearSession()
    assistantImport.close()
    await windowManager.hidePanel()
  }

  const handlePasteFallback = () => {
    capture.clearSession()
    void capture.startCapture('paste')
  }

  const handleSourceChange = (sourceType: ContextSourceType) => {
    actionStream.reset()
    overlay.setError(null)
    capture.clearSession()
    void capture.startCapture(sourceType)
  }

  const handleExtractText = async () => {
    const session = capture.session
    if (!session?.content?.startsWith('data:image/')) return
    overlay.setError(null)
    const generation = inputGeneration.current
    const text = await extractText.extractText(session.id, session.content)
    if (text && generation === inputGeneration.current) capture.applyExtractedText(text, session.id)
  }

  const handleFreeQuestion = async (question: string) => {
    if (actionStream.status === 'streaming') return
    overlay.setError(null)
    const generation = inputGeneration.current
    const input = await freeChat.startFreeChat({
      question,
      localKnowledgeEnabled: knowledge.enabled,
      knowledgeThemeId: knowledge.enabled ? knowledge.selectedThemeId : undefined,
    })
    if (!input) return
    if (generation !== inputGeneration.current) {
      await discardCaptureSession(input.sessionId)
      return
    }
    await actionStream.start(input)
  }

  const handleClose = async () => {
    if (assistantImport.saving) return
    // Invalidate pending confirmation/OCR/chat before awaiting file cancellation.
    resetPendingInput()
    const generation = inputGeneration.current
    actionStream.reset()
    overlay.reset()
    capture.clearSession()
    assistantImport.close()
    if (files.inspection) await files.cancel()
    if (generation !== inputGeneration.current) return
    files.clearConfirmation()
    await windowManager.hidePanel()
  }

  const handlePermissionGuideFinish = async () => {
    const generation = inputGeneration.current
    const completed = await onboarding.completePermissionGuide()
    if (completed && generation === inputGeneration.current) void capture.startCapture('selection')
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) void handleClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  return {
    handleAction, handleImportSuccess, handlePasteFallback, handleSourceChange,
    handleExtractText, handleFreeQuestion, handleClose, handlePermissionGuideFinish,
  }
}
