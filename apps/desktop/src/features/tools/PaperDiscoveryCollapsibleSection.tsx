import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

interface PaperDiscoveryCollapsibleSectionProps {
  title: string;
  description: string;
  status?: string;
  children: ReactNode;
}

export function PaperDiscoveryCollapsibleSection({
  title,
  description,
  status,
  children,
}: PaperDiscoveryCollapsibleSectionProps) {
  const [open, setOpen] = useState(false);

  return (
    <section
      className="rounded-2xl p-4"
      style={{ background: "var(--rc-surface)", boxShadow: "var(--rc-inset-shadow)" }}
    >
      <button
        type="button"
        className="flex w-full items-center justify-between gap-4 text-left"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="min-w-0">
          <span className="block text-xs font-semibold text-ink-secondary">{title}</span>
          <span className="mt-1 block text-[11px] leading-5 text-ink-tertiary">{description}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {status ? (
            <span className="rounded-full bg-apple-blue/10 px-2.5 py-1 text-[11px] font-medium text-apple-blue">
              {status}
            </span>
          ) : null}
          <ChevronDown
            className={`h-4 w-4 text-ink-tertiary transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          />
        </span>
      </button>

      {open ? <div className="mt-4 space-y-4 border-t border-black/5 pt-4">{children}</div> : null}
    </section>
  );
}
