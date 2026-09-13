import type { ActionResultMetadata } from '../shared'

interface AssistantResultMetadataProps {
  metadata?: ActionResultMetadata
}

const KNOWLEDGE_SOURCE_LABEL = {
  paper: '论文',
  note: '知识笔记',
  wiki: '内部 Wiki',
} as const

export function AssistantResultMetadata({ metadata }: AssistantResultMetadataProps) {
  if (!metadata) return null

  return (
    <>
      {metadata.sourceDetails && metadata.sourceDetails.length > 0 ? (
        <div
          className="mb-3 rounded-xl border px-3 py-2 text-xs"
          style={{
            borderColor: 'var(--rc-border)',
            color: 'var(--rc-text-muted)',
          }}
        >
          <div className="mb-1 font-medium" style={{ color: 'var(--rc-text)' }}>
            本地知识
            {metadata.knowledgeTheme && ` · ${metadata.knowledgeTheme}`}
          </div>
          <ul aria-label="本地知识引用来源" className="space-y-1">
            {metadata.sourceDetails.map((source) => (
              <li key={`${source.sourceType}:${source.sourceId}`} className="flex gap-1.5">
                <span className="shrink-0">
                  {KNOWLEDGE_SOURCE_LABEL[source.sourceType]}
                </span>
                <span className="min-w-0 break-words" style={{ color: 'var(--rc-text)' }}>
                  {source.title}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : metadata.sources && metadata.sources.length > 0 ? (
        <div className="mb-3 text-xs" style={{ color: 'var(--rc-text-muted)' }}>
          引用：{metadata.sources.join(', ')}
        </div>
      ) : null}

      <div className="mb-3 flex flex-wrap gap-x-3 gap-y-1 text-xs" style={{ color: 'var(--rc-text-muted)' }}>
        {metadata.model && <span>模型：{metadata.model}</span>}
        {metadata.tokenUsage !== undefined && (
          <span>
            {metadata.tokenUsageEstimated ? '约 ' : ''}
            {metadata.tokenUsage.toLocaleString()} Token
          </span>
        )}
        {metadata.duration !== undefined && (
          <span>耗时：{(metadata.duration / 1000).toFixed(1)}s</span>
        )}
      </div>
    </>
  )
}
