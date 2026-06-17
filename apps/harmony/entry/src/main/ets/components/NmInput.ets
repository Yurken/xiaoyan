import { Palette, Metrics } from '../shared/theme';

/** 单行输入 — 对齐移动端 NmInput：暗色内嵌底 + 圆角。支持回车提交。 */
@Component
export struct NmInput {
  @Prop text: string = '';
  placeholder: string = '';
  onTextChange: (value: string) => void = () => {};
  onSubmit: () => void = () => {};

  build() {
    TextInput({ text: this.text, placeholder: this.placeholder })
      .height(40)
      .fontSize(14)
      .fontColor(Palette.textPrimary)
      .placeholderColor(Palette.textMuted)
      .backgroundColor(Palette.bgInput)
      .borderRadius(Metrics.radiusSm)
      .border({ width: 1, color: Palette.borderLight })
      .padding({ left: Metrics.gapMd, right: Metrics.gapMd })
      .enterKeyType(EnterKeyType.Search)
      .onChange((value: string) => this.onTextChange(value))
      .onSubmit(() => this.onSubmit())
  }
}
