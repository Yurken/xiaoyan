import { Metrics } from '../../shared/theme';
import { ScreenHeader } from '../../components/ScreenHeader';
import { SourceLookupPanel } from './SourceLookupPanel';

/** 工具集页面 — 当前落地「刊会查询」，后续可并列 arXiv 检索 / 翻译等面板。 */
@Component
export struct ToolsPage {
  build() {
    Scroll() {
      Column({ space: Metrics.gapLg }) {
        ScreenHeader({
          title: '工具集',
          subtitle: '科研常用查询工具。刊会查询已接通本地离线索引（CCF 679 条 / 期刊分区 22804 条）。',
        })
        SourceLookupPanel()
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
