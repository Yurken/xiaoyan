import { useEffect, useState } from "react";

/**
 * 常驻页面的挂载判定：一旦可见过就一直保持挂载，之后切走只隐藏。
 *
 * 页面据此在首次可见后留在 DOM 中；隐藏期间同一棵子树继续存在，内嵌 Web 应用不会重新加载。
 */
export function useKeepAliveMounted(visible: boolean): boolean {
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) setMounted(true);
  }, [visible]);

  return mounted;
}