import { useCallback, useEffect, useRef, useState } from "react";

const MIN_SCALE = 0.6;
const MAX_SCALE = 3;
const WHEEL_RENDER_IDLE_MS = 160;

function clampScale(scale: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

function roundScale(scale: number, precision: number) {
  const factor = 10 ** precision;
  return Math.round(scale * factor) / factor;
}

export function useSmoothReaderZoom(initialScale = 1.4) {
  const [scale, setVisualScale] = useState(initialScale);
  const [renderScale, setRenderScale] = useState(initialScale);
  const scaleRef = useRef(initialScale);
  const visualFrameRef = useRef<number | null>(null);
  const renderTimerRef = useRef<number | null>(null);

  const clearRenderTimer = useCallback(() => {
    if (renderTimerRef.current !== null) {
      window.clearTimeout(renderTimerRef.current);
      renderTimerRef.current = null;
    }
  }, []);

  const cancelPending = useCallback(() => {
    clearRenderTimer();
    if (visualFrameRef.current !== null) cancelAnimationFrame(visualFrameRef.current);
    visualFrameRef.current = null;
  }, [clearRenderTimer]);

  useEffect(() => cancelPending, [cancelPending]);

  const scheduleRenderScale = useCallback(
    (nextScale: number) => {
      clearRenderTimer();
      renderTimerRef.current = window.setTimeout(() => {
        setRenderScale(nextScale);
        renderTimerRef.current = null;
      }, WHEEL_RENDER_IDLE_MS);
    },
    [clearRenderTimer],
  );

  const zoomByFactor = useCallback(
    (factor: number) => {
      if (!Number.isFinite(factor) || factor <= 0) return;
      const next = clampScale(scaleRef.current * factor);
      scaleRef.current = next;
      // Keep sub-percent trackpad deltas; publish at most once per animation frame.
      if (visualFrameRef.current === null) {
        visualFrameRef.current = requestAnimationFrame(() => {
          visualFrameRef.current = null;
          setVisualScale(scaleRef.current);
        });
      }
      scheduleRenderScale(next);
    },
    [scheduleRenderScale],
  );

  const zoomStep = useCallback(
    (delta: number) => {
      if (!Number.isFinite(delta)) return;
      cancelPending();
      const next = clampScale(roundScale(scaleRef.current + delta, 1));
      scaleRef.current = next;
      setVisualScale(next);
      setRenderScale(next);
    },
    [cancelPending],
  );

  const setScale = useCallback(
    (requestedScale: number) => {
      if (!Number.isFinite(requestedScale)) return;
      cancelPending();
      const next = clampScale(roundScale(requestedScale, 2));
      scaleRef.current = next;
      setVisualScale(next);
      setRenderScale(next);
    },
    [cancelPending],
  );

  return { scale, renderScale, zoomByFactor, zoomStep, setScale };
}
