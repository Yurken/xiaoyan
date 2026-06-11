import { useEffect } from "react";
import { applyTheme, getTheme, watchSystemTheme } from "../../lib/themeMode";
import { applyThemeStyle, getThemeStyle } from "../../lib/themeStyle";

/**
 * 初始化主题：应用暗色/亮色模式、主题样式，监听系统主题变更。
 */
export function useThemeInit() {
  useEffect(() => {
    applyTheme(getTheme());
    applyThemeStyle(getThemeStyle());
    const unwatch = watchSystemTheme(() => { });
    const root = document.getElementById("root");
    if (!root) return () => unwatch();
    root.classList.add("dissolve-in");
    const timer = setTimeout(() => root.classList.remove("dissolve-in"), 600);
    return () => {
      clearTimeout(timer);
      unwatch();
    };
  }, []);
}
