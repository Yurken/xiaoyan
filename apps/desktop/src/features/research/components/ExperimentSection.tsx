/**
 * 验证方案展示与管理区域
 */
import { useState } from 'react'
import { FileText, Lock, Unlock } from 'lucide-react'
import { Card, Button } from '@research-copilot/ui'
import { Section } from './Section'
import { EXPERIMENT_STATUS_CONFIG } from '../shared'
import type { ExperimentProtocol } from '../shared'

interface ExperimentSectionProps {
  experimentProtocols: ExperimentProtocol[]
  operator: string
  onFreeze: (experimentId: string) => Promise<boolean>
}

function ExperimentCard({
  exp,
  operator,
  onFreeze,
}: {
  exp: ExperimentProtocol
  operator: string
  onFreeze: (experimentId: string) => Promise<boolean>
}) {
  const [isFreezing, setIsFreezing] = useState(false)

  const statusConfig = EXPERIMENT_STATUS_CONFIG[exp.status] ?? EXPERIMENT_STATUS_CONFIG.draft

  const handleFreeze = async () => {
    if (!operator.trim()) {
      alert('请先填写操作者签名')
      return
    }
    setIsFreezing(true)
    try {
      await onFreeze(exp.id)
    } finally {
      setIsFreezing(false)
    }
  }

  return (
    <Card variant="inset" padding="md">
      <div className="mb-2 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <FileText size={14} style={{ color: 'var(--rc-accent)' }} />
          <span className="text-sm font-medium" style={{ color: 'var(--rc-text)' }}>
            {exp.title || '未命名方案'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold"
            style={{ background: statusConfig.bg, color: statusConfig.color, borderColor: 'transparent' }}
          >
            {exp.status === 'frozen' ? <Lock size={10} /> : <Unlock size={10} />}
            {statusConfig.label}
          </span>
          {exp.status === 'draft' && (
            <Button
              variant="primary"
              size="sm"
              loading={isFreezing}
              onClick={() => void handleFreeze()}
              className="text-xs"
            >
              <Lock size={12} />
              {isFreezing ? '冻结中...' : '冻结'}
            </Button>
          )}
        </div>
      </div>

      {exp.design && (
        <p className="mb-2 text-sm" style={{ color: 'var(--rc-text-muted)' }}>
          {exp.design}
        </p>
      )}

      <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--rc-text-muted)' }}>
        <span>创建者：{exp.created_by}</span>
        <span>创建时间：{exp.created_at?.slice(0, 10)}</span>
        {exp.frozen_at && (
          <span>冻结时间：{exp.frozen_at?.slice(0, 10)}</span>
        )}
      </div>
    </Card>
  )
}

export function ExperimentSection({
  experimentProtocols,
  operator,
  onFreeze,
}: ExperimentSectionProps) {
  return (
    <Section title="验证方案" description="为采纳的候选假设设计的实验方案">
      {experimentProtocols.length === 0 ? (
        <Card variant="inset" padding="md" className="text-center">
          <p className="text-sm" style={{ color: 'var(--rc-text-muted)' }}>
            暂无验证方案，采纳候选假设后可创建
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {experimentProtocols.map((exp) => (
            <ExperimentCard
              key={exp.id}
              exp={exp}
              operator={operator}
              onFreeze={onFreeze}
            />
          ))}
        </div>
      )}
    </Section>
  )
}
