import { CheckCircle2, File, FileCode2, FileText, Image, XCircle } from 'lucide-react'
import { Badge, Button, Card, CardHeader, CardTitle } from '@research-copilot/ui'
import type {
  AssistantFileCandidate,
  AssistantFileCandidateKind,
  FileCandidateInspection,
} from '../shared'
import { ASSISTANT_WINDOW_CARD_STYLE } from '../shared'

interface FileCandidateDialogProps {
  inspection: FileCandidateInspection | null
  confirmedCandidates: AssistantFileCandidate[] | null
  confirming: boolean
  error: string | null
  onConfirm: () => void
  onCancel: () => void
  onCloseConfirmation: () => void
}

const KIND_ICONS: Record<AssistantFileCandidateKind, typeof File> = {
  pdf: FileText,
  image: Image,
  markdown: FileCode2,
  text: File,
}

const TARGET_LABELS: Record<AssistantFileCandidate['recommended_target'], string> = {
  paper: '论文导入候选',
  image: '图片资产候选',
  note: '知识笔记候选',
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function CandidateList({ candidates }: { candidates: AssistantFileCandidate[] }) {
  return (
    <div className="space-y-2">
      {candidates.map((candidate) => {
        const Icon = KIND_ICONS[candidate.kind]
        return (
          <div
            key={candidate.id}
            className="flex items-start gap-3 rounded-2xl px-3 py-3"
            style={{ background: 'var(--rc-chip-inset-bg)' }}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--rc-accent)]" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink-primary">
                {candidate.file_name}
              </p>
              <p className="mt-0.5 text-xs text-ink-tertiary">
                {formatBytes(candidate.size_bytes)} · {TARGET_LABELS[candidate.recommended_target]}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function FileCandidateDialog({
  inspection,
  confirmedCandidates,
  confirming,
  error,
  onConfirm,
  onCancel,
  onCloseConfirmation,
}: FileCandidateDialogProps) {
  const confirmed = Boolean(confirmedCandidates)
  const candidates = confirmedCandidates ?? inspection?.candidates ?? []

  return (
    <Card className="w-full overflow-hidden" padding="none" style={ASSISTANT_WINDOW_CARD_STYLE}>
      <CardHeader
        data-tauri-drag-region
        className="cursor-grab px-4 py-3 active:cursor-grabbing"
        style={{ borderBottom: '1px solid var(--rc-border)' }}
      >
        <CardTitle data-tauri-drag-region className="text-sm">
          {confirmed ? '文件候选已创建' : '确认文件候选'}
        </CardTitle>
        <Badge variant={confirmed ? 'success' : 'warning'}>
          {confirmed ? '已确认' : '待确认'}
        </Badge>
      </CardHeader>

      <div className="space-y-4 p-4">
        {confirmed ? (
          <div
            className="flex items-start gap-3 rounded-2xl px-3 py-3"
            style={{ background: 'var(--rc-badge-success-bg)' }}
          >
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
            <p className="text-xs leading-5 text-ink-secondary">
              已创建 {candidates.length} 个待导入候选。PDF 将进入论文候选，其余文件等待在后续导入工作台确认内容与归档位置。
            </p>
          </div>
        ) : (
          <p className="text-xs leading-5 text-ink-secondary">
            仅创建导入候选，不会立即解析、上传、移动或修改原文件。确认后候选保留 24 小时。
          </p>
        )}

        <CandidateList candidates={candidates} />

        {!confirmed && inspection && inspection.rejected.length > 0 && (
          <div
            role="status"
            className="space-y-1 rounded-2xl px-3 py-3"
            style={{ background: 'var(--rc-badge-danger-bg)' }}
          >
            {inspection.rejected.map((rejected) => (
              <p
                key={`${rejected.file_name}:${rejected.reason}`}
                className="flex items-start gap-2 text-xs leading-5"
                style={{ color: 'var(--rc-badge-danger-text)' }}
              >
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{rejected.file_name}：{rejected.reason}</span>
              </p>
            ))}
          </div>
        )}

        {error && <p role="alert" className="text-xs text-red-500">{error}</p>}

        {confirmed ? (
          <Button type="button" size="sm" className="w-full" onClick={onCloseConfirmation}>
            完成
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              className="flex-1"
              loading={confirming}
              disabled={candidates.length === 0}
              onClick={onConfirm}
            >
              确认创建候选
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="flex-1"
              disabled={confirming}
              onClick={onCancel}
            >
              取消
            </Button>
          </div>
        )}
      </div>
    </Card>
  )
}
