import { Palette, Metrics } from '../shared/theme';

/** 卡片容器 — 对齐移动端 NmCard：暗色面 + 圆角 + 细边框。 */
@Component
export struct NmCard {
  padding: number = Metrics.gapMd;
  @BuilderParam content: () => void;

  build() {
    Column() {
      this.content()
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
    .padding(this.padding)
    .backgroundColor(Palette.bgCard)
    .borderRadius(Metrics.radiusMd)
    .border({ width: 1, color: Palette.borderLight })
  }
}
