import { useEffect } from "react";
import { applyTheme, getSystemTheme, getTheme, watchSystemTheme } from "../lib/themeMode";
import { applyThemeStyle, getThemeStyle } from "../lib/themeStyle";

/**
 * 初始化主题：应用暗色/亮色模式、主题样式，监听系统主题变更。
 */
export function useThemeInit({ followSystem = false }: { followSystem?: boolean } = {}) {
  useEffect(() => {
    applyTheme(followSystem ? getSystemTheme() : getTheme());
    applyThemeStyle(getThemeStyle());
    const unwatch = watchSystemTheme(() => { }, { alwaysFollowSystem: followSystem });
    const root = document.getElementById("root");
    if (!root) return () => unwatch();
    root.classList.add("dissolve-in");
    const timer = setTimeout(() => root.classList.remove("dissolve-in"), 600);
    return () => {
      clearTimeout(timer);
      unwatch();
    };
  }, [followSystem]);
}
