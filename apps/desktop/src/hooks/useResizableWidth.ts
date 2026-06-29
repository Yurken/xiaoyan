import { useCallback, useRef, useState } from "react";

interface UseResizableWidthOptions {
  initialWidth: number;
  minWidth?: number;
  maxWidth?: number;
}

export function useResizableWidth({ initialWidth, minWidth = 160, maxWidth = 600 }: UseResizableWidthOptions) {
  const [width, setWidth] = useState(initialWidth);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const onDragStart = useCallback(
    (event: React.MouseEvent, direction: "left" | "right" = "right") => {
      event.preventDefault();
      dragging.current = true;
      startX.current = event.clientX;
      startWidth.current = width;

      const onMouseMove = (e: MouseEvent) => {
        if (!dragging.current) return;
        const delta = direction === "right" ? e.clientX - startX.current : startX.current - e.clientX;
        const next = Math.min(maxWidth, Math.max(minWidth, startWidth.current + delta));
        setWidth(next);
      };

      const onMouseUp = () => {
        dragging.current = false;
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    },
    [width, minWidth, maxWidth],
  );

  return { width, setWidth, onDragStart };
}
