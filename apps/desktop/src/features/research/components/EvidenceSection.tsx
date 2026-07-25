/**
 * 证据与文献展示区域
 */
import { FileText, ExternalLink } from 'lucide-react'
import { Card, Badge } from '@research-copilot/ui'
import { Section } from './Section'
import { SOURCE_TYPE_LABEL, formatAuthors } from '../shared'
import type { Paper, EvidenceClaim } from '../shared'

interface EvidenceSectionProps {
  papers: Paper[]
  evidenceClaims: EvidenceClaim[]
}

export function EvidenceSection({ papers, evidenceClaims }: EvidenceSectionProps) {
  return (
    <Section title="证据与文献" description="系统检索到的文献和提取的证据">
      {/* 证据声明 */}
      <div className="mb-4">
        <div className="mb-2 text-xs font-medium" style={{ color: 'var(--rc-text-muted)' }}>
          证据声明 ({evidenceClaims.length})
        </div>
        {evidenceClaims.length === 0 ? (
          <Card variant="inset" padding="md" className="text-center">
            <p className="text-sm" style={{ color: 'var(--rc-text-muted)' }}>
              等待工作流运行后提取证据
            </p>
          </Card>
        ) : (
          <div className="space-y-2">
            {evidenceClaims.map((claim) => (
              <Card key={claim.id} variant="inset" padding="sm">
                <div className="mb-1 flex items-center gap-2">
                  <Badge variant="info">{SOURCE_TYPE_LABEL[claim.source_type] ?? claim.source_type}</Badge>
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
              </Card>
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
          <Card variant="inset" padding="md" className="text-center">
            <p className="text-sm" style={{ color: 'var(--rc-text-muted)' }}>
              等待工作流运行后检索文献
            </p>
          </Card>
        ) : (
          <div className="space-y-2">
            {papers.map((paper) => (
              <Card key={paper.id} variant="inset" padding="sm" className="flex items-start gap-3">
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
              </Card>
            ))}
          </div>
        )}
      </div>
    </Section>
  )
}
