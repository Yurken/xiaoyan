import { Palette, Metrics } from '../../shared/theme';
import { NmCard } from '../../components/NmCard';
import { Badge, BadgeVariant } from '../../components/Badge';
import { ModuleCard } from './homeData';
import { RouteKey } from '../../shared/nav';

/** 首页模块入口卡片。点击切换到对应模块。 */
@Component
export struct HomeModuleCard {
  card: ModuleCard = {
    key: RouteKey.Home, title: '', description: '', symbol: $r('sys.symbol.house'), ready: true,
  };
  onOpen: (key: RouteKey) => void = () => {};

  build() {
    Column() {
      NmCard({ padding: Metrics.gapMd }) {
        Column({ space: Metrics.gapSm }) {
          Row({ space: Metrics.gapSm }) {
            SymbolGlyph(this.card.symbol)
              .fontSize(22)
              .fontColor([Palette.accent])
            Blank()
            Badge({
              text: this.card.ready ? '可用' : '待桥接',
              variant: this.card.ready ? BadgeVariant.Success : BadgeVariant.Warning,
            })
          }
          .width('100%')
          .alignItems(VerticalAlign.Center)

          Text(this.card.title)
            .fontSize(16)
            .fontWeight(FontWeight.Semibold)
            .fontColor(Palette.textPrimary)
          Text(this.card.description)
            .fontSize(12)
            .fontColor(Palette.textSecondary)
            .lineHeight(18)
        }
        .alignItems(HorizontalAlign.Start)
      }
    }
    .onClick(() => this.onOpen(this.card.key))
  }
}
