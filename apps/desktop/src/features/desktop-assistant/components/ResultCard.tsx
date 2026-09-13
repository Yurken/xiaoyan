/**
 * 结果卡片组件
 * 显示动作执行结果，支持复制和保存
 */
import { useState } from 'react'
import {
  Check,
  Columns2,
  Copy,
  Download,
  ExternalLink,
  RotateCcw,
  Square,
} from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  IconButton,
  MarkdownRenderer,
} from '@research-copilot/ui'
import type {
  ActionResult,
  AssistantActionStreamStatus,
  AssistantSessionMessage,
  AssistantTerminologyPreference,
  AssistantTranslationTargetLanguage,
} from '../shared'
import {
  ASSISTANT_WINDOW_CARD_STYLE,
  buildAssistantBilingualCopy,
} from '../shared'
import { AssistantConversationHistory } from './AssistantConversationHistory'
import { AssistantSessionActions } from './AssistantSessionActions'
import { AssistantSessionContextPanel } from './AssistantSessionContextPanel'
import { AssistantTerminologyPreferenceCard } from './AssistantTerminologyPreferenceCard'
import { AssistantResultMetadata } from './AssistantResultMetadata'

interface ResultCardProps {
  result: ActionResult
  sourceContent?: string
  status?: AssistantActionStreamStatus
  error?: string | null
  onCopy: (content: string) => void
  onImport: () => void
  onStop?: () => void
  onExpand?: () => void
  onRetry?: () => void
  conversationMessages?: AssistantSessionMessage[]
  promotingSession?: boolean
  promotedConversationId?: string
  promotionError?: string | null
  onFollowUp?: (question: string) => Promise<boolean> | boolean
  onPromoteSession?: () => Promise<string | null> | string | null
  onOpenConversation?: () => Promise<boolean> | boolean
  captureContextLabel?: string
  includeCaptureContext?: boolean
  useLocalKnowledge?: boolean
  hadLocalKnowledge?: boolean
  knowledgeThemeName?: string
  onRemoveCaptureContext?: () => void
  onRemoveLocalKnowledge?: () => void
  terminologyPreferences?: AssistantTerminologyPreference[]
  translationTargetLanguage?: AssistantTranslationTargetLanguage
  terminologySaving?: boolean
  terminologyError?: string | null
  onSaveTerminologyPreference?: (
    sourceTerm: string,
    preferredTranslation: string,
    targetLanguage: AssistantTranslationTargetLanguage,
  ) => Promise<boolean> | boolean
  onRemoveTerminologyPreference?: (
    sourceTerm: string,
    targetLanguage: AssistantTranslationTargetLanguage,
  ) => Promise<boolean> | boolean
}

const STATUS_BADGE: Record<
  Exclude<AssistantActionStreamStatus, 'idle'>,
  { label: string; variant: 'success' | 'warning' | 'danger' | 'info' }
> = {
  streaming: { label: '生成中', variant: 'info' },
  completed: { label: '完成', variant: 'success' },
  stopped: { label: '已停止', variant: 'warning' },
  error: { label: '失败', variant: 'danger' },
}

