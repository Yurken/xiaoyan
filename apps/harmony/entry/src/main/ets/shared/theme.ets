/**
 * 设计令牌 — 对齐移动端 features/theme.ts 的暗色调，桌面大屏统一视觉语言。
 * ArkTS 不支持 `as const` 对象字面量导出，用 static readonly 类承载令牌。
 */
export class Palette {
  // 背景
  static readonly bg: string = '#090B10';
  static readonly bgCard: string = '#141A23';
  static readonly bgCardInset: string = '#0F141C';
  static readonly bgInput: string = '#0F141C';
  static readonly bgSidebar: string = '#0C1017';

  // 文本
  static readonly textPrimary: string = '#F5F7FA';
  static readonly textSecondary: string = '#9AA7B8';
  static readonly textMuted: string = '#5F6B7A';

  // 强调
  static readonly accent: string = '#007AFF';
  static readonly accentLight: string = 'rgba(0,122,255,0.15)';

  // 状态
  static readonly success: string = '#34C759';
  static readonly warning: string = '#FF9500';
  static readonly danger: string = '#FF3B30';

  // 边框
  static readonly border: string = 'rgba(60,74,92,0.7)';
  static readonly borderLight: string = 'rgba(60,74,92,0.35)';

  // 杂项
  static readonly skeleton: string = '#1A2433';
  static readonly overlay: string = 'rgba(9,11,16,0.7)';
}

/** 间距 / 圆角刻度，保持大屏布局节奏一致。 */
export class Metrics {
  static readonly radiusSm: number = 10;
  static readonly radiusMd: number = 16;
  static readonly radiusLg: number = 22;

  static readonly gapXs: number = 6;
  static readonly gapSm: number = 10;
  static readonly gapMd: number = 16;
  static readonly gapLg: number = 24;

  static readonly pagePadding: number = 28;
  static readonly sidebarWidth: number = 220;
}
