import { useCallback, useEffect, useRef, useState } from "react";
import { readPersistentValue, writePersistentValue } from "./usePersistentStringState";

interface UseResizableHeightOptions {
  initialHeight: number;
  minHeight?: number;
  maxHeight?: number;
  persistentKey?: string;
}

export function useResizableHeight({
  initialHeight,
  minHeight = 80,
  maxHeight = 400,
  persistentKey,
}: UseResizableHeightOptions) {
  const [height, setHeight] = useState(() => {
    if (!persistentKey) return initialHeight;
    const stored = readPersistentValue(persistentKey);
    if (!stored) return initialHeight;
    const parsed = Number.parseInt(stored, 10);
    if (Number.isNaN(parsed)) return initialHeight;
    return Math.min(maxHeight, Math.max(minHeight, parsed));
  });
  const dragging = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(0);
  const currentHeight = useRef(height);

  const persist = useCallback(
    (value: number) => {
      if (!persistentKey) return;
      writePersistentValue(persistentKey, String(value));
    },
    [persistentKey],
  );

  const onDragStart = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      dragging.current = true;
      startY.current = event.clientY;
      startHeight.current = height;
      currentHeight.current = height;

      document.body.style.userSelect = "none";

      const onMouseMove = (e: MouseEvent) => {
        if (!dragging.current) return;
        // Dragging the top edge upward increases height.
        const delta = startY.current - e.clientY;
        const next = Math.min(maxHeight, Math.max(minHeight, startHeight.current + delta));
        currentHeight.current = next;
        setHeight(next);
      };

      const onMouseUp = () => {
        dragging.current = false;
        document.body.style.userSelect = "";
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
        persist(currentHeight.current);
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    },
    [height, minHeight, maxHeight, persist],
  );

  useEffect(() => {
    return () => {
      if (dragging.current) {
        document.body.style.userSelect = "";
      }
    };
  }, []);

  return { height, setHeight, onDragStart };
}
