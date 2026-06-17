import { Metrics } from '../../shared/theme';
import { ScreenHeader } from '../../components/ScreenHeader';
import { PlaceholderPanel } from '../../components/PlaceholderPanel';

/**
 * 文献综述页 — UI 骨架已就位，等待后端命令桥接。
 */
@Component
export struct SurveyPage {
  build() {
    Scroll() {
      Column({ space: Metrics.gapLg }) {
        ScreenHeader({
          title: '文献综述',
          subtitle: '基于知识库 RAG + 流式 LLM 生成结构化综述，附候选论文。',
        })
        PlaceholderPanel({
          title: '综述生成',
          description: '依赖向量检索（rag）、流式 LLM 与综述持久化，需完成后端解耦后接通。',
          commands: ['survey_generate', 'survey_search', 'survey_list'],
        })
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
