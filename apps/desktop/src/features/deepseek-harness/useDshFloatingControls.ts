import { useEffect, useRef, useState, type PointerEvent, type KeyboardEvent } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { LogicalPosition, LogicalSize } from "@tauri-apps/api/dpi";
import { clampFloatingRuntimeControlsPosition, floatingRuntimeControlsStorageKey } from "../code-harness/shared";
import { readFloatingRuntimePosition, storeFloatingRuntimePosition } from "../code-harness/floatingRuntimeControlsStorage";
import { DSH_CONTROLS_INITIAL_SIZE, DSH_VIEWPORT_EVENT, type DshViewBounds } from "./shared";

const storageKey = floatingRuntimeControlsStorageKey("dsh");

export function useDshFloatingControls() {
  const panelRef = useRef<HTMLDivElement>(null);
  const viewport = useRef<DshViewBounds>(JSON.parse(new URLSearchParams(window.location.search).get("viewport") ?? "null"));
  const size = useRef(DSH_CONTROLS_INITIAL_SIZE);
  const stored = useRef(readFloatingRuntimePosition(storageKey));
  const position = useRef({ x: 12, y: 12 });
  const drag = useRef<{ pointerId: number; x: number; y: number; origin: { x: number; y: number } } | null>(null);
  const [dragging, setDragging] = useState(false);
  const updateRef = useRef<() => void>(() => {});

  useEffect(() => {
    const view = getCurrentWebview();
    let disposed = false;
    let frame = 0;
    const update = () => {
      const bounds = viewport.current;
      if (!bounds || disposed) return;
      position.current = clampFloatingRuntimeControlsPosition(stored.current ?? { x: bounds.width - size.current.width - 184, y: 12 }, bounds, size.current);
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (disposed) return;
        void view.setPosition(new LogicalPosition(bounds.x + position.current.x, bounds.y + position.current.y));
      });
    };
    updateRef.current = update;
    const measure = () => {
      if (!panelRef.current) return;
      const bounds = panelRef.current.getBoundingClientRect();
      size.current = { width: Math.ceil(bounds.width) + 24, height: Math.ceil(bounds.height) + 24 };
      void view.setSize(new LogicalSize(size.current.width, size.current.height));
      update();
    };
    const observer = new ResizeObserver(measure);
    if (panelRef.current) observer.observe(panelRef.current);
    measure();
    const unlisten = view.listen<DshViewBounds>(DSH_VIEWPORT_EVENT, ({ payload }) => {
      viewport.current = payload;
      update();
    });
    return () => {
      disposed = true;
      observer.disconnect();
      cancelAnimationFrame(frame);
      void unlisten.then((stop) => stop());
    };
  }, []);

  const resetPosition = () => {
    stored.current = null;
    storeFloatingRuntimePosition(storageKey, null);
    updateRef.current();
  };
  const move = (next: { x: number; y: number }, persist = false) => {
    stored.current = next;
    updateRef.current();
    if (persist) storeFloatingRuntimePosition(storageKey, position.current);
  };
  const finish = (event: PointerEvent<HTMLButtonElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    setDragging(false);
    storeFloatingRuntimePosition(storageKey, position.current);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return {
    panelRef, dragging, resetPosition,
    dragHandleProps: {
      onPointerDown(event: PointerEvent<HTMLButtonElement>) {
        if (event.button !== 0 || event.isPrimary === false) return;
        drag.current = { pointerId: event.pointerId, x: event.screenX, y: event.screenY, origin: position.current };
        event.currentTarget.setPointerCapture(event.pointerId);
        event.preventDefault();
        setDragging(true);
      },
      onPointerMove(event: PointerEvent<HTMLButtonElement>) {
        const active = drag.current;
        if (!active || active.pointerId !== event.pointerId) return;
        move({ x: active.origin.x + event.screenX - active.x, y: active.origin.y + event.screenY - active.y });
      },
      onPointerUp: finish,
      onPointerCancel: finish,
      onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
        if (event.key === "Home") { event.preventDefault(); resetPosition(); return; }
        const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
        if (!direction) return;
        event.preventDefault();
        const step = event.shiftKey ? 24 : 8;
        move({ x: position.current.x + direction[0] * step, y: position.current.y + direction[1] * step }, true);
      },
    },
  };
}
