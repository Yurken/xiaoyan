import { Loader2 } from 'lucide-react'
import type { SaveState } from './useSettingsPersistence'

interface SettingsSaveStatusProps {
  state: SaveState
  error?: string
  reloadRequired?: boolean
  replacementActive?: boolean
  onRetry?: () => void
}

export default function SettingsSaveStatus({ state, error, reloadRequired, replacementActive, onRetry }: SettingsSaveStatusProps) {
  if (state === 'error') {
    return (
      <div className="flex items-center gap-2 text-xs text-apple-red" role="alert">
        <span title={error}>{reloadRequired ? '配置已导入，重新读取失败。请重新读取后继续编辑。' : '保存失败，改动尚未保存'}</span>
        {onRetry && <button type="button" className="underline" onClick={onRetry}>{reloadRequired ? '重新读取' : '重试保存'}</button>}
      </div>
    )
  }
  return (
    <span
      role="status"
      className="flex items-center gap-1 whitespace-nowrap text-xs font-medium text-ink-tertiary"
      style={state === 'saved' ? { color: '#1f9d4d' } : undefined}
      title="设置改动会自动保存"
    >
      {state === 'saving' && <Loader2 className="h-3 w-3 animate-spin" />}
      {replacementActive ? (reloadRequired ? '正在重新读取配置，完成前暂停编辑…' : '正在导入配置，完成前暂停编辑…') : state === 'saving' ? '保存中…' : state === 'saved' ? '已保存' : '自动保存'}
    </span>
  )
}
