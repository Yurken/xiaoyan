const KEY = "rc_style";

export type ThemeStyle = "neumorphic" | "modern-minimal";

export function getThemeStyle(): ThemeStyle {
  return localStorage.getItem(KEY) === "modern-minimal" ? "modern-minimal" : "neumorphic";
}

export function setThemeStyle(style: ThemeStyle): void {
  localStorage.setItem(KEY, style);
  applyThemeStyle(style);
}

export function applyThemeStyle(style: ThemeStyle): void {
  document.documentElement.setAttribute("data-style", style);
}
