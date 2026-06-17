import { Palette, Metrics } from '../shared/theme';

/** 主操作按钮 — 对齐移动端 NmButton：强调色填充，支持 loading / disabled。 */
@Component
export struct NmButton {
  label: string = '';
  loading: boolean = false;
  disabled: boolean = false;
  onTap: () => void = () => {};

  build() {
    Row({ space: Metrics.gapXs }) {
      if (this.loading) {
        LoadingProgress()
          .width(16)
          .height(16)
          .color(Palette.textPrimary)
      }
      Text(this.label)
        .fontSize(14)
        .fontWeight(FontWeight.Medium)
        .fontColor(Palette.textPrimary)
    }
    .justifyContent(FlexAlign.Center)
    .height(40)
    .padding({ left: Metrics.gapMd, right: Metrics.gapMd })
    .backgroundColor(this.disabled || this.loading ? Palette.accentLight : Palette.accent)
    .borderRadius(Metrics.radiusSm)
    .opacity(this.disabled ? 0.5 : 1)
    .onClick(() => {
      if (this.disabled || this.loading) {
        return;
      }
      this.onTap();
    })
  }
}
