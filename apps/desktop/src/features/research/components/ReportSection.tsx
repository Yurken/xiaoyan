/**
 * 研究报告导出区域
 */
import { Download, FileText, FileCode, FileImage } from 'lucide-react'
import { Card, Button } from '@research-copilot/ui'
import { Section } from './Section'
import { exportUrl } from '../services/backend'
import type { ResearchOutput } from '../shared'

interface ReportSectionProps {
  sessionId: string
  output: ResearchOutput | null
}

export function ReportSection({ sessionId, output }: ReportSectionProps) {
  const exportFormats = [
    { format: 'markdown' as const, label: 'Markdown', icon: FileText },
    { format: 'html' as const, label: 'HTML', icon: FileCode },
    { format: 'docx' as const, label: 'Word', icon: FileImage },
  ]

  return (
    <Section title="研究报告" description="导出研究成果">
      {!output ? (
        <Card variant="inset" padding="md" className="text-center">
          <p className="text-sm" style={{ color: 'var(--rc-text-muted)' }}>
            工作流完成后将生成研究报告
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* 报告预览 */}
          <Card variant="inset" padding="md">
            <h4 className="mb-2 text-sm font-semibold" style={{ color: 'var(--rc-text)' }}>
              {output.title || '研究标题'}
            </h4>
            {output.abstract && (
              <p className="mb-2 text-xs" style={{ color: 'var(--rc-text-muted)' }}>
                {output.abstract}
              </p>
            )}
            {output.results && (
              <div className="mt-3">
                <div className="mb-1 text-xs font-medium" style={{ color: 'var(--rc-text-muted)' }}>
                  主要结果
                </div>
                <p className="text-sm" style={{ color: 'var(--rc-text)' }}>
                  {output.results}
                </p>
              </div>
            )}
          </Card>

          {/* 导出按钮 */}
          <div>
            <div className="mb-2 text-xs font-medium" style={{ color: 'var(--rc-text-muted)' }}>
              导出格式
            </div>
            <div className="flex gap-2">
              {exportFormats.map(({ format, label, icon: Icon }) => (
                <a
                  key={format}
                  href={exportUrl(sessionId, format)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="secondary" size="sm" className="flex items-center gap-2">
                    <Icon size={14} />
                    {label}
                    <Download size={12} />
                  </Button>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </Section>
  )
}
