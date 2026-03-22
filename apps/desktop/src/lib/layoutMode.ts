const KEY = "rc_layout_mode";

export type LayoutMode = "landscape" | "focus";

export function getLayoutMode(): LayoutMode {
  const stored = localStorage.getItem(KEY);
  return stored === "focus" ? "focus" : "landscape";
}

export function setLayoutMode(mode: LayoutMode): void {
  localStorage.setItem(KEY, mode);
}
