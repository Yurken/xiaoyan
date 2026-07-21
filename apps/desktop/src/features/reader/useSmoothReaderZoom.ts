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
  const renderTimerRef = useRef<number | null>(null);

  const clearRenderTimer = useCallback(() => {
    if (renderTimerRef.current) {
      window.clearTimeout(renderTimerRef.current);
      renderTimerRef.current = null;
    }
  }, []);

  useEffect(() => clearRenderTimer, [clearRenderTimer]);

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
      const next = clampScale(roundScale(scaleRef.current * factor, 2));
      scaleRef.current = next;
      setVisualScale(next);
      scheduleRenderScale(next);
    },
    [scheduleRenderScale],
  );

  const zoomStep = useCallback(
    (delta: number) => {
      clearRenderTimer();
      const next = clampScale(roundScale(scaleRef.current + delta, 1));
      scaleRef.current = next;
      setVisualScale(next);
      setRenderScale(next);
    },
    [clearRenderTimer],
  );

  const setScale = useCallback(
    (requestedScale: number) => {
      clearRenderTimer();
      const next = clampScale(roundScale(requestedScale, 2));
      scaleRef.current = next;
      setVisualScale(next);
      setRenderScale(next);
    },
    [clearRenderTimer],
  );

  return { scale, renderScale, zoomByFactor, zoomStep, setScale };
}
