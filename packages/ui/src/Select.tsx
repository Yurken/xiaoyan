"use client";

import { clsx } from "clsx";
import { ChevronDown } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  id?: string;
  name?: string;
  label?: string;
  prefix?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  "aria-label"?: string;
}

export default function Select({
  value,
  onChange,
  options,
  id,
  name,
  label,
  prefix,
  placeholder = "请选择",
  className,
  disabled = false,
  "aria-label": ariaLabel,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const togglingRef = useRef(false);
  const generatedId = useId();
  const triggerId = id ?? `${generatedId}-trigger`;
  const labelId = label ? `${triggerId}-label` : undefined;
  const listboxId = `${triggerId}-listbox`;
  const selected = options.find((option) => option.value === value);
  const displayLabel = selected?.label ?? placeholder;
  const selectedIndex = options.findIndex((option) => option.value === value);
  const firstEnabledIndex = useMemo(
    () => options.findIndex((option) => !option.disabled),
    [options],
  );

  const getNextEnabledIndex = (startIndex: number, direction: 1 | -1) => {
    if (options.length === 0) return -1;
    let nextIndex = startIndex;

    for (let count = 0; count < options.length; count += 1) {
      nextIndex = (nextIndex + direction + options.length) % options.length;
      if (!options[nextIndex]?.disabled) return nextIndex;
    }

    return -1;
  };

  const openMenu = () => {
    if (disabled) return;
    const nextIndex = selectedIndex >= 0 && !options[selectedIndex]?.disabled ? selectedIndex : firstEnabledIndex;
    setHighlightedIndex(nextIndex);
    setOpen(true);
  };

  const closeMenu = () => {
    setOpen(false);
    setHighlightedIndex(-1);
  };

  const commitSelection = (index: number) => {
    const option = options[index];
    if (!option || option.disabled) return;
    onChange(option.value);
    closeMenu();
    window.requestAnimationFrame(() => {
      const trigger = document.getElementById(triggerId);
      if (trigger instanceof HTMLButtonElement) {
        trigger.focus();
      }
    });
  };

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        closeMenu();
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (!open || highlightedIndex < 0) return;
    optionRefs.current[highlightedIndex]?.focus();
  }, [highlightedIndex, open]);

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      openMenu();
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (open) {
        closeMenu();
        return;
      }
      openMenu();
    }
  };

  const handleOptionKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex(getNextEnabledIndex(index, 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex(getNextEnabledIndex(index, -1));
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      setHighlightedIndex(firstEnabledIndex);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      setHighlightedIndex(getNextEnabledIndex(0, -1));
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      commitSelection(index);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu();
      window.requestAnimationFrame(() => {
        const trigger = document.getElementById(triggerId);
        if (trigger instanceof HTMLButtonElement) {
          trigger.focus();
        }
      });
    }
  };

  return (
    <div
      ref={rootRef}
      className={clsx("relative", className)}
      onBlurCapture={(event) => {
        if (togglingRef.current) {
          togglingRef.current = false;
          return;
        }
        const nextFocusTarget = event.relatedTarget;
        if (nextFocusTarget instanceof Node && rootRef.current?.contains(nextFocusTarget)) return;
        closeMenu();
      }}
    >
      {name ? <input type="hidden" name={name} value={value} /> : null}
      {label ? <label id={labelId} htmlFor={triggerId} className="mb-1.5 ml-1 block text-xs font-medium text-ink-tertiary">{label}</label> : null}

      <button
        id={triggerId}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => {
          if (disabled) return;
          togglingRef.current = true;
          if (open) {
            closeMenu();
            return;
          }
          openMenu();
        }}
        onKeyDown={handleTriggerKeyDown}
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
        <div
          id={listboxId}
          role="listbox"
          aria-labelledby={labelId}
          className="rc-dropdown-menu absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-2xl py-1"
        >
          {options.map((option, index) => {
            const active = value === option.value;
            const highlighted = highlightedIndex === index;

            return (
            <button
              key={option.value}
              ref={(node) => {
                optionRefs.current[index] = node;
              }}
              type="button"
              role="option"
              aria-selected={active}
              tabIndex={highlighted ? 0 : -1}
              disabled={option.disabled}
              data-highlighted={highlighted}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => {
                if (!option.disabled) setHighlightedIndex(index);
              }}
              onClick={() => {
                commitSelection(index);
              }}
              onKeyDown={(event) => handleOptionKeyDown(event, index)}
              className="w-full px-4 py-2 text-left text-sm transition-colors duration-100 disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                color: active ? "var(--rc-info-chip-text, #007AFF)" : "var(--rc-text)",
                background:
                  active || highlighted
                    ? "var(--rc-info-chip-bg, rgba(0,122,255,0.08))"
                    : "transparent",
                fontWeight: active ? 600 : 400,
              }}
            >
              {option.label}
            </button>
          );
          })}
        </div>
      ) : null}
    </div>
  );
}
