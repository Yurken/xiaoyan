import { useState, type ComponentType } from "react";
import { Eye, EyeOff, Sparkles } from "lucide-react";
import { Input } from "@research-copilot/ui";

export const MASK = "***";

export function SettingInput({
  label,
  value,
  onChange,
  placeholder,
  sensitive,
  hint,
  labelHint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  sensitive?: boolean;
  hint?: string;
  labelHint?: string;
}) {
  const [show, setShow] = useState(false);
  const type = sensitive && !show ? "password" : "text";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 ml-1">
        <label className="block text-xs font-medium text-ink-tertiary">{label}</label>
        {labelHint ? (
          <span className="text-[11px] leading-4 text-ink-tertiary" title={labelHint}>?</span>
        ) : null}
      </div>
      <div className="relative">
        <Input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="pr-10"
        />
        {sensitive ? (
          <button
            type="button"
            onClick={() => setShow((state) => !state)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-tertiary hover:text-ink-secondary transition-colors"
          >
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        ) : null}
      </div>
      {hint ? <p className="text-xs text-ink-tertiary ml-1 leading-5">{hint}</p> : null}
    </div>
  );
}

export function SectionIcon({
  icon: Icon,
  color,
}: {
  icon: ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <div
      className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
      style={{
        background: "var(--rc-chip-inset-bg)",
        boxShadow: "var(--rc-chip-inset-shadow)",
        color,
      }}
    >
      <Icon className="w-4.5 h-4.5" />
    </div>
  );
}

export function AgentChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-2 rounded-2xl text-xs font-medium transition-all duration-150"
      style={
        active
          ? {
              background: "var(--rc-button-primary-bg)",
              color: "#FFFFFF",
              boxShadow: "var(--rc-button-primary-shadow)",
            }
          : {
              background: "var(--rc-chip-bg)",
              color: "var(--rc-text-soft)",
              boxShadow: "var(--rc-chip-shadow)",
            }
      }
    >
      {label}
    </button>
  );
}

export function ProviderTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-4 py-2 rounded-xl text-sm font-medium transition-all duration-150"
      style={
        active
          ? {
              background: "var(--rc-button-primary-bg)",
              color: "#FFFFFF",
              boxShadow: "var(--rc-button-primary-shadow)",
            }
          : {
              background: "var(--rc-chip-bg)",
              color: "var(--rc-text-soft)",
              boxShadow: "var(--rc-chip-shadow)",
            }
      }
    >
      {label}
    </button>
  );
}

export function ToggleRow({
  title,
  description,
  checked,
  onToggle,
}: {
  title: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className="rounded-3xl px-4 py-4 flex items-center justify-between gap-4"
      style={{
        background: "var(--rc-chip-inset-bg)",
        boxShadow: "var(--rc-chip-inset-shadow)",
      }}
    >
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-ink-primary">{title}</div>
        <div className="text-xs text-ink-tertiary mt-1 leading-5">{description}</div>
      </div>
      <button
        type="button"
        onClick={onToggle}
        className="w-16 h-9 rounded-full relative transition-colors flex-shrink-0 overflow-hidden"
        style={{ background: checked ? "var(--rc-toggle-on-bg)" : "var(--rc-chip-inset-bg)" }}
      >
        <span
          className="absolute left-1 top-1 h-7 w-7 rounded-full transition-transform"
          style={{
            background: "var(--rc-toggle-knob-bg)",
            transform: checked ? "translateX(28px)" : "translateX(0)",
            boxShadow: "var(--rc-toggle-knob-shadow)",
          }}
        />
      </button>
    </div>
  );
}

export function RecommendationList({ items }: { items: string[] }) {
  return (
    <div
      className="rounded-3xl px-4 py-4 space-y-2"
      style={{
        background: "linear-gradient(145deg, rgba(26,138,255,0.08), rgba(255,255,255,0.75))",
        boxShadow: "inset 1px 1px 0 rgba(255,255,255,0.75), 0 12px 24px rgba(15,23,42,0.05)",
      }}
    >
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-[#1A8AFF]" />
        <p className="text-sm font-semibold text-ink-primary">小妍配置建议</p>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <p key={item} className="text-xs leading-5 text-ink-secondary">
            {item}
          </p>
        ))}
      </div>
    </div>
  );
}

