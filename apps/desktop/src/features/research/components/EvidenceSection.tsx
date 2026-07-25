/**
 * 证据与文献展示区域
 */
import { FileText, ExternalLink } from 'lucide-react'
import { Section } from './Section'
import { SOURCE_TYPE_LABEL, formatAuthors } from '../shared'
import type { Paper, EvidenceClaim } from '../shared'

interface EvidenceSectionProps {
  papers: Paper[]
  evidenceClaims: EvidenceClaim[]
}

export function EvidenceSection({ papers, evidenceClaims }: EvidenceSectionProps) {
  return (
    <Section
      title="证据与文献"
      description="系统检索到的文献和提取的证据"
    >
      {/* 证据声明 */}
      <div className="mb-4">
        <div className="mb-2 text-xs font-medium" style={{ color: 'var(--rc-text-muted)' }}>
          证据声明 ({evidenceClaims.length})
        </div>
        {evidenceClaims.length === 0 ? (
          <div className="rc-focus-card-inset rounded-xl p-4 text-center">
            <p className="text-sm" style={{ color: 'var(--rc-text-muted)' }}>
              等待工作流运行后提取证据
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {evidenceClaims.map((claim) => (
              <div
                key={claim.id}
                className="rc-focus-card-inset rounded-xl p-3"
              >
                <div className="mb-1 flex items-center gap-2">
                  <span
                    className="rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{
                      background: 'var(--rc-info-chip-bg)',
                      color: 'var(--rc-info-chip-text)',
                    }}
                  >
                    {SOURCE_TYPE_LABEL[claim.source_type] ?? claim.source_type}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--rc-text-muted)' }}>
                    {claim.source_title}
                  </span>
                </div>
                <p className="text-sm" style={{ color: 'var(--rc-text)' }}>
                  {claim.statement}
                </p>
                {claim.quote && (
                  <blockquote
                    className="mt-2 border-l-2 pl-3 text-xs italic"
                    style={{
                      borderColor: 'var(--rc-accent)',
                      color: 'var(--rc-text-muted)',
                    }}
                  >
                    {claim.quote}
                  </blockquote>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 参考文献 */}
      <div>
        <div className="mb-2 text-xs font-medium" style={{ color: 'var(--rc-text-muted)' }}>
          参考文献 ({papers.length})
        </div>
        {papers.length === 0 ? (
          <div className="rc-focus-card-inset rounded-xl p-4 text-center">
            <p className="text-sm" style={{ color: 'var(--rc-text-muted)' }}>
              等待工作流运行后检索文献
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {papers.map((paper) => (
              <div
                key={paper.id}
                className="rc-focus-card-inset flex items-start gap-3 rounded-xl p-3"
              >
                <FileText
                  size={16}
                  className="mt-0.5 flex-shrink-0"
                  style={{ color: 'var(--rc-accent)' }}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium" style={{ color: 'var(--rc-text)' }}>
                    {paper.title}
                  </div>
                  <div className="mt-0.5 text-xs" style={{ color: 'var(--rc-text-muted)' }}>
                    {formatAuthors(paper.authors)}
                    {' · '}
                    {paper.year}
                    {paper.journal ? ` · ${paper.journal}` : ''}
                  </div>
                  {paper.abstract && (
                    <p className="mt-1 line-clamp-2 text-xs" style={{ color: 'var(--rc-text-muted)' }}>
                      {paper.abstract}
                    </p>
                  )}
                </div>
                {paper.url && (
                  <a
                    href={paper.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0"
                    style={{ color: 'var(--rc-accent)' }}
                  >
                    <ExternalLink size={14} />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Section>
  )
}
