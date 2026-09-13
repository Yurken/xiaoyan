/**
 * 小妍桌面助手共享层：类型、常量、纯函数
 * @module features/desktop-assistant/shared
 */

// ─── 动作类型 ──────────────────────────────────────────────────────────────

/** 助手支持的动作 */
export type AssistantAction = 'interpret' | 'translate' | 'chat' | 'import'

/** 解读模板；默认 academic。 */
export type AssistantInterpretMode = 'academic' | 'plain' | 'figure' | 'code'
export type AssistantTranslationTargetLanguage = 'zh' | 'en' | 'ja' | 'de' | 'fr'
export type AssistantTerminologyStyle = 'bilingual' | 'translated' | 'original'

export interface AssistantActionOptions {
  question?: string
  interpretMode?: AssistantInterpretMode
  targetLanguage?: AssistantTranslationTargetLanguage
  terminologyStyle?: AssistantTerminologyStyle
  localKnowledgeEnabled?: boolean
  knowledgeThemeId?: string
}

export const ASSISTANT_INTERPRET_MODES: ReadonlyArray<{
  value: AssistantInterpretMode
  label: string
}> = [
  { value: 'academic', label: '学术' },
  { value: 'plain', label: '通俗' },
  { value: 'figure', label: '图表' },
  { value: 'code', label: '代码/报错' },
]

export const ASSISTANT_TRANSLATION_LANGUAGES: ReadonlyArray<{
  value: AssistantTranslationTargetLanguage
  label: string
}> = [
  { value: 'zh', label: '中文' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
  { value: 'de', label: 'Deutsch' },
  { value: 'fr', label: 'Français' },
]

export const ASSISTANT_TERMINOLOGY_STYLES: ReadonlyArray<{
  value: AssistantTerminologyStyle
  label: string
}> = [
  { value: 'bilingual', label: '双语术语' },
  { value: 'translated', label: '译文优先' },
  { value: 'original', label: '原文术语' },
]

/** 动作配置 */
export interface ActionConfig {
  id: AssistantAction
  label: string
  icon: string
  description: string
  maxCharacters: number
}

export const ASSISTANT_ACTION_CHARACTER_LIMITS: Record<AssistantAction, number> = {
  interpret: 12_000,
  translate: 20_000,
  chat: 16_000,
  import: 50_000,
}

export const MAX_ASSISTANT_CAPTURE_CHARACTERS = 50_000

/** 首发动作列表 */
export const ASSISTANT_ACTIONS: ActionConfig[] = [
  {
    id: 'interpret',
    label: '解读',
    icon: 'BookOpen',
    description: '学术解读、通俗解释、图表说明',
    maxCharacters: ASSISTANT_ACTION_CHARACTER_LIMITS.interpret,
  },
  {
    id: 'translate',
    label: '翻译',
    icon: 'Languages',
    description: '双语翻译、术语对照',
    maxCharacters: ASSISTANT_ACTION_CHARACTER_LIMITS.translate,
  },
  {
    id: 'chat',
    label: '对话',
    icon: 'MessageSquare',
    description: '基于上下文继续追问',
    maxCharacters: ASSISTANT_ACTION_CHARACTER_LIMITS.chat,
  },
  {
    id: 'import',
    label: '导入',
    icon: 'Download',
    description: '保存为笔记、图片资产',
    maxCharacters: ASSISTANT_ACTION_CHARACTER_LIMITS.import,
  },
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

/** 流式动作状态；停止和失败都保留已收到的输出。 */
export type AssistantActionStreamStatus =
  | 'idle'
  | 'streaming'
  | 'completed'
  | 'stopped'
  | 'error'

export type AssistantSessionStatus =
  | 'streaming'
  | 'stopped'
  | 'completed'
  | 'failed'
  | 'promoted'

export interface AssistantSessionMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: number
  metadata?: ActionResultMetadata
}

export interface AssistantTemporarySession {
  id: string
  captureSessionId: string
  action: Exclude<AssistantAction, 'import'>
  status: AssistantSessionStatus
  researchThemeId?: string
  useLocalKnowledge: boolean
  includeCaptureContext: boolean
  translationTargetLanguage?: AssistantTranslationTargetLanguage
  messages: AssistantSessionMessage[]
  promotedConversationId?: string
}

export interface AssistantSessionHistoryMessage {
  role: 'user' | 'assistant'
  content: string
}

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
  captureRegion?: AssistantScreenshotRegion | null
  createdAt: number
  expiresAt: number
  status: CaptureStatus
  userConfirmed: boolean
  originalCharacterCount?: number
  contentTruncated?: boolean
  sensitiveRedactionKinds?: string[]
  sensitiveConfirmationArmed?: boolean
}

