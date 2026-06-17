import { Palette, Metrics } from '../../shared/theme';
import { NmCard } from '../../components/NmCard';
import { ScreenHeader } from '../../components/ScreenHeader';
import { RouteKey } from '../../shared/nav';
import { MODULE_CARDS, ModuleCard } from './homeData';
import { HomeModuleCard } from './HomeModuleCard';

/** 工作台首页 — 英雄区 + 模块概览网格。自包含，无需后端即可运行。 */
@Component
export struct HomePage {
  onNavigate: (key: RouteKey) => void = () => {};

  @Builder
  hero() {
    NmCard({ padding: Metrics.gapLg }) {
      Column({ space: Metrics.gapSm }) {
        Text('面向科研工作者的 AI 研究助手')
          .fontSize(22)
          .fontWeight(FontWeight.Bold)
          .fontColor(Palette.textPrimary)
        Text('多 Agent 编排，覆盖选题规划、文献调研、论文精读、知识沉淀到投稿管理的完整科研链路。所有数据本地存储，隐私可控。')
          .fontSize(13)
          .fontColor(Palette.textSecondary)
          .lineHeight(20)
      }
      .alignItems(HorizontalAlign.Start)
    }
  }

  build() {
    Scroll() {
      Column({ space: Metrics.gapLg }) {
        ScreenHeader({ title: '小妍 · 桌面版', subtitle: 'HarmonyOS 大屏体验' })
        this.hero()

        Text('快速进入')
          .fontSize(15)
          .fontWeight(FontWeight.Semibold)
          .fontColor(Palette.textPrimary)
          .width('100%')
          .textAlign(TextAlign.Start)

        Grid() {
          ForEach(MODULE_CARDS, (card: ModuleCard) => {
            GridItem() {
              HomeModuleCard({ card: card, onOpen: (key: RouteKey) => this.onNavigate(key) })
            }
          })
        }
        .columnsTemplate('1fr 1fr')
        .columnsGap(Metrics.gapMd)
        .rowsGap(Metrics.gapMd)
        .width('100%')
        .height(MODULE_CARDS.length * 70)
      }
      .width('100%')
      .alignItems(HorizontalAlign.Start)
      .padding(Metrics.pagePadding)
    }
    .scrollBar(BarState.Auto)
    .width('100%')
    .height('100%')
    .align(Alignment.Top)
  }
}
