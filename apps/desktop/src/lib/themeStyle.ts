const KEY = "rc_style";

export type ThemeStyle = "neumorphic" | "modern-minimal";

const THEME_STYLES: readonly ThemeStyle[] = ["neumorphic", "modern-minimal"];

function isThemeStyle(value: string | null): value is ThemeStyle {
  return THEME_STYLES.some((style) => style === value);
}

/** 读取已保存的界面风格。空值和非法值回退拟态，不抛错。 */
export function getThemeStyle(): ThemeStyle {
  try {
    const stored = localStorage.getItem(KEY);
    if (isThemeStyle(stored)) return stored;
  } catch {
    // 存储不可用时保持默认拟态。
  }
  return "neumorphic";
}

export function setThemeStyle(style: ThemeStyle): void {
  localStorage.setItem(KEY, style);
  applyThemeStyle(style);
}

export function applyThemeStyle(style: ThemeStyle): void {
  document.documentElement.setAttribute("data-style", style);
}