export interface AssistantScreenshotRegion {
  x: number | null
  y: number | null
  width: number
  height: number
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
  inputTokens?: number
  outputTokens?: number
  tokenUsageEstimated?: boolean
  duration?: number
  sources?: string[]
  sourceDetails?: AssistantKnowledgeSource[]
  knowledgeTheme?: string
}

export interface AssistantKnowledgeTheme {
  id: string
  name: string
  asset_count: number
}

export type AssistantKnowledgeSourceType = 'paper' | 'note' | 'wiki'

export interface AssistantKnowledgeSource {
  sourceType: AssistantKnowledgeSourceType
  sourceId: string
  title: string
  url?: string
}

/** 导入目标 */
export type ImportTarget = 'note' | 'image' | 'paper' | 'later'
export type ImportRetentionPolicy = 'permanent' | '1_day' | '7_days' | '30_days' | 'manual'

/** 导入配置 */
export interface ImportConfig {
  target: ImportTarget
  title?: string
  tags?: string[]
  researchThemeId?: string
  preserveOriginal: boolean
  retentionPolicy: ImportRetentionPolicy
}

export interface AssistantInboxLaterItem {
  id: string
  title: string
  content_preview: string
  research_theme_id: string | null
  research_theme_name: string | null
  source_type: string | null
  source_app: string | null
  window_title: string | null
  retention_policy: string | null
  expires_at: string | null
  created_at: string
}

export interface AssistantInboxPaperCandidate {
  id: string
  title: string
  file_name: string | null
  file_size_bytes: number | null
  has_source_file: boolean
  created_at: string
}

export interface AssistantInboxFileCandidate {
  id: string
  file_name: string
  kind: 'image' | 'markdown' | 'text'
  media_type: string
  size_bytes: number
  recommended_target: 'image' | 'note'
  expires_at: string
  created_at: string
}

export interface AssistantInboxOverview {
  later_items: AssistantInboxLaterItem[]
  paper_candidates: AssistantInboxPaperCandidate[]
  file_candidates: AssistantInboxFileCandidate[]
}

export interface AssistantInboxActionResult {
  target: 'note' | 'image' | 'paper'
  target_id: string
}

export interface AssistantImageAsset {
  id: string
  media_type: string
  size_bytes: number
  available: boolean
  created_at: string
  source_type: string | null
  source_app: string | null
  source_app_bundle_id: string | null
  window_title: string | null
  source_title: string | null
  source_url: string | null
  captured_at: string | null
  capture_region: AssistantSourceRegion | null
}

export interface AssistantSourceRegion {
  x: number | null
  y: number | null
  width: number
  height: number
}

export interface AssistantSourceAttachment {
  id: string
  kind: string
  media_type: string
  size_bytes: number
}

export interface AssistantSourceMetadata {
  import_id: string
  target: 'note' | 'image' | 'paper'
  target_id: string
  source_type: string | null
  source_app: string | null
  source_app_bundle_id: string | null
  window_title: string | null
  source_title: string | null
  source_url: string | null
  captured_at: string | null
  capture_region: AssistantSourceRegion | null
  attachments: AssistantSourceAttachment[]
}

