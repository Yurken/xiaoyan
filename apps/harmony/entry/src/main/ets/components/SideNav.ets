import { Palette, Metrics } from '../shared/theme';
import { NAV_ITEMS, NavItem, RouteKey } from '../shared/nav';

/** 桌面侧边导航 — 对齐桌面端固定侧栏。 */
@Component
export struct SideNav {
  @Prop current: RouteKey;
  onSelect: (key: RouteKey) => void = () => {};

  @Builder
  navItem(item: NavItem) {
    Row({ space: Metrics.gapSm }) {
      SymbolGlyph(item.symbol)
        .fontSize(18)
        .fontColor([this.current === item.key ? Palette.accent : Palette.textSecondary])
      Text(item.label)
        .fontSize(14)
        .fontWeight(this.current === item.key ? FontWeight.Semibold : FontWeight.Normal)
        .fontColor(this.current === item.key ? Palette.textPrimary : Palette.textSecondary)
    }
    .width('100%')
    .height(42)
    .padding({ left: Metrics.gapMd, right: Metrics.gapMd })
    .borderRadius(Metrics.radiusSm)
    .backgroundColor(this.current === item.key ? Palette.accentLight : Color.Transparent)
    .alignItems(VerticalAlign.Center)
    .onClick(() => this.onSelect(item.key))
  }

  build() {
    Column({ space: Metrics.gapXs }) {
      Row({ space: Metrics.gapSm }) {
        SymbolGlyph($r('sys.symbol.sparkles'))
          .fontSize(20)
          .fontColor([Palette.accent])
        Text('小妍')
          .fontSize(18)
          .fontWeight(FontWeight.Bold)
          .fontColor(Palette.textPrimary)
      }
      .width('100%')
      .height(56)
      .padding({ left: Metrics.gapMd })
      .alignItems(VerticalAlign.Center)

      ForEach(NAV_ITEMS, (item: NavItem) => {
        this.navItem(item)
      })

      Blank()

      Text('HarmonyOS 桌面版 · v0.4.2')
        .fontSize(11)
        .fontColor(Palette.textMuted)
        .padding({ left: Metrics.gapMd, bottom: Metrics.gapSm })
    }
    .width(Metrics.sidebarWidth)
    .height('100%')
    .padding({ top: Metrics.gapMd, bottom: Metrics.gapMd, left: Metrics.gapSm, right: Metrics.gapSm })
    .backgroundColor(Palette.bgSidebar)
    .border({ width: { right: 1 }, color: Palette.borderLight })
  }
}
