const KEY = "rc_theme";

export type ThemeMode = "light" | "dark";
export type ThemePreference = ThemeMode | "auto";

function systemTheme(): ThemeMode {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function getThemePreference(): ThemePreference {
  const stored = localStorage.getItem(KEY);
  if (stored === "dark" || stored === "light" || stored === "auto") return stored;
  return "auto"; // 未设置时跟随系统
}

export function getTheme(): ThemeMode {
  const pref = getThemePreference();
  return pref === "auto" ? systemTheme() : pref;
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

/** 监听系统主题变化，仅在用户选择"跟随系统"时生效，返回取消监听函数 */
export function watchSystemTheme(callback: (mode: ThemeMode) => void): () => void {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const handler = () => {
    if (getThemePreference() === "auto") {
      const mode = systemTheme();
      applyTheme(mode);
      callback(mode);
    }
  };
  mq.addEventListener("change", handler);
  return () => mq.removeEventListener("change", handler);
}