export interface AssistantSourceMetadataDraft {
  sourceApp: string
  windowTitle: string
  sourceTitle: string
  sourceUrl: string
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

/** 应用级采集隐私规则，由后端 assistant_preferences 表持久化。 */
export interface AssistantPrivacyPreferences {
  allowed_apps: string[]
  blocked_apps: string[]
  window_title_enabled: boolean
}

/** 发送前预览与用户主动放入稍后处理箱的数据策略。 */
export interface AssistantDataPolicy {
  preview_required: boolean
  inbox_retention_days: 1 | 7 | 30 | null
}

export interface AssistantPrivateDataClearResult {
  capture_sessions: number
  image_assets: number
  file_previews: number
  cancelled_actions: number
}

export interface AssistantOnboardingState {
  permission_guide_completed: boolean
}

export interface AssistantShortcutDiagnostic {
  status: 'healthy' | 'degraded' | 'error' | 'disabled'
  requested_shortcut: string
  active_shortcut: string | null
  message: string
  updated_at: string
}

export interface AssistantRuntimePreferences {
  enabled: boolean
  diagnostic_logging_enabled: boolean
}

export interface AssistantTranslationPreferences {
  target_language: AssistantTranslationTargetLanguage
  terminology_style: AssistantTerminologyStyle
}

export interface AssistantTerminologyPreference {
  source_term: string
  preferred_translation: string
  target_language: AssistantTranslationTargetLanguage
  updated_at: string
}

export type AssistantFileCandidateKind = 'pdf' | 'image' | 'markdown' | 'text'
export type AssistantFileCandidateTarget = 'paper' | 'image' | 'note'

export interface AssistantFileCandidate {
  id: string
  file_name: string
  kind: AssistantFileCandidateKind
  media_type: string
  size_bytes: number
  recommended_target: AssistantFileCandidateTarget
}

export interface RejectedFileCandidate {
  file_name: string
  reason: string
}

export interface FileCandidateInspection {
  candidates: AssistantFileCandidate[]
  rejected: RejectedFileCandidate[]
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

export interface AssistantShortcutKeystroke {
  altKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
  code: string
}

const SHORTCUT_CODE_ALIASES: Record<string, string> = {
  Space: 'Space',
  Enter: 'Enter',
  Tab: 'Tab',
  Escape: 'Escape',
  Backspace: 'Backspace',
  Delete: 'Delete',
  ArrowUp: 'ArrowUp',
  ArrowDown: 'ArrowDown',
  ArrowLeft: 'ArrowLeft',
  ArrowRight: 'ArrowRight',
}

/** 把浏览器键盘事件转换为 Tauri 全局快捷键语法。 */
export function formatAssistantShortcut(
  keystroke: AssistantShortcutKeystroke
): string | null {
  const modifiers: string[] = []
  if (keystroke.metaKey) modifiers.push('Command')
  if (keystroke.ctrlKey) modifiers.push('Ctrl')
  if (keystroke.altKey) modifiers.push('Alt')
  if (keystroke.shiftKey) modifiers.push('Shift')
  if (modifiers.length === 0) return null

  let key = SHORTCUT_CODE_ALIASES[keystroke.code]
  if (!key && /^Key[A-Z]$/.test(keystroke.code)) key = keystroke.code.slice(3)
  if (!key && /^Digit[0-9]$/.test(keystroke.code)) key = keystroke.code.slice(5)
  if (!key && /^F(?:[1-9]|1[0-9]|2[0-4])$/.test(keystroke.code)) key = keystroke.code
  if (!key) return null

  return [...modifiers, key].join('+')
}

/** 生成用户主动复制的原文/译文对照，不写入第三方应用。 */
export function buildAssistantBilingualCopy(
  sourceContent: string,
  translatedContent: string,
): string {
  const source = sourceContent.trim()
  const translated = translatedContent.trim()
  if (!source) return translated
  if (!translated) return source
  return `## 原文\n\n${source}\n\n---\n\n## 译文\n\n${translated}`
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

export interface LimitedAssistantContent {
  content: string
  originalCharacters: number
  processedCharacters: number
  truncated: boolean
}

/** Unicode 字符计数，避免把代理对拆成两个字符。 */
export function countTextCharacters(text: string): number {
  return Array.from(text).length
}

/** 按动作限制文本；图片 data URL 由图片大小策略单独处理。 */
export function limitAssistantContent(
  action: AssistantAction,
  content: string,
): LimitedAssistantContent {
  if (content.startsWith('data:image/')) {
    return {
      content,
      originalCharacters: 0,
      processedCharacters: 0,
      truncated: false,
    }
  }

  const characters = Array.from(content)
  const maxCharacters = ASSISTANT_ACTION_CHARACTER_LIMITS[action]
  const truncated = characters.length > maxCharacters
  return {
    content: truncated ? characters.slice(0, maxCharacters).join('') : content,
    originalCharacters: characters.length,
    processedCharacters: Math.min(characters.length, maxCharacters),
    truncated,
  }
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
  borderRadius: 'inherit',
  boxShadow: 'none',
} as const

// ─── 窗口几何与角色站位 ──────────────────────────────────────────────

/** 桌面小妍窗口默认尺寸（物理像素），与 tauri.conf.json 中 assistant-dock 一致。 */
export const ASSISTANT_DOCK_DEFAULT_SIZE = { width: 128, height: 136 } as const

/** 角色吸附的屏幕边缘。 */
export type AssistantDockEdge = 'left' | 'right' | 'top' | 'bottom'

/**
 * 持久化的角色站位：显示器标识 + 吸附边缘 + 沿边缘偏移。
 * 坐标统一使用 Tauri 物理像素，与 outer_position / set_position 一致。
 */
export interface AssistantDockPlacement {
  monitor_id: string
  edge: AssistantDockEdge
  offset: number
}

/** 显示器信息快照（Rust assistant_get_screen_snapshot 返回，字段保持 snake_case）。 */
export interface AssistantMonitorInfo {
  name: string | null
  x: number
  y: number
  width: number
  height: number
  scale_factor: number
  is_primary: boolean
}

export interface AssistantWindowFrame {
  x: number
  y: number
  width: number
  height: number
}

export interface AssistantScreenSnapshot {
  monitors: AssistantMonitorInfo[]
  dock_frame: AssistantWindowFrame | null
}

/**
 * 显示器标识：优先使用系统名称；无名显示器退回“分辨率@缩放”指纹。
 * 指纹可能撞名（两台同型号外接屏），此时站位会在它们之间复用，属于可接受降级。
 */
export function assistantMonitorKey(monitor: AssistantMonitorInfo): string {
  const name = monitor.name?.trim()
  if (name) return name
  return `${monitor.width}x${monitor.height}@${monitor.scale_factor}`
}

/** 找到包含指定点的显示器；都不包含时退回主显示器，再退回第一台。 */
export function assistantMonitorForPoint(
  point: { x: number; y: number },
  monitors: AssistantMonitorInfo[],
): AssistantMonitorInfo | null {
  const containing = monitors.find(
    (monitor) =>
      point.x >= monitor.x
      && point.x < monitor.x + monitor.width
      && point.y >= monitor.y
      && point.y < monitor.y + monitor.height,
  )
  return containing ?? monitors.find((monitor) => monitor.is_primary) ?? monitors[0] ?? null
}

/** 把窗口矩形夹取到显示器范围内，保证不会完全移出可见区域。 */
export function clampFrameToMonitor(
  frame: AssistantWindowFrame,
  monitor: AssistantMonitorInfo,
): AssistantWindowFrame {
  const maxX = monitor.x + monitor.width - frame.width
  const maxY = monitor.y + monitor.height - frame.height
  // 窗口比显示器还大时钉在显示器原点，保证左上角可见。
  const clamp = (value: number, min: number, max: number) =>
    max < min ? min : Math.min(Math.max(value, min), max)
  return {
    ...frame,
    x: Math.round(clamp(frame.x, monitor.x, maxX)),
    y: Math.round(clamp(frame.y, monitor.y, maxY)),
  }
}

/** 由窗口当前位置推导站位：吸附到最近边缘，偏移取沿边缘方向到显示器顶/左的距离。 */
export function dockPlacementFromFrame(
  frame: AssistantWindowFrame,
  monitor: AssistantMonitorInfo,
): AssistantDockPlacement {
  const distances: ReadonlyArray<[AssistantDockEdge, number]> = [
    ['left', frame.x - monitor.x],
    ['right', monitor.x + monitor.width - (frame.x + frame.width)],
    ['top', frame.y - monitor.y],
    ['bottom', monitor.y + monitor.height - (frame.y + frame.height)],
  ]
  let edge: AssistantDockEdge = distances[0][0]
  let nearest = distances[0][1]
  for (const [candidate, distance] of distances) {
    if (distance < nearest) {
      edge = candidate
      nearest = distance
    }
  }
  const offset = edge === 'left' || edge === 'right'
    ? frame.y - monitor.y
    : frame.x - monitor.x
  return {
    monitor_id: assistantMonitorKey(monitor),
    edge,
    offset: Math.round(offset),
  }
}

/** 由站位还原窗口位置：先按边缘与偏移摆放，再夹取到显示器内（分辨率缩小时安全收敛）。 */
export function frameFromDockPlacement(
  placement: AssistantDockPlacement,
  monitor: AssistantMonitorInfo,
  size: { width: number; height: number },
): AssistantWindowFrame {
  let x: number
  let y: number
  switch (placement.edge) {
    case 'left':
      x = monitor.x
      y = monitor.y + placement.offset
      break
    case 'right':
      x = monitor.x + monitor.width - size.width
      y = monitor.y + placement.offset
      break
    case 'top':
      x = monitor.x + placement.offset
      y = monitor.y
      break
    case 'bottom':
      x = monitor.x + placement.offset
      y = monitor.y + monitor.height - size.height
      break
  }
  return clampFrameToMonitor({ x, y, width: size.width, height: size.height }, monitor)
}

/**
 * 解析站位并计算恢复位置：
 * - 无站位时落在主显示器右下角（与 Rust 默认定位一致）；
 * - 目标显示器不存在时迁移到主显示器（再退回第一台）；
 * - 任何情况下都不会完全移出可见区域。
 */
export function resolveDockFrame(
  placement: AssistantDockPlacement | null,
  monitors: AssistantMonitorInfo[],
  size: { width: number; height: number },
): AssistantWindowFrame | null {
  if (monitors.length === 0) return null
  const fallback = monitors.find((monitor) => monitor.is_primary) ?? monitors[0]
  const monitor = placement
    ? monitors.find((candidate) => assistantMonitorKey(candidate) === placement.monitor_id)
      ?? fallback
    : fallback
  if (!placement) {
    return clampFrameToMonitor(
      {
        x: monitor.x + monitor.width - size.width - 16,
        y: monitor.y + monitor.height - size.height - 20,
        width: size.width,
        height: size.height,
      },
      monitor,
    )
  }
  return frameFromDockPlacement(placement, monitor, size)
}

const ASSISTANT_DOCK_EDGES: readonly AssistantDockEdge[] = ['left', 'right', 'top', 'bottom']

/** 解析后端返回的站位数据；任何字段不合法都视为无站位。 */
export function parseDockPlacement(raw: unknown): AssistantDockPlacement | null {
  if (typeof raw !== 'object' || raw === null) return null
  const candidate = raw as Record<string, unknown>
  if (typeof candidate.monitor_id !== 'string' || candidate.monitor_id.trim() === '') {
    return null
  }
  if (
    typeof candidate.edge !== 'string'
    || !ASSISTANT_DOCK_EDGES.includes(candidate.edge as AssistantDockEdge)
  ) {
    return null
  }
  if (typeof candidate.offset !== 'number' || !Number.isFinite(candidate.offset)) {
    return null
  }
  return {
    monitor_id: candidate.monitor_id,
    edge: candidate.edge as AssistantDockEdge,
    offset: Math.round(candidate.offset),
  }
}

/** 序列化站位，供调试与跨层传递使用（后端持久化由 Rust 完成）。 */
export function serializeDockPlacement(placement: AssistantDockPlacement): string {
  return JSON.stringify({
    monitor_id: placement.monitor_id,
    edge: placement.edge,
    offset: Math.round(placement.offset),
  })
}

// ─── 匿名本地指标（P0-5）────────────────────────────────────────────────

/** 匿名本地指标开关（默认关闭，遵循隐私优先惯例） */
export interface AssistantMetricsPreferences {
  enabled: boolean
}

/** 按天聚合的匿名指标计数，只含结构化字段，绝不含内容载荷 */
export interface AssistantMetricsDailyBucket {
  day: string
  event_type: 'capture' | 'action' | 'copy' | 'import'
  status: 'success' | 'error' | 'blocked' | 'cancelled'
  count: number
}

export * from './captureOverlayGeometry'

// ─── 截图识字（提取文字） ────────────────────────────────────────────────────

/**
 * OCR 结果的固定提示文案。
 * PRD §7.2 F3：图像 OCR 与视觉模型结果必须标示「识别可能有误」。
 */
export const ASSISTANT_EXTRACT_TEXT_NOTICE = '识别可能有误'

/** 提取文字动作的指标/命令标识（与 Rust metrics 白名单一致） */
export const ASSISTANT_EXTRACT_TEXT_ACTION = 'extract_text' as const

/**
 * `assistant_extract_text` 命令的响应。
 * 独立于 ActionResult：extract_text 不属于四首发动作联合类型。
 */
export interface AssistantExtractTextResponse {
  id: string
  session_id: string
  action: string
  content: string
  format: string
  metadata: ActionResultMetadata | null
}

// ─── 直达动作快捷键（P1-1，PRD §16.2）───────────────────────────────────────

/** 可选直达动作：跳过面板动作选择步骤，一键进入对应流程。 */
export type AssistantDirectAction = 'interpret' | 'translate' | 'screenshot'

export interface AssistantDirectActionConfig {
  id: AssistantDirectAction
  label: string
  description: string
  /** 设置页推荐的默认键位；仅建议，默认不注册。 */
  suggestedShortcut: string
}

/**
 * 直达动作列表。默认键位对标豆包 Alt+1/Alt+2 的效率：
 * 数字键远离主快捷键 Alt+Space，误触率低且单手可达。
 */
export const ASSISTANT_DIRECT_ACTIONS: ReadonlyArray<AssistantDirectActionConfig> = [
  {
    id: 'interpret',
    label: '直接解读当前选区',
    description: '读取当前选区并直接开始解读，跳过动作选择',
    suggestedShortcut: 'Alt+1',
  },
  {
    id: 'translate',
    label: '直接翻译当前选区',
    description: '读取当前选区并按翻译偏好直接开始翻译',
    suggestedShortcut: 'Alt+2',
  },
  {
    id: 'screenshot',
    label: '开始框选截图',
    description: '直接打开跨屏选区层框选截图',
    suggestedShortcut: 'Alt+3',
  },
]

/** Rust 在直达快捷键按下时发往面板窗口的事件名。 */
export const ASSISTANT_DIRECT_ACTION_EVENT = 'assistant://direct-action'

/** 单个直达动作的快捷键状态（Rust assistant_get_direct_shortcuts 返回）。 */
export interface AssistantDirectShortcutStatus {
  action: AssistantDirectAction
  /** 用户配置并持久化的组合键；null 表示未开启。 */
  configured_shortcut: string | null
  /** 当前实际注册生效的组合键；null 表示未注册。 */
  active_shortcut: string | null
  /** 最近一次注册失败诊断；无故障时为 null。 */
  diagnostic: AssistantShortcutDiagnostic | null
}

export function isAssistantDirectAction(value: unknown): value is AssistantDirectAction {
  return value === 'interpret' || value === 'translate' || value === 'screenshot'
}
