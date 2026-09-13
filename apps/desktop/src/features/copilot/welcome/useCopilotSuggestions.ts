import { useCallback, useEffect, useRef, useState } from "react";
import { COPILOT_SUGGESTIONS, SUGGESTION_FADE_MS, SUGGESTION_HOLD_MS } from "./shared";

/** Keep the current suggestion stable while the user reads, focuses, or writes. */
export function useCopilotSuggestions(busy: boolean) {
  const manual = useRef(false);
  const [index, setIndex] = useState(0);
  const [fading, setFading] = useState(false);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => setReducedMotion(media.matches);
    const syncVisibility = () => setHidden(document.hidden);
    syncMotion();
    syncVisibility();
    media.addEventListener("change", syncMotion);
    document.addEventListener("visibilitychange", syncVisibility);
    return () => {
      media.removeEventListener("change", syncMotion);
      document.removeEventListener("visibilitychange", syncVisibility);
    };
  }, []);

  const next = useCallback(() => {
    manual.current = true;
    if (reducedMotion) setIndex((value) => (value + 1) % COPILOT_SUGGESTIONS.length);
    else setFading(true);
  }, [reducedMotion]);

  useEffect(() => {
    if (busy || paused || reducedMotion || hidden || fading) return;
    const timer = window.setTimeout(() => { manual.current = false; setFading(true); }, SUGGESTION_HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [busy, fading, hidden, index, next, paused, reducedMotion]);

  useEffect(() => {
    if (!fading) return;
    if ((busy && !manual.current) || hidden) { setFading(false); return; }
    const timer = window.setTimeout(() => {
      setIndex((value) => (value + 1) % COPILOT_SUGGESTIONS.length);
      setFading(false);
    }, reducedMotion ? 0 : SUGGESTION_FADE_MS);
    return () => window.clearTimeout(timer);
  }, [busy, fading, hidden, reducedMotion]);

  return { suggestion: COPILOT_SUGGESTIONS[index], fading, paused, setPaused, next };
}