export function ResultCard({
  result,
  sourceContent,
  status = 'completed',
  error,
  onCopy,
  onImport,
  onStop,
  onExpand,
  onRetry,
  conversationMessages = [],
  promotingSession = false,
  promotedConversationId,
  promotionError,
  onFollowUp,
  onPromoteSession,
  onOpenConversation,
  captureContextLabel,
  includeCaptureContext = true,
  useLocalKnowledge = false,
  hadLocalKnowledge = false,
  knowledgeThemeName,
  onRemoveCaptureContext,
  onRemoveLocalKnowledge,
  terminologyPreferences = [],
  translationTargetLanguage,
  terminologySaving = false,
  terminologyError,
  onSaveTerminologyPreference,
  onRemoveTerminologyPreference,
}: ResultCardProps) {
  const [copied, setCopied] = useState(false)
  const visibleStatus = status === 'idle' ? 'completed' : status
  const statusBadge = STATUS_BADGE[visibleStatus]
  const hasContent = result.content.length > 0
  const canCopyBilingual =
    result.action === 'translate'
    && Boolean(sourceContent)
    && !sourceContent?.startsWith('data:image/')

  const handleCopy = () => {
    if (!hasContent) return
    onCopy(result.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card className="w-full overflow-hidden" padding="none" style={ASSISTANT_WINDOW_CARD_STYLE}>
      {/* 标题栏 */}
      <CardHeader
        data-tauri-drag-region
        className="cursor-grab px-4 py-3 active:cursor-grabbing"
        style={{ borderBottom: '1px solid var(--rc-border)' }}
      >
        <CardTitle data-tauri-drag-region className="text-sm">结果</CardTitle>
        <div data-tauri-drag-region>
          <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
        </div>
      </CardHeader>

      {/* 内容区域 */}
      <div className="p-4">
        {captureContextLabel && onRemoveCaptureContext && onRemoveLocalKnowledge && (
          <AssistantSessionContextPanel
            captureContextLabel={captureContextLabel}
            includeCaptureContext={includeCaptureContext}
            useLocalKnowledge={useLocalKnowledge}
            hadLocalKnowledge={hadLocalKnowledge}
            knowledgeThemeName={knowledgeThemeName}
            disabled={status === 'streaming' || Boolean(promotedConversationId)}
            onRemoveCaptureContext={onRemoveCaptureContext}
            onRemoveLocalKnowledge={onRemoveLocalKnowledge}
          />
        )}
        <AssistantConversationHistory messages={conversationMessages} />

        {/* 结果内容 */}
        <Card variant="inset" padding="sm" className="mb-4" style={{ minHeight: 100 }}>
          {result.content && result.format === 'markdown' ? (
            <MarkdownRenderer
              content={result.content}
              className="text-sm prose-headings:my-2 prose-headings:text-sm prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-pre:my-2"
            />
          ) : (
            <div
              className="whitespace-pre-wrap text-sm"
              style={{ color: 'var(--rc-text)' }}
              role={status === 'streaming' ? 'status' : undefined}
              aria-live={status === 'streaming' ? 'polite' : undefined}
            >
              {result.content || (status === 'streaming' ? '正在生成…' : '暂未生成内容')}
            </div>
          )}
        </Card>

        {result.action === 'translate'
          && translationTargetLanguage
          && onSaveTerminologyPreference
          && onRemoveTerminologyPreference && (
          <AssistantTerminologyPreferenceCard
            preferences={terminologyPreferences}
            targetLanguage={translationTargetLanguage}
            saving={terminologySaving}
            disabled={status === 'streaming'}
            error={terminologyError}
            onSave={onSaveTerminologyPreference}
            onRemove={onRemoveTerminologyPreference}
          />
        )}

        {error && (
          <div
            role="alert"
            className="mb-3 rounded-xl px-3 py-2 text-xs"
            style={{
              background: 'var(--rc-badge-danger-bg, rgba(255,59,48,0.14))',
              color: 'var(--rc-badge-danger-text, #D92B21)',
            }}
          >
            {error}
          </div>
        )}

        <AssistantResultMetadata metadata={result.metadata} />

        {/* 操作按钮 */}
        <div className="flex flex-wrap gap-2">
          {status === 'streaming' && onStop && (
            <Button variant="danger" size="sm" onClick={onStop} className="flex-1">
              <Square size={12} fill="currentColor" />
              停止
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={handleCopy}
            disabled={!hasContent}
            className="flex-1"
          >
            {copied ? (
              <>
                <Check size={14} />
                已复制
              </>
            ) : (
              <>
                <Copy size={14} />
                复制
              </>
            )}
          </Button>
          {canCopyBilingual && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onCopy(buildAssistantBilingualCopy(
                sourceContent ?? '',
                result.content,
              ))}
              disabled={!hasContent}
              className="min-w-[96px] flex-1"
            >
              <Columns2 size={14} />
              双语复制
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={onImport}
            disabled={!hasContent}
            className="min-w-[72px] flex-1"
          >
            <Download size={14} />
            导入
          </Button>
          {onExpand && (
            <IconButton size="sm" onClick={onExpand} aria-label="展开结果">
              <ExternalLink size={14} />
            </IconButton>
          )}
          {onRetry && status !== 'streaming' && (
            <IconButton size="sm" onClick={onRetry} aria-label="重试">
              <RotateCcw size={14} />
            </IconButton>
          )}
        </div>

        {onFollowUp && onPromoteSession && onOpenConversation && (
          <AssistantSessionActions
            streaming={status === 'streaming'}
            promoting={promotingSession}
            promotedConversationId={promotedConversationId}
            error={promotionError}
            onFollowUp={onFollowUp}
            onPromote={onPromoteSession}
            onOpenConversation={onOpenConversation}
          />
        )}
      </div>
    </Card>
  )
}
