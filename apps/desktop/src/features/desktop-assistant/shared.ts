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
    'com.apple.loginwindow',
    'com.apple.SystemPreferences',
  ],
  skipPreview: false,
  retainPolicy: '24h',
  language: 'auto',
}

// ─── 隐私与安全 ──────────────────────────────────────────────────────────────

/** 默认禁止采集的应用 */
export const DEFAULT_BLOCKED_APPS: string[] = [
  // 密码管理器
  'com.1password.1password',
  'com.agilebits.onepassword7',
  'com.agilebits.onepassword',
  'com.bitwarden.desktop',
  'com.keepersecurity.keeper',
  // 系统安全
  'com.apple.Keychain',
  'com.apple.securityagent',
  'com.apple.loginwindow',
  // 金融应用
  'com.apple.bank',
  'com.alipay.mac',
  'com.tencent.macWeChat',
  // DRM
  'com.apple.TV',
  'com.apple.iTunes',
]

/** 禁止采集的窗口标题关键词 */
export const BLOCKED_WINDOW_KEYWORDS: string[] = [
  '密码',
  'password',
  '登录',
  'login',
  'sign in',
  '认证',
  'auth',
  '支付',
  'payment',
  '银行',
  'bank',
]

/** 敏感字段检测模式 */
export const SENSITIVE_FIELD_PATTERNS: RegExp[] = [
  /password/i,
  /passwd/i,
  /secret/i,
  /token/i,
  /api.?key/i,
  /access.?key/i,
  /private.?key/i,
]

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
 * 检查窗口标题是否包含敏感关键词
 */
export function isWindowBlocked(windowTitle: string | null, keywords: string[]): boolean {
  if (!windowTitle) return false
  const lowerTitle = windowTitle.toLowerCase()
  return keywords.some((keyword) => lowerTitle.includes(keyword.toLowerCase()))
}

/**
 * 检测内容是否包含敏感字段
 */
export function containsSensitiveFields(content: string): boolean {
  return SENSITIVE_FIELD_PATTERNS.some((pattern) => pattern.test(content))
}

/**
 * 脱敏处理：移除敏感内容
 */
export function sanitizeContent(content: string): string {
  let sanitized = content

  // 移除邮箱地址
  sanitized = sanitized.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]')

  // 移除电话号码
  sanitized = sanitized.replace(/(\+?86)?1[3-9]\d{9}/g, '[PHONE]')
  sanitized = sanitized.replace(/\d{3}-\d{4}-\d{4}/g, '[PHONE]')

  // 移除信用卡号
  sanitized = sanitized.replace(/\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/g, '[CARD]')

  // 移除身份证号
  sanitized = sanitized.replace(/\d{17}[\dXx]/g, '[ID]')

  return sanitized
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

/** The independent assistant window and its root card are one visual surface. */
export const ASSISTANT_WINDOW_CARD_STYLE = {
  border: 'none',
  borderRadius: 0,
  boxShadow: 'none',
} as const
