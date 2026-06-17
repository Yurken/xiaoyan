import { Palette, Metrics } from '../shared/theme';
import { NmCard } from './NmCard';
import { Badge, BadgeVariant } from './Badge';

/**
 * 「尚未桥接」占位面板 — 用于后端命令未接通的 feature 页。
 * 明确展示该模块依赖哪些后端命令，对齐解耦路线，避免假装已完成。
 */
@Component
export struct PlaceholderPanel {
  title: string = '';
  description: string = '';
  commands: string[] = [];

  build() {
    NmCard({ padding: Metrics.gapLg }) {
      Column({ space: Metrics.gapMd }) {
        Row({ space: Metrics.gapSm }) {
          SymbolGlyph($r('sys.symbol.hammer'))
            .fontSize(20)
            .fontColor([Palette.warning])
          Text(this.title)
            .fontSize(16)
            .fontWeight(FontWeight.Semibold)
            .fontColor(Palette.textPrimary)
          Badge({ text: '待桥接', variant: BadgeVariant.Warning })
        }
        .alignItems(VerticalAlign.Center)

        Text(this.description)
          .fontSize(13)
          .fontColor(Palette.textSecondary)
          .lineHeight(20)

        if (this.commands.length > 0) {
          Column({ space: Metrics.gapXs }) {
            Text('依赖后端命令')
              .fontSize(12)
              .fontColor(Palette.textMuted)
            Flex({ wrap: FlexWrap.Wrap }) {
              ForEach(this.commands, (cmd: string) => {
                Text(cmd)
                  .fontSize(12)
                  .fontFamily('monospace')
                  .fontColor(Palette.textSecondary)
                  .padding({ left: 8, right: 8, top: 3, bottom: 3 })
                  .margin({ right: Metrics.gapXs, bottom: Metrics.gapXs })
                  .backgroundColor(Palette.bgCardInset)
                  .borderRadius(Metrics.radiusSm)
              })
            }
          }
          .alignItems(HorizontalAlign.Start)
        }
      }
      .alignItems(HorizontalAlign.Start)
    }
  }
}
