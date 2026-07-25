/**
 * 桌面悬浮助手共享层：类型、常量、纯函数
 * @module features/desktop-assistant/shared
 */

// ─── 动作类型 ──────────────────────────────────────────────────────────────

/** 助手支持的动作 */
export type AssistantAction = 'interpret' | 'translate' | 'chat' | 'import'

/** 动作配置 */
export interface ActionConfig {
  id: AssistantAction
  label: string
  icon: string
  description: string
}

/** 首发动作列表 */
export const ASSISTANT_ACTIONS: ActionConfig[] = [
  { id: 'interpret', label: '解读', icon: 'BookOpen', description: '学术解读、通俗解释、图表说明' },
  { id: 'translate', label: '翻译', icon: 'Languages', description: '双语翻译、术语对照' },
  { id: 'chat', label: '对话', icon: 'MessageSquare', description: '基于上下文继续追问' },
  { id: 'import', label: '导入', icon: 'Download', description: '保存为笔记、图片资产' },
]

// ─── 上下文来源 ──────────────────────────────────────────────────────────────

/** 上下文来源类型 */
export type ContextSourceType = 'selection' | 'clipboard' | 'screenshot' | 'paste'

/** 来源配置 */
export interface SourceConfig {
  type: ContextSourceType
  label: string
  icon: string
  description: string
}

/** 上下文来源列表 */
export const CONTEXT_SOURCES: SourceConfig[] = [
  { type: 'selection', label: '选中文本', icon: 'TextCursorInput', description: '从辅助功能读取' },
  { type: 'clipboard', label: '剪贴板', icon: 'Clipboard', description: '当前剪贴板内容' },
  { type: 'screenshot', label: '截图', icon: 'Camera', description: '框选屏幕区域' },
  { type: 'paste', label: '粘贴', icon: 'Paste', description: '手动粘贴内容' },
]

// ─── 状态类型 ──────────────────────────────────────────────────────────────

/** 采集状态 */
export type CaptureStatus = 'idle' | 'capturing' | 'ready' | 'processing' | 'error'

/** 助手面板状态 */
export type PanelStatus = 'hidden' | 'loading' | 'ready' | 'error'

// ─── 数据模型 ──────────────────────────────────────────────────────────────

/** 采集会话 */
export interface CaptureSession {
  id: string
  sourceType: ContextSourceType
  content: string | null
  screenshotPath: string | null
  sourceApp: string | null
  sourceAppBundleId: string | null
  windowTitle: string | null
  createdAt: number
  expiresAt: number
  status: CaptureStatus
  userConfirmed: boolean
}

/** 动作结果 */
export interface ActionResult {
  id: string
  sessionId: string
  action: AssistantAction
  content: string
  format: 'text' | 'markdown' | 'html'
  metadata?: ActionResultMetadata
  createdAt: number
}

/** 动作结果元数据 */
export interface ActionResultMetadata {
  model?: string
  tokenUsage?: number
  duration?: number
  sources?: string[]
}

/** 导入目标 */
export type ImportTarget = 'note' | 'image' | 'paper' | 'later'

/** 导入配置 */
export interface ImportConfig {
  target: ImportTarget
  title?: string
  tags?: string[]
  researchThemeId?: string
  preserveOriginal: boolean
}

// ─── 偏好设置 ──────────────────────────────────────────────────────────────

/** 助手偏好设置 */
export interface AssistantPreferences {
  enabled: boolean
  shortcut: string
  showDock: boolean
  dockPosition: 'left' | 'right' | 'bottom'
  allowedApps: string[]
  blockedApps: string[]
  skipPreview: boolean
  retainPolicy: 'session' | '24h' | 'permanent'
  language: 'zh' | 'en' | 'auto'
}

/** 默认偏好设置 */
export const DEFAULT_PREFERENCES: AssistantPreferences = {
  enabled: true,
  shortcut: 'Alt+Space',
  showDock: true,
  dockPosition: 'right',
  allowedApps: [],
  blockedApps: [
    'com.apple.Keychain',
    'com.1password.1password',
    'com.agilebits.onepassword7',
  ],
  skipPreview: false,
  retainPolicy: '24h',
  language: 'auto',
}

// ─── 状态映射 ──────────────────────────────────────────────────────────────

/** 采集状态标签 */
export const CAPTURE_STATUS_LABEL: Record<CaptureStatus, string> = {
  idle: '就绪',
  capturing: '采集中...',
  ready: '已获取',
  processing: '处理中...',
  error: '获取失败',
}

/** 面板状态标签 */
export const PANEL_STATUS_LABEL: Record<PanelStatus, string> = {
  hidden: '隐藏',
  loading: '加载中',
  ready: '就绪',
  error: '错误',
}

// ─── 纯函数 ──────────────────────────────────────────────────────────────

/**
 * 生成唯一 ID
 */
export function generateId(): string {
  return `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * 检查应用是否在禁止列表中
 */
export function isAppBlocked(bundleId: string | null, blockedApps: string[]): boolean {
  if (!bundleId) return false
  return blockedApps.some((blocked) => bundleId.toLowerCase().includes(blocked.toLowerCase()))
}

/**
 * 截断文本
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - 3) + '...'
}

/**
 * 格式化时间戳
 */
export function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', {
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * 计算过期时间
 */
export function calculateExpiry(retainPolicy: 'session' | '24h' | 'permanent'): number {
  const now = Date.now()
  switch (retainPolicy) {
    case 'session':
      return now + 60 * 60 * 1000 // 1 小时
    case '24h':
      return now + 24 * 60 * 60 * 1000 // 24 小时
    case 'permanent':
      return Infinity
  }
}
