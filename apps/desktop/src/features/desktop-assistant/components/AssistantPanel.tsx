/**
 * 动作面板组件
 * 显示上下文预览、来源选择和四个动作按钮
 */
import { useState } from 'react'
import {
  BookOpen,
  Languages,
  MessageSquare,
  Download,
  TextCursorInput,
  Clipboard,
  Camera,
  FileInput,
  ScanText,
  Settings,
  X,
} from 'lucide-react'
import {
  Badge,
  Button,
  CapsuleTabs,
  Card,
  CardHeader,
  CardTitle,
  IconButton,
} from '@research-copilot/ui'
import { AssistantKnowledgeControls } from './AssistantKnowledgeControls'
import {
  ASSISTANT_ACTIONS,
  ASSISTANT_ACTION_CHARACTER_LIMITS,
  ASSISTANT_INTERPRET_MODES,
  ASSISTANT_TERMINOLOGY_STYLES,
  ASSISTANT_TRANSLATION_LANGUAGES,
  ASSISTANT_WINDOW_CARD_STYLE,
  CONTEXT_SOURCES,
  CAPTURE_STATUS_LABEL,
  countTextCharacters,
  truncateText,
} from '../shared'
import type {
  AssistantAction,
  AssistantActionOptions,
  AssistantInterpretMode,
  AssistantKnowledgeTheme,
  AssistantTerminologyStyle,
  AssistantTranslationPreferences,
  AssistantTranslationTargetLanguage,
  CaptureSession,
  ContextSourceType,
} from '../shared'

interface AssistantPanelProps {
  session: CaptureSession | null
  isLoading?: boolean
  error?: string | null
  onAction: (action: AssistantAction, options?: AssistantActionOptions) => void
  translationPreferences: AssistantTranslationPreferences
  translationPreferencesSaving?: boolean
  onTranslationPreferencesChange: (
    preferences: AssistantTranslationPreferences,
  ) => void
  knowledgeThemes: AssistantKnowledgeTheme[]
  localKnowledgeEnabled: boolean
  knowledgeThemeId: string
  knowledgeLoading?: boolean
  knowledgeError?: string | null
  onLocalKnowledgeEnabledChange: (enabled: boolean) => void
  onKnowledgeThemeChange: (themeId: string) => void
  onSourceChange: (sourceType: ContextSourceType) => void
  onClose: () => void
  onSettings?: () => void
  /** 截图识字：仅截图内容时展示（PRD P1-2） */
  onExtractText?: () => void
  extractTextRunning?: boolean
  /** 自由输入（P1-3）：无采集内容时直接以问题开启临时对话 */
  onFreeQuestionSubmit?: (question: string) => void
  freeQuestionStarting?: boolean
}

const ACTION_ICONS: Record<AssistantAction, typeof BookOpen> = {
  interpret: BookOpen,
  translate: Languages,
  chat: MessageSquare,
  import: Download,
}

const SOURCE_ICONS: Record<ContextSourceType, typeof TextCursorInput> = {
  selection: TextCursorInput,
  clipboard: Clipboard,
  screenshot: Camera,
  paste: FileInput,
}

