import type { ReactNode } from "react";
import { CodeHarnessActivityContext } from "./useCodeHarnessActivity";
import { useKeepAliveMounted } from "./useKeepAliveMounted";

/**
 * 工作台页签里的代码页容器：首次打开后保留页面，切到其他页签只隐藏。
 *
 * 页签内容在父级是条件渲染的，代码页一旦被切走就会连同 iframe 一起卸载；这里把它固定在
 * DOM 中，用传入的布局类在展示时占位、隐藏时 `display: none` 退出页签布局（隐藏时若保留
 * 尺寸会挤压同级的其他页签内容）。
 */
export default function CodeHarnessTabPanel({
  active,
  className,
  children,
}: {
  active: boolean;
  /** 展示时使用的布局类，需要与原先条件渲染的容器保持一致。 */
  className: string;
  children: ReactNode;
}) {
  const mounted = useKeepAliveMounted(active);
  if (!mounted) return null;

  return (
    <div
      data-active={active ? "true" : "false"}
      aria-hidden={active ? undefined : true}
      className={active ? className : "hidden"}
    >
      <CodeHarnessActivityContext.Provider value={active}>{children}</CodeHarnessActivityContext.Provider>
    </div>
  );
}