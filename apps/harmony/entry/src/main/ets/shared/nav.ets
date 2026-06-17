/**
 * 导航常量（纯数据）— 对齐桌面端 App.tsx 的 navItems。
 * 本轮已落地 home / tools / planner / survey / xiaoyan；其余为占位，后续逐模块补齐。
 *
 * symbol 用 Resource（$r 字面量）承载，避免把动态字符串传入 $r 导致资源无法解析。
 */
export enum RouteKey {
  Home = 'home',
  Planner = 'planner',
  Xiaoyan = 'xiaoyan',
  Survey = 'survey',
  Tools = 'tools',
}

export interface NavItem {
  key: RouteKey;
  label: string;
  symbol: Resource;
  ready: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { key: RouteKey.Home, label: '首页', symbol: $r('sys.symbol.house'), ready: true },
  { key: RouteKey.Planner, label: '规划', symbol: $r('sys.symbol.map'), ready: true },
  { key: RouteKey.Xiaoyan, label: '对话', symbol: $r('sys.symbol.ellipsis_message'), ready: true },
  { key: RouteKey.Survey, label: '综述', symbol: $r('sys.symbol.book'), ready: true },
  { key: RouteKey.Tools, label: '工具', symbol: $r('sys.symbol.wrench_and_screwdriver'), ready: true },
];
