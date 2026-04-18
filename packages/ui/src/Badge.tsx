import { clsx } from "clsx";

type BadgeVariant = "default" | "success" | "warning" | "info" | "purple" | "danger";

const variants: Record<BadgeVariant, { text: string; shadow: string; bg: string; border: string }> = {
  default:  {
    bg: "var(--rc-badge-bg)",
    text: "var(--rc-badge-text, #3C4655)",
    shadow: "var(--rc-badge-shadow)",
    border: "var(--rc-badge-border)",
  },
  info:     {
    bg: "var(--rc-info-chip-bg, rgba(0,122,255,0.14))",
    text: "var(--rc-info-chip-text, #007AFF)",
    shadow: "var(--rc-info-chip-shadow, none)",
    border: "var(--rc-info-chip-border, transparent)",
  },
  success:  { bg: "rgba(52,199,89,0.14)", text: "#1A9E3F", shadow: "none", border: "transparent" },
  warning:  { bg: "rgba(255,149,0,0.14)", text: "#C07000", shadow: "none", border: "transparent" },
  danger:   { bg: "rgba(255,59,48,0.14)", text: "#D92B21", shadow: "none", border: "transparent" },
  purple:   { bg: "rgba(175,82,222,0.14)", text: "#8B32C2", shadow: "none", border: "transparent" },
};

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export default function Badge({ children, variant = "default", className }: BadgeProps) {
  const v = variants[variant];
  return (
    <span
      className={clsx(
        "inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        "transition-shadow duration-150",
        className
      )}
      style={{ background: v.bg, color: v.text, boxShadow: v.shadow, borderColor: v.border }}
    >
      {children}
    </span>
  );
}
