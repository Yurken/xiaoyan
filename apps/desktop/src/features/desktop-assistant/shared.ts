/**
 * 桌面悬浮助手共享层：类型、常量、纯函数
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
  borderRadius: 0,
  boxShadow: 'none',
} as const
