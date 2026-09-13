const KEY = "rc_theme";

export type ThemeMode = "light" | "dark";
export type ThemePreference = ThemeMode | "auto";

export function getSystemTheme(): ThemeMode {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function getThemePreference(): ThemePreference {
  const stored = localStorage.getItem(KEY);
  if (stored === "dark" || stored === "light" || stored === "auto") return stored;
  return "auto"; // 未设置时跟随系统
}

export function getTheme(): ThemeMode {
  const pref = getThemePreference();
  return pref === "auto" ? getSystemTheme() : pref;
}

export function setTheme(pref: ThemePreference): void {
  if (pref === "auto") {
    localStorage.removeItem(KEY);
  } else {
    localStorage.setItem(KEY, pref);
  }
  applyTheme(getTheme());
}

export function applyTheme(mode: ThemeMode): void {
  document.documentElement.setAttribute("data-theme", mode);
}

/** 监听系统主题变化；独立窗口可选择始终跟随系统。 */
export function watchSystemTheme(
  callback: (mode: ThemeMode) => void,
  options: { alwaysFollowSystem?: boolean } = {},
): () => void {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const handler = () => {
    if (options.alwaysFollowSystem || getThemePreference() === "auto") {
      const mode = getSystemTheme();
      applyTheme(mode);
      callback(mode);
    }
  };
  mq.addEventListener("change", handler);
  return () => mq.removeEventListener("change", handler);
}
