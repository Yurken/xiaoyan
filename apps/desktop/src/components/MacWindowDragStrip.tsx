import type { CSSProperties, MouseEvent } from "react";
import { IS_MACOS_DESKTOP, startWindowDragging } from "../lib/windowChrome";

interface MacWindowDragStripProps {
  className?: string;
  style?: CSSProperties;
}

export default function MacWindowDragStrip({
  className,
  style,
}: MacWindowDragStripProps) {
  if (!IS_MACOS_DESKTOP) return null;

  const handleMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    void startWindowDragging();
  };

  return (
    <div
      aria-hidden="true"
      data-tauri-drag-region
      className={className}
      style={{ userSelect: "none", ...style }}
      onMouseDown={handleMouseDown}
    />
  );
}
