import { Metrics } from '../../shared/theme';
import { ScreenHeader } from '../../components/ScreenHeader';
import { PlaceholderPanel } from '../../components/PlaceholderPanel';

/**
 * 研究规划页 — UI 骨架已就位，等待后端命令桥接。
 * 依赖命令需先在 Rust 侧从 Tauri/State 解耦（见 README 解耦路线）。
 */
@Component
export struct PlannerPage {
  build() {
    Scroll() {
      Column({ space: Metrics.gapLg }) {
        ScreenHeader({
          title: '研究规划',
          subtitle: '输入研究方向，AI 生成前置知识、阶段划分、经典论文与开放问题。',
        })
        PlaceholderPanel({
          title: '规划生成',
          description: '该模块依赖 LLM 流式生成与本地 SQLite 持久化，需先完成 Rust 后端的状态解耦后接通 NAPI。',
          commands: ['planner_generate', 'knowledge_generate_interest_hints', 'knowledge_list_interests'],
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
