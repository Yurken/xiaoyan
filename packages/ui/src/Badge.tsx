import { clsx } from "clsx";

type BadgeVariant = "default" | "success" | "warning" | "info" | "purple" | "danger";

const variants: Record<BadgeVariant, { text: string; shadow: string; bg: string }> = {
  // default 使用 CSS 变量，兼容暗/亮模式
  default:  { bg: "var(--rc-chip-inset-bg)", text: "var(--rc-text-soft, #3C4655)", shadow: "var(--rc-chip-shadow)" },
  info:     { bg: "rgba(0,122,255,0.14)",   text: "#007AFF", shadow: "none" },
  success:  { bg: "rgba(52,199,89,0.14)",   text: "#1A9E3F", shadow: "none" },
  warning:  { bg: "rgba(255,149,0,0.14)",   text: "#C07000", shadow: "none" },
  danger:   { bg: "rgba(255,59,48,0.14)",   text: "#D92B21", shadow: "none" },
  purple:   { bg: "rgba(175,82,222,0.14)",  text: "#8B32C2", shadow: "none" },
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
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold",
        "transition-shadow duration-150",
        className
      )}
      style={{ background: v.bg, color: v.text, boxShadow: v.shadow }}
    >
      {children}
    </span>
  );
}
