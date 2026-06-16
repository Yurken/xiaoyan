import { useEffect, useState } from "react";

function readDevicePixelRatio() {
  if (typeof window === "undefined") return 1;
  const ratio = window.devicePixelRatio;
  if (!Number.isFinite(ratio) || ratio <= 0) return 1;
  return Math.round(ratio * 100) / 100;
}

const STABLE_THRESHOLD = 0.01;

/**
 * 跟踪 window.devicePixelRatio。Tauri WebView 首屏 DPR 可能在前几帧才稳定，
 * 因此在挂载后的两帧内重新读取一次；DPR 真正变化时返回新值，触发按 DPR 重渲染。
 */
export function useDevicePixelRatio(): number {
  const [value, setValue] = useState(readDevicePixelRatio);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let raf1 = 0;
    let raf2 = 0;

    const sync = () => {
      setValue((prev) => {
        const next = readDevicePixelRatio();
        return Math.abs(prev - next) < STABLE_THRESHOLD ? prev : next;
      });
    };

    sync();
    raf1 = window.requestAnimationFrame(() => {
      sync();
      raf2 = window.requestAnimationFrame(sync);
    });
    window.addEventListener("resize", sync);
    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", sync);

    return () => {
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
      window.removeEventListener("resize", sync);
      viewport?.removeEventListener("resize", sync);
    };
  }, []);

  return value;
}