export function AssistantPanel({
  session,
  isLoading = false,
  error,
  onAction,
  translationPreferences,
  translationPreferencesSaving = false,
  onTranslationPreferencesChange,
  knowledgeThemes,
  localKnowledgeEnabled,
  knowledgeThemeId,
  knowledgeLoading = false,
  knowledgeError,
  onLocalKnowledgeEnabledChange,
  onKnowledgeThemeChange,
  onSourceChange,
  onClose,
  onSettings,
  onExtractText,
  extractTextRunning = false,
  onFreeQuestionSubmit,
  freeQuestionStarting = false,
}: AssistantPanelProps) {
  const [selectedAction, setSelectedAction] = useState<AssistantAction | null>(null)
  const [question, setQuestion] = useState('')
  const [interpretMode, setInterpretMode] =
    useState<AssistantInterpretMode>('academic')

  const handleActionClick = (action: AssistantAction) => {
    // paste 动作允许无内容时触发（用户可以粘贴）
    if (!session?.content && action !== 'import') return
    setSelectedAction(action)
    const supportsKnowledge = action === 'interpret' || action === 'chat'
    onAction(action, {
      question: question.trim() || undefined,
      interpretMode: action === 'interpret' ? interpretMode : undefined,
      targetLanguage:
        action === 'translate'
          ? translationPreferences.target_language
          : undefined,
      terminologyStyle:
        action === 'translate'
          ? translationPreferences.terminology_style
          : undefined,
      localKnowledgeEnabled: supportsKnowledge
        ? localKnowledgeEnabled
        : undefined,
      knowledgeThemeId:
        supportsKnowledge && localKnowledgeEnabled
          ? knowledgeThemeId
          : undefined,
    })
  }

  const hasContent = !!session?.content
  const isImage = session?.content?.startsWith('data:image/') ?? false
  const contentCharacters =
    session?.content && !isImage ? countTextCharacters(session.content) : 0

  // 自由输入（P1-3）：无采集内容时，输入框直接开启临时对话。
  const canSubmitFreeQuestion =
    !hasContent && Boolean(onFreeQuestionSubmit) && Boolean(question.trim())
  const handleFreeQuestionSubmit = () => {
    if (!canSubmitFreeQuestion || isLoading || freeQuestionStarting) return
    onFreeQuestionSubmit?.(question.trim())
  }

  const statusVariant =
    session?.status === 'ready'
      ? 'success'
      : session?.status === 'error'
        ? 'danger'
        : session?.status === 'capturing'
          ? 'warning'
          : 'default'

  return (
    <Card className="w-full overflow-hidden" padding="none" style={ASSISTANT_WINDOW_CARD_STYLE}>
      {/* 标题栏 */}
      <CardHeader
        data-tauri-drag-region
        className="cursor-grab px-4 py-3 active:cursor-grabbing"
        style={{ borderBottom: '1px solid var(--rc-border)' }}
      >
        <div data-tauri-drag-region className="flex min-w-0 flex-1 items-center gap-2">
          <img
            data-tauri-drag-region
            src="/xiaoyan-avatar.png"
            alt="小妍"
            draggable={false}
            className="h-7 w-7 shrink-0 rounded-full object-cover"
          />
          <CardTitle data-tauri-drag-region className="text-sm">小妍</CardTitle>
        </div>
        <div className="flex items-center gap-1">
          {onSettings && (
            <IconButton size="sm" onClick={onSettings} title="设置">
              <Settings size={14} />
            </IconButton>
          )}
          <IconButton size="sm" onClick={onClose} title="关闭">
            <X size={14} />
          </IconButton>
        </div>
      </CardHeader>

      {/* 内容区域 */}
      <div className="p-4">
        {/* 上下文预览 */}
        <Card variant="inset" padding="sm" className="mb-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium" style={{ color: 'var(--rc-text-muted)' }}>
              当前内容
            </span>
            {session && (
              <Badge variant={statusVariant}>{CAPTURE_STATUS_LABEL[session.status]}</Badge>
            )}
          </div>

          {isLoading ? (
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-apple-blue border-t-transparent" />
              <span className="text-sm" style={{ color: 'var(--rc-text-muted)' }}>
                获取中...
              </span>
            </div>
          ) : session?.content ? (
            <>
              <p className="line-clamp-3 text-sm" style={{ color: 'var(--rc-text)' }}>
                {session.content}
              </p>
              {session.sourceApp && (
                <p className="mt-2 text-xs" style={{ color: 'var(--rc-text-muted)' }}>
                  来源：{session.sourceApp}
                  {session.windowTitle && ` - ${truncateText(session.windowTitle, 50)}`}
                </p>
              )}
              {!isImage && (
                <p className="mt-1 text-xs" style={{ color: 'var(--rc-text-muted)' }}>
                  {contentCharacters.toLocaleString('zh-CN')} 字符
                  {session.contentTruncated && '；采集时已按 50,000 字符上限截断'}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm" style={{ color: 'var(--rc-text-muted)' }}>
              请先获取内容...
            </p>
          )}
        </Card>

        {/* 来源选择 */}
        <div className="mb-4">
          <div className="mb-2 text-xs font-medium" style={{ color: 'var(--rc-text-muted)' }}>
            获取方式
          </div>
          <div className="grid grid-cols-4 gap-1">
            {CONTEXT_SOURCES.map((source) => {
              const Icon = SOURCE_ICONS[source.type]
              const isActive = session?.sourceType === source.type
              return (
                <button
                  key={source.type}
                  onClick={() => onSourceChange(source.type)}
                  disabled={isLoading}
                  className="flex flex-col items-center gap-1 rounded-xl p-2 text-center transition-colors"
                  style={{
                    background: isActive ? 'var(--rc-info-chip-bg)' : 'transparent',
                    color: isActive ? 'var(--rc-info-chip-text)' : 'var(--rc-text-muted)',
                    opacity: isLoading ? 0.5 : 1,
                  }}
                >
                  <Icon size={16} />
                  <span className="text-xs">{source.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* 解读模板 */}
        <div className="mb-4">
          <div className="mb-2 text-xs font-medium" style={{ color: 'var(--rc-text-muted)' }}>
            解读模式
          </div>
          <div className="overflow-x-auto pb-1">
            <CapsuleTabs
              compact
              display="text"
              options={ASSISTANT_INTERPRET_MODES}
              value={interpretMode}
              onChange={(value) => setInterpretMode(value as AssistantInterpretMode)}
            />
          </div>
        </div>

        {/* 翻译偏好 */}
        <div className="mb-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium" style={{ color: 'var(--rc-text-muted)' }}>
              翻译偏好
            </div>
            {translationPreferencesSaving && (
              <span className="text-[10px]" style={{ color: 'var(--rc-text-muted)' }}>
                保存中…
              </span>
            )}
          </div>
          <div className="overflow-x-auto pb-1">
            <CapsuleTabs
              compact
              display="text"
              options={ASSISTANT_TRANSLATION_LANGUAGES}
              value={translationPreferences.target_language}
              onChange={(value) => onTranslationPreferencesChange({
                ...translationPreferences,
                target_language: value as AssistantTranslationTargetLanguage,
              })}
            />
          </div>
          <div className="overflow-x-auto pb-1">
            <CapsuleTabs
              compact
              display="text"
              options={ASSISTANT_TERMINOLOGY_STYLES}
              value={translationPreferences.terminology_style}
              onChange={(value) => onTranslationPreferencesChange({
                ...translationPreferences,
                terminology_style: value as AssistantTerminologyStyle,
              })}
            />
          </div>
        </div>

        <AssistantKnowledgeControls
          themes={knowledgeThemes}
          enabled={localKnowledgeEnabled}
          selectedThemeId={knowledgeThemeId}
          loading={knowledgeLoading}
          error={knowledgeError}
          onEnabledChange={onLocalKnowledgeEnabledChange}
          onThemeChange={onKnowledgeThemeChange}
        />

        {/* 可选问题输入；无采集内容时可直接发起临时对话（P1-3） */}
        <div className="mb-4">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleFreeQuestionSubmit()
            }}
            aria-label={hasContent ? '附加问题（可选）' : '输入问题，直接开始对话'}
            placeholder={
              hasContent
                ? '可选：输入你的问题...'
                : '输入问题即可直接开始对话，无需先采集内容'
            }
            className="w-full rounded-2xl border px-4 py-2.5 text-sm outline-none"
            style={{
              background: 'var(--rc-control-bg)',
              borderColor: 'var(--rc-control-border)',
              color: 'var(--rc-text)',
              boxShadow: 'var(--rc-control-shadow)',
            }}
          />
          {!hasContent && onFreeQuestionSubmit && (
            <Button
              variant="primary"
              size="sm"
              loading={freeQuestionStarting}
              disabled={!canSubmitFreeQuestion || isLoading}
              onClick={handleFreeQuestionSubmit}
              className="mt-2 flex w-full items-center justify-center gap-2"
            >
              <MessageSquare size={14} />
              <span>直接提问</span>
            </Button>
          )}
        </div>

        {/* 动作按钮 */}
        {error && (
          <div
            role="alert"
            className="mb-4 rounded-xl px-3 py-2 text-xs"
            style={{ background: 'var(--rc-badge-danger-bg)', color: 'var(--rc-badge-danger-text)' }}
          >
            {error}
          </div>
        )}

        <div>
          <div className="mb-2 text-xs font-medium" style={{ color: 'var(--rc-text-muted)' }}>
            选择动作
          </div>
          {isImage && onExtractText && (
            <Button
              variant="secondary"
              size="sm"
              loading={extractTextRunning}
              disabled={!hasContent || isLoading}
              onClick={onExtractText}
              className="mb-2 flex w-full items-center justify-center gap-2"
            >
              <ScanText size={14} />
              <span>提取文字（截图识字）</span>
            </Button>
          )}
          <div className="grid grid-cols-2 gap-2">
            {ASSISTANT_ACTIONS.map((action) => {
              const Icon = ACTION_ICONS[action.id]
              const isRunning = selectedAction === action.id && isLoading
              return (
                <Button
                  key={action.id}
                  variant="primary"
                  size="sm"
                  loading={isRunning}
                  disabled={!hasContent || isLoading}
                  onClick={() => handleActionClick(action.id)}
                  className="flex items-center justify-center gap-2"
                >
                  <Icon size={14} />
                  <span>
                    {action.label}
                    {!isImage && (
                      <span className="ml-1 text-[10px] opacity-75">
                        · {action.maxCharacters.toLocaleString('zh-CN')} 字符
                      </span>
                    )}
                  </span>
                </Button>
              )
            })}
          </div>
          {!isImage
            && contentCharacters > ASSISTANT_ACTION_CHARACTER_LIMITS.interpret && (
            <p
              role="status"
              className="mt-2 text-xs leading-5"
              style={{ color: 'var(--rc-badge-warning-text)' }}
            >
              超过所选动作上限的部分不会发送；仅处理对应按钮标示的前若干字符。
            </p>
          )}
        </div>
      </div>
    </Card>
  )
}
