const KEY = "rc_style";

export type ThemeStyle = "neumorphic" | "modern-minimal" | "liquid-glass";

export function getThemeStyle(): ThemeStyle {
  const stored = localStorage.getItem(KEY);
  if (stored === "neumorphic" || stored === "modern-minimal" || stored === "liquid-glass") return stored;
  return "neumorphic";
}

export function setThemeStyle(style: ThemeStyle): void {
  localStorage.setItem(KEY, style);
  applyThemeStyle(style);
}

export function applyThemeStyle(style: ThemeStyle): void {
  document.documentElement.setAttribute("data-style", style);
}
