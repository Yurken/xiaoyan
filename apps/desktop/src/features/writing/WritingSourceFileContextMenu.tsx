import { useEffect, useMemo, useRef } from "react";
import { Pencil, Trash2 } from "lucide-react";

interface WritingSourceFileContextMenuProps {
  path: string;
  x: number;
  y: number;
  onClose: () => void;
  onRename: () => void;
  onRequestDelete: () => void;
}

const MENU_WIDTH = 176;
const MENU_HEIGHT = 96;
const MENU_MARGIN = 8;

export default function WritingSourceFileContextMenu({
  path,
  x,
  y,
  onClose,
  onRename,
  onRequestDelete,
}: WritingSourceFileContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const position = useMemo(() => ({
    left: Math.max(MENU_MARGIN, Math.min(x, window.innerWidth - MENU_WIDTH - MENU_MARGIN)),
    top: Math.max(MENU_MARGIN, Math.min(y, window.innerHeight - MENU_HEIGHT - MENU_MARGIN)),
  }), [x, y]);

  useEffect(() => {
    const closeIfOutside = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) onClose();
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("pointerdown", closeIfOutside);
    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", onClose);
    window.addEventListener("scroll", onClose, true);
    return () => {
      document.removeEventListener("pointerdown", closeIfOutside);
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("scroll", onClose, true);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label={`章节文件操作：${path}`}
      className="fixed z-[90] min-w-44 rounded-2xl border p-1.5"
      style={{
        left: position.left,
        top: position.top,
        background: "var(--rc-dropdown-menu-bg)",
        borderColor: "var(--rc-dropdown-menu-border)",
        boxShadow: "var(--rc-dropdown-menu-shadow)",
      }}
      onContextMenu={(event) => event.preventDefault()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        role="menuitem"
        onClick={onRename}
        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-ink-secondary transition-colors hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-apple-blue/30"
      >
        <Pencil className="h-3.5 w-3.5" />
        重命名
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={onRequestDelete}
        className="mt-1 flex w-full items-center gap-2 rounded-xl border-t px-3 py-2 text-left text-sm text-apple-red transition-colors hover:bg-apple-red/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-apple-red/30"
        style={{ borderColor: "var(--rc-border)" }}
      >
        <Trash2 className="h-3.5 w-3.5" />
        删除
      </button>
    </div>
  );
}
