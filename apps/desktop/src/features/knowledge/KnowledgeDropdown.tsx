import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useClickOutside } from "../../hooks/useClickOutside";

export interface KnowledgeDropdownOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface KnowledgeDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: KnowledgeDropdownOption[];
  label?: string;
  prefix?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export default function KnowledgeDropdown({
  value,
  onChange,
  options,
  label,
  prefix,
  placeholder = "请选择",
  className,
  disabled = false,
}: KnowledgeDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useClickOutside<HTMLDivElement>(open, () => setOpen(false));
  const selected = options.find((option) => option.value === value);
  const displayLabel = selected?.label ?? placeholder;

  return (
    <div ref={ref} className={className}>
      <div className="relative">
        {label ? <span className="mb-1.5 ml-1 block text-xs font-medium text-ink-tertiary">{label}</span> : null}
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            if (disabled) return;
            setOpen((prev) => !prev);
          }}
          className="flex w-full items-center justify-between gap-2 rounded-2xl px-4 py-2.5 text-sm text-ink-primary transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-60"
          style={{
            background: "#E8ECF0",
            boxShadow: open
              ? "inset 2px 2px 5px #C8CDD3, inset -2px -2px 5px #FFFFFF"
              : "3px 3px 6px #C8CDD3, -3px -3px 6px #FFFFFF",
          }}
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
          <div
            className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-2xl py-1"
            style={{
              background: "linear-gradient(145deg, #F2F6FA, #E8ECF0)",
              boxShadow: "6px 6px 14px #C0C6CC, -4px -4px 10px #FFFFFF",
            }}
          >
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                tabIndex={0}
                disabled={option.disabled}
                onClick={() => {
                  if (option.disabled) return;
                  onChange(option.value);
                  setOpen(false);
                }}
                className="w-full px-4 py-2 text-left text-sm transition-colors duration-100 disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  color: value === option.value ? "#007AFF" : "#1C1C1E",
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
    </div>
  );
}
