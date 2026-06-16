import { ChevronDown, Sigma, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { WRITING_ASSISTANT_ACTIONS, type WritingAssistantActionId } from "./shared";
import {
  CONTEXT_MENU_GROUPS,
  QUICK_INSERTS,
  WRITING_ASSISTANT_ACTION_ICONS,
} from "./WritingEditorContextMenuData";

const MENU_WIDTH = 372;
const MENU_MAX_HEIGHT = 560;
const MENU_MARGIN = 12;

interface WritingEditorContextMenuProps {
  open: boolean;
  x: number;
  y: number;
  onClose: () => void;
  onInsert: (before: string, after?: string) => void;
  onInsertImage: () => void;
  onAssistantAction: (actionId: WritingAssistantActionId) => void;
}

export default function WritingEditorContextMenu({
  open,
  x,
  y,
  onClose,
  onInsert,
  onInsertImage,
  onAssistantAction,
}: WritingEditorContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const position = useMemo(() => {
    if (typeof window === "undefined") {
      return { left: x, top: y, maxHeight: MENU_MAX_HEIGHT };
    }
    const availableHeight = Math.max(220, window.innerHeight - MENU_MARGIN * 2);
    const menuHeight = Math.min(MENU_MAX_HEIGHT, availableHeight);
    const left = Math.max(
      MENU_MARGIN,
      Math.min(x, window.innerWidth - MENU_WIDTH - MENU_MARGIN),
    );
    const top = Math.max(
      MENU_MARGIN,
      Math.min(y, window.innerHeight - menuHeight - MENU_MARGIN),
    );
    return { left, top, maxHeight: menuHeight };
  }, [x, y]);

  useEffect(() => {
    if (!open) {
      setMoreOpen(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = () => onClose();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const handleViewportChange = () => onClose();
    const handleScroll = (event: Event) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      onClose();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("blur", handleViewportChange);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleScroll, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("blur", handleViewportChange);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [open, onClose]);

  if (!open) return null;

  const runInsert = (before: string, after?: string) => {
    onInsert(before, after);
    onClose();
  };

  const runAssistant = (actionId: WritingAssistantActionId) => {
    onAssistantAction(actionId);
    onClose();
  };

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="写作助手"
      className="fixed z-[90] flex flex-col overflow-hidden rounded-xl border shadow-2xl"
      style={{
        left: position.left,
        top: position.top,
        width: MENU_WIDTH,
        maxHeight: position.maxHeight,
        background: "var(--rc-card-bg)",
        borderColor: "var(--rc-border)",
        boxShadow: "0 22px 54px rgba(15, 23, 42, 0.22)",
      }}
      onContextMenu={(event) => event.preventDefault()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div
        className="flex h-10 shrink-0 items-center justify-between border-b px-3"
        style={{ borderColor: "var(--rc-border)", background: "var(--rc-card-inset-bg)" }}
      >
        <div className="flex items-center gap-2 text-xs font-bold text-ink-secondary">
          <Sparkles className="h-3.5 w-3.5 text-apple-blue" />
          <span>小妍助手</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-tertiary transition-colors hover:bg-white/5 hover:text-ink-secondary"
          title="关闭"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <section className="mb-4">
          <div className="mb-1.5 flex items-center gap-1.5 px-0.5 text-[11px] font-bold text-ink-tertiary">
            <Sparkles className="h-3.5 w-3.5 text-apple-blue" />
            <span>小妍辅助</span>
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {WRITING_ASSISTANT_ACTIONS.map((action) => {
              const Icon = WRITING_ASSISTANT_ACTION_ICONS[action.id];
              return (
                <button
                  key={action.id}
                  type="button"
                  role="menuitem"
                  title={action.description}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => runAssistant(action.id)}
                  className="flex h-14 flex-col items-center justify-center gap-1 rounded-lg border text-[11px] font-semibold text-ink-secondary transition-colors hover:border-apple-blue/30 hover:bg-apple-blue/5 hover:text-apple-blue"
                  style={{ borderColor: "var(--rc-border)", background: "var(--rc-card-inset-bg)" }}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="max-w-full truncate px-0.5">{action.title}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <div className="mb-1.5 flex items-center gap-1.5 px-0.5 text-[11px] font-bold text-ink-tertiary">
            <Sigma className="h-3.5 w-3.5 text-apple-blue" />
            <span>插入 LaTeX 片段</span>
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            {QUICK_INSERTS.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    if (isImageInsert(item.id)) {
                      onInsertImage();
                      onClose();
                      return;
                    }
                    runInsert(item.before, item.after);
                  }}
                  className="flex h-16 flex-col items-center justify-center gap-1 rounded-lg border text-[11px] font-semibold text-ink-secondary transition-colors hover:border-apple-blue/30 hover:bg-apple-blue/5 hover:text-apple-blue"
                  style={{ borderColor: "var(--rc-border)", background: "var(--rc-card-inset-bg)" }}
                >
                  <Icon className="h-4 w-4" />
                  <span className="max-w-full truncate px-1">{item.title}</span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            aria-expanded={moreOpen}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setMoreOpen((value) => !value)}
            className="mt-2.5 flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors hover:border-apple-blue/30 hover:bg-apple-blue/5"
            style={{ borderColor: "var(--rc-border)", background: "var(--rc-card-inset-bg)" }}
          >
            <span className="text-xs font-bold text-ink-secondary">{moreOpen ? "收起更多片段" : "更多片段"}</span>
            <ChevronDown
              className={`ml-auto h-3.5 w-3.5 text-ink-tertiary transition-transform ${moreOpen ? "rotate-180" : ""}`}
            />
          </button>

          {moreOpen ? (
            <div className="mt-3 space-y-4">
              {CONTEXT_MENU_GROUPS.map((group) => {
                const Icon = group.icon;
                return (
                  <div key={group.id}>
                    <div className="mb-1.5 flex items-center gap-1.5 px-0.5 text-[11px] font-bold text-ink-tertiary">
                      <Icon className="h-3.5 w-3.5 text-apple-blue" />
                      <span>{group.title}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {group.snippets.map((snippet) => (
                        <button
                          key={snippet.id}
                          type="button"
                          role="menuitem"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => {
                            if (isImageInsert(snippet.id)) {
                              onInsertImage();
                              onClose();
                              return;
                            }
                            runInsert(snippet.before, snippet.after);
                          }}
                          className="min-h-12 rounded-lg border px-2.5 py-2 text-left transition-colors hover:border-apple-blue/30 hover:bg-apple-blue/5"
                          style={{ borderColor: "var(--rc-border)", background: "var(--rc-card-inset-bg)" }}
                        >
                          <span className="block truncate text-xs font-semibold text-ink-secondary">
                            {snippet.title}
                          </span>
                          <span className="mt-0.5 block truncate font-mono text-[10px] leading-4 text-ink-tertiary">
                            {snippet.hint}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function isImageInsert(id: string): boolean {
  return id === "image" || id === "figure" || id === "includegraphics";
}
