import { useLayoutEffect, useRef, useState } from "react";

/**
 * 测量元素 content box 宽度，跟随容器尺寸变化实时更新。
 * 初始用 clientWidth 同步取值（在 paint 前），避免首帧闪烁；
 * 后续由 ResizeObserver 维护。无 padding 时与 contentRect.width 一致。
 */
export function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) setWidth(rect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, width] as const;
}
