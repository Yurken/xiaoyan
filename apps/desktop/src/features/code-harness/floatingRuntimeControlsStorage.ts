import type { FloatingRuntimeControlsPosition } from "./shared";

export function readFloatingRuntimePosition(storageKey: string): FloatingRuntimeControlsPosition | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<FloatingRuntimeControlsPosition>;
    if (!Number.isFinite(parsed.x) || !Number.isFinite(parsed.y)) return null;
    return { x: parsed.x as number, y: parsed.y as number };
  } catch {
    return null;
  }
}

export function storeFloatingRuntimePosition(storageKey: string, position: FloatingRuntimeControlsPosition | null) {
  if (typeof window === "undefined") return;
  try {
    if (position) window.localStorage.setItem(storageKey, JSON.stringify(position));
    else window.localStorage.removeItem(storageKey);
  } catch {
    // 受限 WebView 中仍保留本次会话的位置。
  }
}
