/**
 * 研究问题定义区域
 */
import { useState } from 'react'
import { Save, Edit3 } from 'lucide-react'
import { Button, Card, Input, Textarea } from '@research-copilot/ui'
import { Section } from './Section'
import type { PredictionWindow, ResearchProtocol } from '../shared'

interface ProblemSectionProps {
  protocol: ResearchProtocol | null
  onSave: (payload: {
    research_question: string
    prediction_cutoff: string
    prediction_window: PredictionWindow
    allowed_sources: string[]
    data_license: string
    success_metrics: string[]
  }) => Promise<ResearchProtocol | null>
}

export function ProblemSection({ protocol, onSave }: ProblemSectionProps) {
  const [editing, setEditing] = useState(false)
  const [researchQuestion, setResearchQuestion] = useState(protocol?.research_question ?? '')
  const [predictionCutoff, setPredictionCutoff] = useState(protocol?.prediction_cutoff ?? '')
  const [predictionWindow, setPredictionWindow] = useState<PredictionWindow>(
    protocol?.prediction_window ?? { start: '', end: '' }
  )
  const [allowedSources, setAllowedSources] = useState(
    protocol?.allowed_sources?.join(', ') ?? 'arxiv, semantic_scholar'
  )
  const [dataLicense, setDataLicense] = useState(protocol?.data_license ?? 'CC-BY-4.0')
  const [successMetrics, setSuccessMetrics] = useState(
    protocol?.success_metrics?.join(', ') ?? 'novelty, feasibility, evidence_quality'
  )
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const result = await onSave({
        research_question: researchQuestion,
        prediction_cutoff: predictionCutoff,
        prediction_window: predictionWindow,
        allowed_sources: allowedSources.split(',').map((s) => s.trim()).filter(Boolean),
        data_license: dataLicense,
        success_metrics: successMetrics.split(',').map((s) => s.trim()).filter(Boolean),
      })
      if (result) {
        setEditing(false)
      }
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Section title="研究问题" description="定义研究问题和协议参数">
      {!protocol && !editing ? (
        <Card variant="inset" padding="md" className="text-center">
          <p className="text-sm" style={{ color: 'var(--rc-text-muted)' }}>
            尚未设置研究协议，点击编辑开始配置
          </p>
          <Button variant="primary" size="sm" onClick={() => setEditing(true)} className="mt-3">
            <Edit3 size={14} />
            编辑协议
          </Button>
        </Card>
      ) : editing ? (
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--rc-text-muted)' }}>
              研究问题
            </label>
            <Textarea
              value={researchQuestion}
              onChange={(e) => setResearchQuestion(e.target.value)}
              rows={3}
              placeholder="描述你的研究问题..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--rc-text-muted)' }}>
                预测截止日期
              </label>
              <Input
                type="date"
                value={predictionCutoff}
                onChange={(e) => setPredictionCutoff(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--rc-text-muted)' }}>
                预测窗口
              </label>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={predictionWindow.start}
                  onChange={(e) => setPredictionWindow({ ...predictionWindow, start: e.target.value })}
                />
                <Input
                  type="date"
                  value={predictionWindow.end}
                  onChange={(e) => setPredictionWindow({ ...predictionWindow, end: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--rc-text-muted)' }}>
                允许来源
              </label>
              <Input
                value={allowedSources}
                onChange={(e) => setAllowedSources(e.target.value)}
                placeholder="arxiv, semantic_scholar"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--rc-text-muted)' }}>
                数据许可证
              </label>
              <Input
                value={dataLicense}
                onChange={(e) => setDataLicense(e.target.value)}
                placeholder="CC-BY-4.0"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--rc-text-muted)' }}>
              成功指标
            </label>
            <Input
              value={successMetrics}
              onChange={(e) => setSuccessMetrics(e.target.value)}
              placeholder="novelty, feasibility, evidence_quality"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setEditing(false)}>
              取消
            </Button>
            <Button variant="primary" size="sm" loading={isSaving} onClick={() => void handleSave()}>
              <Save size={14} />
              {isSaving ? '保存中...' : '保存'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <Card variant="inset" padding="sm">
            <div className="text-xs" style={{ color: 'var(--rc-text-muted)' }}>研究问题</div>
            <div className="mt-1 text-sm" style={{ color: 'var(--rc-text)' }}>
              {protocol?.research_question || '未设置'}
            </div>
          </Card>
          <div className="grid grid-cols-2 gap-3">
            <Card variant="inset" padding="sm">
              <div className="text-xs" style={{ color: 'var(--rc-text-muted)' }}>预测截止</div>
              <div className="mt-1 text-sm" style={{ color: 'var(--rc-text)' }}>
                {protocol?.prediction_cutoff || '未设置'}
              </div>
            </Card>
            <Card variant="inset" padding="sm">
              <div className="text-xs" style={{ color: 'var(--rc-text-muted)' }}>数据许可证</div>
              <div className="mt-1 text-sm" style={{ color: 'var(--rc-text)' }}>
                {protocol?.data_license || '未设置'}
              </div>
            </Card>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
            <Edit3 size={14} />
            编辑协议
          </Button>
        </div>
      )}
    </Section>
  )
}
