import { clsx } from "clsx";

type BadgeVariant = "default" | "success" | "warning" | "info" | "purple" | "danger";

const variants: Record<BadgeVariant, { text: string; shadow: string; bg: string }> = {
  default:  { bg: "#E8ECF0", text: "#3C3C43", shadow: "3px 3px 6px #C8CDD3, -3px -3px 6px #FFFFFF" },
  info:     { bg: "#E8ECF0", text: "#007AFF", shadow: "3px 3px 6px #C8CDD3, -3px -3px 6px #FFFFFF" },
  success:  { bg: "#E8ECF0", text: "#34C759", shadow: "3px 3px 6px #C8CDD3, -3px -3px 6px #FFFFFF" },
  warning:  { bg: "#E8ECF0", text: "#FF9500", shadow: "3px 3px 6px #C8CDD3, -3px -3px 6px #FFFFFF" },
  danger:   { bg: "#E8ECF0", text: "#FF3B30", shadow: "3px 3px 6px #C8CDD3, -3px -3px 6px #FFFFFF" },
  purple:   { bg: "#E8ECF0", text: "#AF52DE", shadow: "3px 3px 6px #C8CDD3, -3px -3px 6px #FFFFFF" },
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
