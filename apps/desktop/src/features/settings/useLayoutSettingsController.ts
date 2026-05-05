import { useState } from "react";
import { relaunch } from "@tauri-apps/plugin-process";
import { getLayoutMode, setLayoutMode, type LayoutMode } from "../../lib/layoutMode";
import { getThemePreference, setTheme, type ThemePreference } from "../../lib/themeMode";
import { getThemeStyle, setThemeStyle, type ThemeStyle } from "../../lib/themeStyle";

export function useLayoutSettingsController() {
  const [pendingLayout, setPendingLayout] = useState<LayoutMode>(getLayoutMode());
  const [currentTheme, setCurrentTheme] = useState<ThemePreference>(getThemePreference());
  const [currentStyle, setCurrentStyle] = useState<ThemeStyle>(getThemeStyle());

  const changeTheme = (mode: ThemePreference) => {
    if (mode === currentTheme) return;
    setCurrentTheme(mode);
    setTheme(mode);
  };

  const changeStyle = (style: ThemeStyle) => {
    if (style === currentStyle) return;
    setCurrentStyle(style);
    setThemeStyle(style);
  };

  const changeLayout = (mode: LayoutMode) => {
    if (mode === pendingLayout) return;

    setPendingLayout(mode);
    window.history.replaceState(null, "", "/");
    setLayoutMode(mode);

    const root = document.getElementById("root");
    root?.classList.add("dissolve-out");

    window.setTimeout(() => {
      void relaunch().catch((error) => {
        console.error("relaunch failed:", error);
        window.location.reload();
      });
    }, 480);
  };

  return {
    currentStyle,
    currentTheme,
    pendingLayout,
    changeLayout,
    changeStyle,
    changeTheme,
  };
}
