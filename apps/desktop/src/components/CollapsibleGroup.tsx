import { type ReactNode, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Badge, Card } from "@research-copilot/ui";
import { clsx } from "clsx";

interface CollapsibleGroupProps {
  title: ReactNode;
  subtitle?: ReactNode;
  countLabel?: string;
  actions?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  compact?: boolean;
  className?: string;
  bodyClassName?: string;
}

export default function CollapsibleGroup({
  title,
  subtitle,
  countLabel,
  actions,
  children,
  defaultOpen = true,
  open: openProp,
  onOpenChange,
  compact = false,
  className,
  bodyClassName,
}: CollapsibleGroupProps) {
  const isControlled = openProp !== undefined;
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = isControlled ? openProp : internalOpen;

  const toggle = () => {
    const next = !open;
    if (!isControlled) {
      setInternalOpen(next);
    }
    onOpenChange?.(next);
  };

  return (
    <Card
      padding="sm"
      variant={compact ? "flat" : "raised"}
      className={clsx("space-y-0", compact && "rounded-[24px] p-3", className)}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span
            className={clsx(
              "flex flex-shrink-0 items-center justify-center rounded-xl text-ink-tertiary transition-colors",
              compact ? "h-7 w-7" : "h-8 w-8"
            )}
            style={{ background: "var(--rc-chip-bg)", boxShadow: "var(--rc-chip-shadow)" }}
          >
            {open ? <ChevronUp className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} /> : <ChevronDown className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className={clsx("font-semibold text-ink-primary", compact ? "text-xs" : "text-sm")}>{title}</p>
              {countLabel ? <Badge variant="default">{countLabel}</Badge> : null}
            </div>
            {subtitle ? (
              <div className={clsx("min-w-0 text-ink-tertiary", compact ? "mt-1 text-[11px]" : "mt-1 text-xs")}>
                {subtitle}
              </div>
            ) : null}
          </div>
        </button>

        {actions ? (
          <div className={clsx("flex flex-wrap items-center gap-2", compact && "gap-1")}>
            {actions}
          </div>
        ) : null}
      </div>

      {open ? (
        <div className={clsx(compact ? "mt-3" : "mt-4 border-t border-nm-dark/10 pt-4", bodyClassName)}>
          {children}
        </div>
      ) : null}
    </Card>
  );
}
