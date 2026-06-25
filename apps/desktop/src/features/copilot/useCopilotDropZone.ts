import { useCallback, useEffect, useRef, useState } from "react";
import { safeOnDragDrop } from "../../lib/tauriEvent";

/**
 * 拖拽文件到指定区域（小妍对话列）的状态机。
 *
 * OS 级文件拖拽不会触发 webview 的 HTML5 拖放事件（Tauri 默认拦截），因此必须监听
 * Tauri 原生拖拽事件，并用落点坐标对 zoneRef 区域做命中测试：在区域内时高亮，在区域内
 * 释放时把文件路径回调给上层（交由附件管线区分图片/文档）。
 */
export function useCopilotDropZone(onDrop: (paths: string[]) => void) {
  const zoneRef = useRef<HTMLDivElement | null>(null);
  const [isOver, setIsOver] = useState(false);
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;

  // Tauri 落点为物理像素，getBoundingClientRect 为 CSS 像素，按 devicePixelRatio 换算后命中测试。
  const hitTest = useCallback((physicalX: number, physicalY: number) => {
    const el = zoneRef.current;
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const x = physicalX / dpr;
    const y = physicalY / dpr;
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let mounted = true;
    void safeOnDragDrop((event) => {
      const payload = event.payload;
      if (payload.type === "enter" || payload.type === "over") {
        setIsOver(hitTest(payload.position.x, payload.position.y));
      } else if (payload.type === "leave") {
        setIsOver(false);
      } else if (payload.type === "drop") {
        const inside = hitTest(payload.position.x, payload.position.y);
        setIsOver(false);
        if (inside && payload.paths.length > 0) onDropRef.current(payload.paths);
      }
    }).then((cleanup) => {
      if (!mounted) {
        cleanup();
        return;
      }
      unlisten = cleanup;
    });
    return () => {
      mounted = false;
      unlisten?.();
      unlisten = undefined;
    };
  }, [hitTest]);

  return { zoneRef, isOver };
}
