import { Palette } from '../shared/theme';
import { RouteKey } from '../shared/nav';
import { SideNav } from '../components/SideNav';
import { HomePage } from '../features/home/HomePage';
import { PlannerPage } from '../features/planner/PlannerPage';
import { SurveyPage } from '../features/survey/SurveyPage';
import { ToolsPage } from '../features/tools/ToolsPage';
import { XiaoyanPage } from '../features/xiaoyan/XiaoyanPage';

/**
 * 应用壳 — 固定侧边导航 + 内容区，按 currentRoute 切换 feature 页。
 * 对齐桌面端 App.tsx 的 shell + router 结构（大屏单窗体）。
 */
@Entry
@Component
struct Index {
  @State currentRoute: RouteKey = RouteKey.Home;

  @Builder
  content() {
    if (this.currentRoute === RouteKey.Home) {
      HomePage({ onNavigate: (key: RouteKey) => { this.currentRoute = key; } })
    } else if (this.currentRoute === RouteKey.Planner) {
      PlannerPage()
    } else if (this.currentRoute === RouteKey.Survey) {
      SurveyPage()
    } else if (this.currentRoute === RouteKey.Tools) {
      ToolsPage()
    } else if (this.currentRoute === RouteKey.Xiaoyan) {
      XiaoyanPage()
    }
  }

  build() {
    Row() {
      SideNav({
        current: this.currentRoute,
        onSelect: (key: RouteKey) => { this.currentRoute = key; },
      })
      Column() {
        this.content()
      }
      .layoutWeight(1)
      .height('100%')
    }
    .width('100%')
    .height('100%')
    .backgroundColor(Palette.bg)
  }
}
