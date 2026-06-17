import { Palette, Metrics } from '../shared/theme';

/** 页面标题区 — 对齐移动端 ScreenHeader：主标题 + 说明。 */
@Component
export struct ScreenHeader {
  title: string = '';
  subtitle: string = '';

  build() {
    Column({ space: Metrics.gapXs }) {
      Text(this.title)
        .fontSize(24)
        .fontWeight(FontWeight.Bold)
        .fontColor(Palette.textPrimary)
      if (this.subtitle.length > 0) {
        Text(this.subtitle)
          .fontSize(13)
          .fontColor(Palette.textSecondary)
          .lineHeight(20)
      }
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}
