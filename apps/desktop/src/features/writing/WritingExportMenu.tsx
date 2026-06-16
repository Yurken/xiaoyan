import { useEffect, useRef, useState } from "react";
import { Archive, Check, ChevronDown } from "lucide-react";
import { Button } from "@research-copilot/ui";
import { EXPORT_TARGET_LABELS, type WritingExportTarget } from "./shared";

const EXPORT_TARGETS: WritingExportTarget[] = ["texstudio", "overleaf"];

interface WritingExportMenuProps {
  exportingTarget: WritingExportTarget | null;
  onExport: (target: WritingExportTarget) => void;
}

export default function WritingExportMenu({ exportingTarget, onExport }: WritingExportMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const exporting = exportingTarget !== null;

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event: PointerEvent) => {
      if (containerRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (exporting) setOpen(false);
  }, [exporting]);

  return (
    <div ref={containerRef} className="relative">
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={() => setOpen((value) => !value)}
        loading={exporting}
        disabled={exporting}
        className="px-2.5"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Archive className="h-3.5 w-3.5 text-ink-tertiary" />
        <span className="hidden lg:inline">导出</span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </Button>

      {open ? (
        <div
          role="menu"
          aria-label="导出项目"
          className="absolute right-0 z-50 mt-1.5 w-44 overflow-hidden rounded-xl border shadow-2xl"
          style={{
            background: "var(--rc-card-bg)",
            borderColor: "var(--rc-border)",
            boxShadow: "0 18px 44px rgba(15, 23, 42, 0.22)",
          }}
        >
          {EXPORT_TARGETS.map((target) => (
            <button
              key={target}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onExport(target);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-ink-secondary transition-colors hover:bg-apple-blue/5 hover:text-apple-blue"
            >
              <Archive className="h-3.5 w-3.5 text-ink-tertiary" />
              <span className="flex-1">导出 {EXPORT_TARGET_LABELS[target]}</span>
              {exportingTarget === target ? <Check className="h-3.5 w-3.5 text-apple-blue" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
