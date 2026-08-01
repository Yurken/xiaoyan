import { useEffect, useState } from 'react'
import { AlertTriangle, Database, Eye, Trash2 } from 'lucide-react'
import { Button, Card } from '@research-copilot/ui'
import { useAssistantDataPolicy } from '../hooks/useAssistantDataPolicy'
import type { AssistantDataPolicy } from '../shared'

type RetentionValue = '1' | '7' | '30' | 'manual'

function retentionToValue(days: AssistantDataPolicy['inbox_retention_days']): RetentionValue {
  return days === null ? 'manual' : String(days) as RetentionValue
}

function valueToRetention(value: RetentionValue): AssistantDataPolicy['inbox_retention_days'] {
  return value === 'manual' ? null : Number(value) as 1 | 7 | 30
}

export function AssistantDataPolicySection() {
  const dataPolicy = useAssistantDataPolicy()
  const [previewRequired, setPreviewRequired] = useState(true)
  const [retention, setRetention] = useState<RetentionValue>('7')
  const [message, setMessage] = useState<string | null>(null)
  const [clearArmed, setClearArmed] = useState(false)
  const [privateClearArmed, setPrivateClearArmed] = useState(false)

  useEffect(() => {
    setPreviewRequired(dataPolicy.policy.preview_required)
    setRetention(retentionToValue(dataPolicy.policy.inbox_retention_days))
  }, [dataPolicy.policy])

  const changed =
    previewRequired !== dataPolicy.policy.preview_required
    || valueToRetention(retention) !== dataPolicy.policy.inbox_retention_days

  const save = async () => {
    setMessage(null)
    const saved = await dataPolicy.save({
      preview_required: previewRequired,
      inbox_retention_days: valueToRetention(retention),
    })
    if (saved) setMessage('预览与保留策略已保存')
  }

  const clearLaterItems = async () => {
    if (!clearArmed) {
      setClearArmed(true)
      setPrivateClearArmed(false)
      setMessage('再次点击以确认清空稍后处理箱')
      return
    }
    const count = await dataPolicy.clearLaterItems()
    setClearArmed(false)
    if (count !== null) setMessage(`已清理 ${count} 条稍后处理内容`)
  }

  const clearPrivateData = async () => {
    if (!privateClearArmed) {
      setPrivateClearArmed(true)
      setClearArmed(false)
      setMessage('再次点击以确认清除临时上下文、悬浮会话和全部已保存图片')
      return
    }
    const result = await dataPolicy.clearPrivateData()
    setPrivateClearArmed(false)
    if (result) {
      setMessage(
        `已清除 ${result.capture_sessions} 个采集上下文、${result.image_assets} 个图片资产`
        + (result.cancelled_actions > 0 ? `，并停止 ${result.cancelled_actions} 个生成任务` : ''),
      )
    }
  }

  return (
    <Card padding="md" className="space-y-4">
      <div className="flex items-start gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ background: 'rgba(175,82,222,0.12)', color: '#AF52DE' }}
        >
          <Database className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-base font-semibold text-ink-primary">预览与临时数据</h2>
          <p className="text-xs leading-5 text-ink-tertiary">
            未确认采集会话始终最多保留 24 小时且不保存正文；以下期限只用于你主动放入的稍后处理箱。
          </p>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div
          className="rounded-3xl px-4 py-4"
          style={{
            background: 'var(--rc-chip-inset-bg)',
            boxShadow: 'var(--rc-chip-inset-shadow)',
          }}
        >
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-[var(--rc-accent)]" />
            <p className="text-sm font-semibold text-ink-primary">发送前预览</p>
          </div>
          <label className="mt-3 flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              aria-label="每次发送前显示完整预览"
              checked={previewRequired}
              onChange={(event) => setPreviewRequired(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded"
            />
            <span>
              <span className="block text-sm text-ink-primary">每次发送前显示完整预览</span>
              <span className="mt-1 block text-xs leading-5 text-ink-secondary">
                关闭后，选区、剪贴板和截图会直接进入动作选择；手动粘贴仍需确认输入完成。
              </span>
            </span>
          </label>
          {!previewRequired && (
            <p
              role="status"
              className="mt-3 flex gap-2 rounded-2xl px-3 py-2 text-xs leading-5"
              style={{
                background: 'var(--rc-badge-warning-bg)',
                color: 'var(--rc-badge-warning-text)',
              }}
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              跳过完整预览会减少发送前检查机会；隐私阻断和内容脱敏仍然生效。
            </p>
          )}
        </div>

        <div
          className="rounded-3xl px-4 py-4"
          style={{
            background: 'var(--rc-chip-inset-bg)',
            boxShadow: 'var(--rc-chip-inset-shadow)',
          }}
        >
          <label
            htmlFor="assistant-inbox-retention"
            className="text-sm font-semibold text-ink-primary"
          >
            稍后处理箱保留策略
          </label>
          <p className="mt-1 text-xs leading-5 text-ink-secondary">
            到期项目由启动及每小时清理任务移除，正式笔记和图片资产不受影响。
          </p>
          <select
            id="assistant-inbox-retention"
            value={retention}
            onChange={(event) => setRetention(event.target.value as RetentionValue)}
            className="mt-3 w-full rounded-2xl border px-3 py-2 text-sm outline-none"
            style={{
              background: 'var(--rc-control-bg)',
              borderColor: 'var(--rc-control-border)',
              color: 'var(--rc-text)',
              boxShadow: 'var(--rc-control-shadow)',
            }}
          >
            <option value="1">保留 1 天</option>
            <option value="7">保留 7 天（默认）</option>
            <option value="30">保留 30 天</option>
            <option value="manual">仅手动清理</option>
          </select>
          <Button
            type="button"
            variant={clearArmed ? 'danger' : 'secondary'}
            size="sm"
            loading={dataPolicy.clearing}
            className="mt-3"
            onClick={() => void clearLaterItems()}
          >
            <Trash2 className="h-4 w-4" />
            {clearArmed ? '确认清空稍后处理箱' : '立即清理稍后处理箱'}
          </Button>
        </div>
      </div>

      <div
        className="rounded-3xl border px-4 py-4"
        style={{
          borderColor: 'color-mix(in srgb, var(--rc-danger, #FF3B30) 32%, transparent)',
          background: 'color-mix(in srgb, var(--rc-danger, #FF3B30) 6%, var(--rc-card-bg))',
        }}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-ink-primary">清除助手私有数据</p>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-ink-secondary">
              清除当前捕获上下文、临时多轮会话、未确认的拖入预览和全部已保存图片，并停止正在生成的助手任务。不会删除稍后处理箱、知识笔记及附件、论文、正式聊天或你的原文件。
            </p>
          </div>
          <Button
            type="button"
            variant="danger"
            size="sm"
            loading={dataPolicy.clearingPrivateData}
            className="shrink-0"
            onClick={() => void clearPrivateData()}
          >
            <Trash2 className="h-4 w-4" />
            {privateClearArmed ? '确认清除助手私有数据' : '一键清除助手私有数据'}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div aria-live="polite">
          {dataPolicy.loading && <p className="text-xs text-ink-tertiary">正在读取策略…</p>}
          {dataPolicy.error && (
            <p role="alert" className="text-xs text-red-500">{dataPolicy.error}</p>
          )}
          {!dataPolicy.error && message && (
            <p className="text-xs text-green-600">{message}</p>
          )}
        </div>
        <Button
          type="button"
          size="sm"
          loading={dataPolicy.saving}
          disabled={dataPolicy.loading || !changed}
          onClick={() => void save()}
        >
          保存数据策略
        </Button>
      </div>
    </Card>
  )
}
