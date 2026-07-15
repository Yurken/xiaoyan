"use client";

import { useRef, useEffect, useState, type ReactNode } from "react";

export interface CapsuleTab {
  value: string;
  label: string;
  icon?: ReactNode;
  testId?: string;
}

export type CapsuleTabsDisplay = "full" | "text" | "icon";

interface CapsuleTabsProps {
  options: readonly CapsuleTab[];
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
  /** full=图标+文字, text=仅文字, icon=仅图标 */
  display?: CapsuleTabsDisplay;
}

export function CapsuleTabs({ options, value, onChange, compact, display = "full" }: CapsuleTabsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [ready, setReady] = useState(false);
  const [indicatorStyle, setIndicatorStyle] = useState<{
    left: number;
    width: number;
    opacity: number;
  }>({ left: 0, width: 0, opacity: 0 });

  useEffect(() => {
    const el = buttonRefs.current.get(value);
    const container = containerRef.current;
    if (!el || !container) return;

    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();

    setIndicatorStyle({
      left: elRect.left - containerRect.left,
      width: elRect.width,
      opacity: 1,
    });

    // Enable transition only after first paint to avoid mount animation
    if (!ready) {
      requestAnimationFrame(() => setReady(true));
    }
  }, [value, options, ready]);

  return (
    <div
      ref={containerRef}
      className="rc-capsule-tabs relative inline-flex rounded-2xl p-1 gap-0.5"
      style={{
        background: "var(--rc-surface)",
        boxShadow: "var(--rc-inset-shadow)",
      }}
    >
      <div
        className={`rc-capsule-tabs__indicator absolute top-1 rounded-xl ${
          ready ? "transition-all duration-300 ease-out" : ""
        }`}
        style={{
          height: "calc(100% - 8px)",
          left: indicatorStyle.left,
          width: indicatorStyle.width,
          opacity: indicatorStyle.opacity,
          background: "var(--rc-elevated)",
          boxShadow: "var(--rc-raised-shadow)",
        }}
      />
      {options.map((tab) => (
        <button
          key={tab.value}
          ref={(el) => {
            if (el) buttonRefs.current.set(tab.value, el);
          }}
          type="button"
          data-testid={tab.testId}
          aria-pressed={value === tab.value}
          onClick={() => onChange(tab.value)}
          className={`relative z-10 inline-flex shrink-0 items-center whitespace-nowrap rounded-xl font-medium transition-colors duration-200 ${
            display === "icon"
              ? "p-2"
              : compact
                ? "px-3 py-1.5 text-xs gap-1.5"
                : "px-4 py-2 text-sm gap-1.5"
          }`}
          style={{
            color: value === tab.value ? "var(--rc-text)" : "var(--rc-text-muted)",
          }}
          title={tab.label}
        >
          {display !== "text" && tab.icon}
          {display !== "icon" && tab.label}
        </button>
      ))}
    </div>
  );
}
