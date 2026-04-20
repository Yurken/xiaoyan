import type { CSSProperties } from "react";
import { IS_MACOS_DESKTOP } from "../lib/windowChrome";

interface MacWindowDragStripProps {
  className?: string;
  style?: CSSProperties;
}

export default function MacWindowDragStrip({
  className,
  style,
}: MacWindowDragStripProps) {
  if (!IS_MACOS_DESKTOP) return null;

  return (
    // Keep drag handling fully native so macOS overlay title bars can start dragging
    // from the original mouse-down event without an async JS hop.
    <div
      aria-hidden="true"
      data-tauri-drag-region
      className={className}
      style={{ userSelect: "none", ...style }}
    />
  );
}
