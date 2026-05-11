import { useEffect, useRef, useCallback } from "react";

const EVENTS = ["mousemove", "keydown", "click", "scroll", "touchstart"] as const;

export function useInactivityLock(
  timeoutMinutes: number,
  locked: boolean,
  onLock: () => void,
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onLockRef = useRef(onLock);
  onLockRef.current = onLock;

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (timeoutMinutes <= 0 || locked) return;
    timerRef.current = setTimeout(() => {
      onLockRef.current();
    }, timeoutMinutes * 60 * 1000);
  }, [timeoutMinutes, locked]);

  useEffect(() => {
    resetTimer();

    const handler = () => resetTimer();
    for (const event of EVENTS) {
      window.addEventListener(event, handler, { passive: true });
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      for (const event of EVENTS) {
        window.removeEventListener(event, handler);
      }
    };
  }, [resetTimer]);
}
