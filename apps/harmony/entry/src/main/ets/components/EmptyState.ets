import { Palette, Metrics } from '../shared/theme';

/** 空状态占位 — 对齐桌面端空态卡片。 */
@Component
export struct EmptyState {
  symbol: Resource = $r('sys.symbol.tray');
  title: string = '';
  description: string = '';

  build() {
    Column({ space: Metrics.gapSm }) {
      SymbolGlyph(this.symbol)
        .fontSize(40)
        .fontColor([Palette.textMuted])
      Text(this.title)
        .fontSize(15)
        .fontWeight(FontWeight.Medium)
        .fontColor(Palette.textSecondary)
      if (this.description.length > 0) {
        Text(this.description)
          .fontSize(12)
          .fontColor(Palette.textMuted)
          .textAlign(TextAlign.Center)
          .lineHeight(18)
      }
    }
    .width('100%')
    .padding({ top: 48, bottom: 48 })
    .justifyContent(FlexAlign.Center)
    .alignItems(HorizontalAlign.Center)
  }
}
