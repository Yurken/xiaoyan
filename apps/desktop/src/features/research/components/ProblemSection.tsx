/**
 * 研究问题定义区域
 */
import { useState } from 'react'
import { Save, Edit3 } from 'lucide-react'
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
    <Section
      title="研究问题"
      description="定义研究问题和协议参数"
    >
      {!protocol && !editing ? (
        <div className="rc-focus-card-inset rounded-xl p-4 text-center">
          <p className="text-sm" style={{ color: 'var(--rc-text-muted)' }}>
            尚未设置研究协议，点击编辑开始配置
          </p>
          <button
            onClick={() => setEditing(true)}
            className="rc-focus-cta mt-3"
          >
            <Edit3 size={14} />
            编辑协议
          </button>
        </div>
      ) : editing ? (
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--rc-text-muted)' }}>
              研究问题
            </label>
            <textarea
              value={researchQuestion}
              onChange={(e) => setResearchQuestion(e.target.value)}
              rows={3}
              className="w-full rounded-xl px-3 py-2 text-sm"
              style={{
                background: 'var(--rc-control-bg)',
                border: '1px solid var(--rc-control-border)',
                color: 'var(--rc-text)',
                boxShadow: 'var(--rc-chip-inset-shadow)',
              }}
              placeholder="描述你的研究问题..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--rc-text-muted)' }}>
                预测截止日期
              </label>
              <input
                type="date"
                value={predictionCutoff}
                onChange={(e) => setPredictionCutoff(e.target.value)}
                className="w-full rounded-xl px-3 py-2 text-sm"
                style={{
                  background: 'var(--rc-control-bg)',
                  border: '1px solid var(--rc-control-border)',
                  color: 'var(--rc-text)',
                  boxShadow: 'var(--rc-chip-inset-shadow)',
                }}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--rc-text-muted)' }}>
                预测窗口
              </label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={predictionWindow.start}
                  onChange={(e) => setPredictionWindow({ ...predictionWindow, start: e.target.value })}
                  className="flex-1 rounded-xl px-3 py-2 text-sm"
                  style={{
                    background: 'var(--rc-control-bg)',
                    border: '1px solid var(--rc-control-border)',
                    color: 'var(--rc-text)',
                    boxShadow: 'var(--rc-chip-inset-shadow)',
                  }}
                />
                <input
                  type="date"
                  value={predictionWindow.end}
                  onChange={(e) => setPredictionWindow({ ...predictionWindow, end: e.target.value })}
                  className="flex-1 rounded-xl px-3 py-2 text-sm"
                  style={{
                    background: 'var(--rc-control-bg)',
                    border: '1px solid var(--rc-control-border)',
                    color: 'var(--rc-text)',
                    boxShadow: 'var(--rc-chip-inset-shadow)',
                  }}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--rc-text-muted)' }}>
                允许来源
              </label>
              <input
                type="text"
                value={allowedSources}
                onChange={(e) => setAllowedSources(e.target.value)}
                className="w-full rounded-xl px-3 py-2 text-sm"
                style={{
                  background: 'var(--rc-control-bg)',
                  border: '1px solid var(--rc-control-border)',
                  color: 'var(--rc-text)',
                  boxShadow: 'var(--rc-chip-inset-shadow)',
                }}
                placeholder="arxiv, semantic_scholar"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--rc-text-muted)' }}>
                数据许可证
              </label>
              <input
                type="text"
                value={dataLicense}
                onChange={(e) => setDataLicense(e.target.value)}
                className="w-full rounded-xl px-3 py-2 text-sm"
                style={{
                  background: 'var(--rc-control-bg)',
                  border: '1px solid var(--rc-control-border)',
                  color: 'var(--rc-text)',
                  boxShadow: 'var(--rc-chip-inset-shadow)',
                }}
                placeholder="CC-BY-4.0"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--rc-text-muted)' }}>
              成功指标
            </label>
            <input
              type="text"
              value={successMetrics}
              onChange={(e) => setSuccessMetrics(e.target.value)}
              className="w-full rounded-xl px-3 py-2 text-sm"
              style={{
                background: 'var(--rc-control-bg)',
                border: '1px solid var(--rc-control-border)',
                color: 'var(--rc-text)',
                boxShadow: 'var(--rc-chip-inset-shadow)',
              }}
              placeholder="novelty, feasibility, evidence_quality"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={() => setEditing(false)}
              className="rc-focus-btn-secondary"
            >
              取消
            </button>
            <button
              onClick={() => void handleSave()}
              disabled={isSaving}
              className="rc-focus-cta"
              style={{ opacity: isSaving ? 0.5 : 1 }}
            >
              <Save size={14} />
              {isSaving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rc-focus-card-inset rounded-xl p-3">
            <div className="text-xs" style={{ color: 'var(--rc-text-muted)' }}>研究问题</div>
            <div className="mt-1 text-sm" style={{ color: 'var(--rc-text)' }}>
              {protocol?.research_question || '未设置'}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rc-focus-card-inset rounded-xl p-3">
              <div className="text-xs" style={{ color: 'var(--rc-text-muted)' }}>预测截止</div>
              <div className="mt-1 text-sm" style={{ color: 'var(--rc-text)' }}>
                {protocol?.prediction_cutoff || '未设置'}
              </div>
            </div>
            <div className="rc-focus-card-inset rounded-xl p-3">
              <div className="text-xs" style={{ color: 'var(--rc-text-muted)' }}>数据许可证</div>
              <div className="mt-1 text-sm" style={{ color: 'var(--rc-text)' }}>
                {protocol?.data_license || '未设置'}
              </div>
            </div>
          </div>
          <button
            onClick={() => setEditing(true)}
            className="rc-focus-btn-secondary"
          >
            <Edit3 size={14} />
            编辑协议
          </button>
        </div>
      )}
    </Section>
  )
}
