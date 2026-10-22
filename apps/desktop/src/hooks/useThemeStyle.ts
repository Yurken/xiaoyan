import { useState } from "react";
import { getThemeStyle, type ThemeStyle } from "../lib/themeStyle";

/**
 * 读取当前界面风格（拟态 / 极简）。
 *
 * 界面风格只在设置页切换，且切换后会重启应用，因此挂载时读取一次即可，
 * 不需要订阅 storage 事件。组件可以据此在极简下改用列表化排版，
 * 而拟态保持原有卡片结构不变。
 */
export function useThemeStyle(): ThemeStyle {
  const [style] = useState<ThemeStyle>(() => getThemeStyle());
  return style;
}
