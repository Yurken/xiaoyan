import { Palette, Metrics } from '../shared/theme';

export enum BadgeVariant {
  Info = 'info',
  Success = 'success',
  Warning = 'warning',
  Danger = 'danger',
  Neutral = 'neutral',
}

function badgeBg(variant: BadgeVariant): string {
  switch (variant) {
    case BadgeVariant.Info: return 'rgba(0,122,255,0.15)';
    case BadgeVariant.Success: return 'rgba(52,199,89,0.15)';
    case BadgeVariant.Warning: return 'rgba(255,149,0,0.15)';
    case BadgeVariant.Danger: return 'rgba(255,59,48,0.15)';
    default: return 'rgba(154,167,184,0.15)';
  }
}

function badgeFg(variant: BadgeVariant): string {
  switch (variant) {
    case BadgeVariant.Info: return Palette.accent;
    case BadgeVariant.Success: return Palette.success;
    case BadgeVariant.Warning: return Palette.warning;
    case BadgeVariant.Danger: return Palette.danger;
    default: return Palette.textSecondary;
  }
}

/** 小标签 — 对齐桌面端 Badge / CcfBadges 的视觉。 */
@Component
export struct Badge {
  text: string = '';
  variant: BadgeVariant = BadgeVariant.Neutral;

  build() {
    Text(this.text)
      .fontSize(11)
      .fontWeight(FontWeight.Medium)
      .fontColor(badgeFg(this.variant))
      .padding({ left: 8, right: 8, top: 3, bottom: 3 })
      .backgroundColor(badgeBg(this.variant))
      .borderRadius(Metrics.radiusSm)
  }
}
