import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 会自动隐藏的可见标记（笔记栏收起时的细线）。
 * - reveal：出现，并在 delay 后自动淡出；
 * - hold：悬停等需要持续显示时占用，期间不自动淡出；
 * - 卸载时清理计时器，避免回到页面后又被旧计时器关掉。
 */
export function useAutoHiddenFlag(delayMs = 3200) {
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<number | null>(null);
  const heldRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const reveal = useCallback(() => {
    clearTimer();
    setVisible(true);
    if (heldRef.current) return;
    if (delayMs <= 0) return;
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      setVisible(false);
    }, delayMs);
  }, [clearTimer, delayMs]);

  const hold = useCallback(() => {
    heldRef.current = true;
    clearTimer();
    setVisible(true);
  }, [clearTimer]);

  const release = useCallback(() => {
    heldRef.current = false;
    reveal();
  }, [reveal]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  // 首次挂载也按「出现 → 自动淡出」走一遍，避免收起状态下细线一直亮着。
  useEffect(() => {
    reveal();
  }, [reveal]);

  return { visible, reveal, hold, release };
}
