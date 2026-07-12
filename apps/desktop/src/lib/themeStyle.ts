const KEY = "rc_style";

export type ThemeStyle = "neumorphic" | "modern-minimal";

export function getThemeStyle(): ThemeStyle {
  // 界面风格已锁定为「拟态」：忽略历史存值，始终返回 neumorphic（设置页不再提供切换）。
  return "neumorphic";
}

export function setThemeStyle(style: ThemeStyle): void {
  localStorage.setItem(KEY, style);
  applyThemeStyle(style);
}

export function applyThemeStyle(style: ThemeStyle): void {
  document.documentElement.setAttribute("data-style", style);
}
