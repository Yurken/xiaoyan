const KEY = "rc_layout_mode";
export const LAYOUT_MODE_CHANGE_EVENT = "rc_layout_mode_change";

export type LayoutMode = "landscape" | "focus";

const FREE_WORKBENCH_LANDSCAPE_PATHS: Record<string, string> = {
  planner: "/planner",
  survey: "/survey",
  papers: "/papers",
  knowledge: "/knowledge",
  xiaoyan: "/xiaoyan",
  copilot: "/xiaoyan",
  tools: "/tools",
};

export function getLayoutMode(): LayoutMode {
  const stored = localStorage.getItem(KEY);
  return stored === "focus" ? "focus" : "landscape";
}

export function setLayoutMode(mode: LayoutMode): void {
  localStorage.setItem(KEY, mode);
  window.dispatchEvent(new CustomEvent(LAYOUT_MODE_CHANGE_EVENT, { detail: mode }));
}

export function landscapePathForFocusPath(pathname: string): string {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  const freeMatch = normalized.match(/^\/workbench\/free(?:\/([^/]+))?$/);

  if (freeMatch) {
    const tab = freeMatch[1] ?? "survey";
    return FREE_WORKBENCH_LANDSCAPE_PATHS[tab] ?? "/survey";
  }

  if (normalized.startsWith("/workbench/")) {
    return "/";
  }

  return normalized;
}
