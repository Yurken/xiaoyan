import { useState, type ReactNode } from "react";
import { clsx } from "clsx";
import { ChevronDown } from "lucide-react";

interface WritingSidebarSectionProps {
  title: string;
  icon: ReactNode;
  badge?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

export default function WritingSidebarSection({
  title,
  icon,
  badge,
  action,
  children,
  defaultOpen = true,
  className,
}: WritingSidebarSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <section
      className={clsx(
        "rounded-xl border shadow-sm transition-all",
        className,
      )}
      style={{ background: "var(--rc-card-bg)", borderColor: "var(--rc-border)" }}
    >
      <div
        className={clsx(
          "flex cursor-pointer items-center justify-between px-4 py-2.5 transition-colors hover:bg-white/5",
          isOpen ? "border-b" : "rounded-xl",
        )}
        style={{ borderColor: "var(--rc-border)" }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-apple-blue/10 text-apple-blue">
            {icon}
          </div>
          <p className="text-sm font-bold tracking-tight text-ink-primary">{title}</p>
          {badge}
        </div>
        <div className="flex items-center gap-1" onClick={(event) => event.stopPropagation()}>
          {action}
          <div
            className={clsx(
              "flex h-6 w-6 items-center justify-center rounded-md text-ink-tertiary transition-transform duration-200",
              isOpen ? "rotate-0" : "-rotate-90",
            )}
            onClick={() => setIsOpen(!isOpen)}
          >
            <ChevronDown className="h-4 w-4" />
          </div>
        </div>
      </div>

      {isOpen && <div className="relative">{children}</div>}
    </section>
  );
}
