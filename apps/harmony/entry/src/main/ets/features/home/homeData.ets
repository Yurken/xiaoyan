import { RouteKey } from '../../shared/nav';

/** 首页模块概览卡片数据（纯常量）。symbol 用 Resource（$r 字面量）。 */
export interface ModuleCard {
  key: RouteKey;
  title: string;
  description: string;
  symbol: Resource;
  ready: boolean;
}

export const MODULE_CARDS: ModuleCard[] = [
  {
    key: RouteKey.Planner,
    title: '研究规划',
    description: '输入研究方向，AI 生成系统化学习路线。',
    symbol: $r('sys.symbol.map'),
    ready: false,
  },
  {
    key: RouteKey.Xiaoyan,
    title: '小妍协同',
    description: '多 Agent 编排，整合检索 / 规划 / 综述 / 复现。',
    symbol: $r('sys.symbol.ellipsis_message'),
    ready: false,
  },
  {
    key: RouteKey.Survey,
    title: '文献综述',
    description: '基于知识库 RAG + 流式 LLM 生成结构化综述。',
    symbol: $r('sys.symbol.book'),
    ready: false,
  },
  {
    key: RouteKey.Tools,
    title: '刊会查询',
    description: 'CCF 等级 / SCI 分区 / 影响因子离线查询。',
    symbol: $r('sys.symbol.wrench_and_screwdriver'),
    ready: true,
  },
];
