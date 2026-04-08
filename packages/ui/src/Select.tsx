import { clsx } from "clsx";
import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  label?: string;
  prefix?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export default function Select({
  value,
  onChange,
  options,
  label,
  prefix,
  placeholder = "请选择",
  className,
  disabled = false,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value);
  const displayLabel = selected?.label ?? placeholder;

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  return (
    <div ref={rootRef} className={clsx("relative", className)}>
      {label ? <span className="mb-1.5 ml-1 block text-xs font-medium text-ink-tertiary">{label}</span> : null}

      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen((prev) => !prev);
        }}
        onBlur={(event) => {
          const nextFocusTarget = event.relatedTarget;
          if (nextFocusTarget instanceof Node && event.currentTarget.parentElement?.contains(nextFocusTarget)) return;
          setOpen(false);
        }}
        data-open={open}
        className={clsx(
          "rc-dropdown-trigger flex w-full items-center justify-between gap-2 rounded-2xl px-4 py-2.5 text-sm text-ink-primary transition-all duration-150",
          "disabled:cursor-not-allowed disabled:opacity-60",
        )}
      >
        <span className="truncate">
          {prefix ? <span className="text-ink-tertiary">{prefix}</span> : null}
          <span className={selected ? "text-ink-primary" : "text-ink-tertiary"}>{displayLabel}</span>
        </span>
        <ChevronDown
          className="h-4 w-4 flex-shrink-0 text-ink-tertiary transition-transform duration-150"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>

      {open ? (
        <div className="rc-dropdown-menu absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-2xl py-1">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              tabIndex={0}
              disabled={option.disabled}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                if (option.disabled) return;
                onChange(option.value);
                setOpen(false);
              }}
              className="w-full px-4 py-2 text-left text-sm transition-colors duration-100 disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                color: value === option.value ? "#007AFF" : "var(--rc-text)",
                background: value === option.value ? "rgba(0,122,255,0.08)" : "transparent",
                fontWeight: value === option.value ? 600 : 400,
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
