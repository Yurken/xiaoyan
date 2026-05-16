import { clsx } from "clsx";

type BadgeVariant = "default" | "success" | "warning" | "info" | "purple" | "danger";

const variants: Record<BadgeVariant, { text: string; shadow: string; bg: string; border: string }> = {
  default:  {
    bg: "var(--rc-chip-bg)",
    text: "var(--rc-text-soft)",
    shadow: "var(--rc-chip-shadow)",
    border: "var(--rc-border)",
  },
  info:     {
    bg: "rgba(0,122,255,0.12)",
    text: "#007AFF",
    shadow: "none",
    border: "rgba(0,122,255,0.1)",
  },
  success:  { bg: "rgba(52,199,89,0.12)", text: "#1A9E3F", shadow: "none", border: "rgba(52,199,89,0.1)" },
  warning:  { bg: "rgba(255,149,0,0.12)", text: "#C07000", shadow: "none", border: "rgba(255,149,0,0.1)" },
  danger:   { bg: "rgba(255,59,48,0.12)", text: "#D92B21", shadow: "none", border: "rgba(255,59,48,0.1)" },
  purple:   { bg: "rgba(175,82,222,0.12)", text: "#8B32C2", shadow: "none", border: "rgba(175,82,222,0.1)" },
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
