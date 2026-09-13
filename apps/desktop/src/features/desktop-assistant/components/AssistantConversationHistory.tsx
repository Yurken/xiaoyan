import { MarkdownRenderer } from '@research-copilot/ui'
import type { AssistantSessionMessage } from '../shared'

interface AssistantConversationHistoryProps {
  messages: AssistantSessionMessage[]
}

export function AssistantConversationHistory({
  messages,
}: AssistantConversationHistoryProps) {
  if (messages.length === 0) return null

  return (
    <div aria-label="临时会话历史" className="mb-3 space-y-2">
      {messages.map((message) => (
        <div
          key={message.id}
          className={message.role === 'user' ? 'flex justify-end' : ''}
        >
          <div
            className={
              message.role === 'user'
                ? 'max-w-[88%] rounded-2xl px-3 py-2 text-xs'
                : 'rounded-2xl border px-3 py-2 text-xs'
            }
            style={message.role === 'user'
              ? {
                  background: 'var(--rc-info-chip-bg)',
                  color: 'var(--rc-info-chip-text)',
                }
              : {
                  borderColor: 'var(--rc-border)',
                  color: 'var(--rc-text)',
                }}
          >
            {message.role === 'assistant' ? (
              <MarkdownRenderer
                content={message.content}
                className="text-xs prose-headings:my-1 prose-headings:text-xs prose-p:my-1"
              />
            ) : (
              <span className="whitespace-pre-wrap">{message.content}</span>
            )}
            {message.role === 'assistant'
              && message.metadata?.sourceDetails
              && message.metadata.sourceDetails.length > 0 && (
              <p className="mt-1 text-[10px]" style={{ color: 'var(--rc-text-muted)' }}>
                来源：{message.metadata.sourceDetails.map((source) => source.title).join('、')}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
