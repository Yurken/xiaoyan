import { useState } from 'react'
import { ArrowUp, ExternalLink, Save } from 'lucide-react'
import { Badge, Button } from '@research-copilot/ui'

interface AssistantSessionActionsProps {
  streaming: boolean
  promoting?: boolean
  promotedConversationId?: string
  error?: string | null
  onFollowUp: (question: string) => Promise<boolean> | boolean
  onPromote: () => Promise<string | null> | string | null
  onOpenConversation: () => Promise<boolean> | boolean
}

export function AssistantSessionActions({
  streaming,
  promoting = false,
  promotedConversationId,
  error,
  onFollowUp,
  onPromote,
  onOpenConversation,
}: AssistantSessionActionsProps) {
  const [question, setQuestion] = useState('')
  const promoted = Boolean(promotedConversationId)

  const submitFollowUp = async () => {
    const value = question.trim()
    if (!value || streaming || promoted) return
    if (await onFollowUp(value)) setQuestion('')
  }

  return (
    <div className="mt-3 space-y-2 border-t pt-3" style={{ borderColor: 'var(--rc-border)' }}>
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          void submitFollowUp()
        }}
      >
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          disabled={streaming || promoted}
          aria-label="继续追问"
          placeholder={promoted ? '请在主窗口继续对话' : '基于本次上下文继续追问…'}
          className="min-w-0 flex-1 rounded-2xl border px-3 py-2 text-xs outline-none"
          style={{
            background: 'var(--rc-control-bg)',
            borderColor: 'var(--rc-control-border)',
            color: 'var(--rc-text)',
          }}
        />
        <Button
          type="submit"
          size="sm"
          disabled={!question.trim() || streaming || promoted}
          aria-label="发送追问"
        >
          <ArrowUp size={13} />
        </Button>
      </form>

      <div className="flex items-center gap-2">
        {promoted ? (
          <>
            <Badge variant="success">已保存为正式会话</Badge>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void onOpenConversation()}
              className="ml-auto"
            >
              <ExternalLink size={13} />
              在主窗口继续
            </Button>
          </>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            loading={promoting}
            disabled={streaming || promoting}
            onClick={() => void onPromote()}
            className="w-full"
          >
            <Save size={13} />
            保存为正式会话
          </Button>
        )}
      </div>

      {error && (
        <p role="alert" className="text-xs" style={{ color: 'var(--rc-badge-danger-text)' }}>
          {error}
        </p>
      )}
    </div>
  )
}
