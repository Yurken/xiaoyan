import { createContext, useContext } from "react";

/**
 * 代码 Harness 页面是否正在前台展示。
 *
 * Harness 工作区被常驻宿主挂载后会一直留在 DOM 中，切走只做隐藏。隐藏期间内嵌页面
 * 仍会收到后端推送，但状态轮询没有意义，因此运行时就绪状态通过这个上下文暂停轮询，
 * 回到前台时再立即拉取一次最新快照。
 *
 * 默认值为 `true`：单独渲染某个工作区（例如单元测试）时，行为与常驻宿主出现之前一致。
 */
export const CodeHarnessActivityContext = createContext(true);

export function useCodeHarnessActivity(): boolean {
  return useContext(CodeHarnessActivityContext);
}