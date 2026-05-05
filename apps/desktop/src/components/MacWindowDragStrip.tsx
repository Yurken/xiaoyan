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
    void startWindowDragging();
  };

  return (
    // Keep the native drag-region for the first click on an unfocused window,
    // but fall back to startDragging once the app is already focused.
    <div
      aria-hidden="true"
      data-tauri-drag-region
      className={className}
      onMouseDown={handleMouseDown}
      style={{
        userSelect: "none",
        WebkitAppRegion: "drag",
        ...style,
      }}
    />
  );
}
