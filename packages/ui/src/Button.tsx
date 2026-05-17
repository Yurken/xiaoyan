import { clsx } from "clsx";
import { ButtonHTMLAttributes, forwardRef } from "react";
import { Loader2 } from "lucide-react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", loading, className, children, disabled, style, ...props }, ref) => {
    const inactive = disabled || loading;

    const variantStyle =
      variant === "primary"
        ? {
            background: "var(--rc-button-primary-bg)",
            borderColor: "var(--rc-button-primary-border)",
            boxShadow: inactive ? "none" : "var(--rc-button-primary-shadow)",
            color: "#ffffff",
          }
        : variant === "secondary"
          ? {
              background: "var(--rc-button-secondary-bg)",
              borderColor: "var(--rc-button-secondary-border)",
              boxShadow: inactive ? "none" : "var(--rc-button-secondary-shadow)",
              color: "var(--rc-button-secondary-text)",
            }
          : variant === "ghost"
            ? {
                background: "transparent",
                borderColor: "transparent",
                boxShadow: "none",
                color: "var(--rc-button-ghost-text)",
              }
            : {
                background: "linear-gradient(180deg, #ff655b, #d92b21)",
                borderColor: "rgba(255, 255, 255, 0.08)",
                boxShadow: inactive ? "none" : "0 10px 24px rgba(217, 43, 33, 0.2)",
                color: "#ffffff",
              };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={clsx(
          "inline-flex items-center justify-center gap-2 rounded-2xl border font-medium",
          "transition-all duration-150 ease-out",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--rc-bg)]",
          "select-none",

          size === "sm" && "px-3.5 py-1.5 text-xs",
          size === "md" && "px-5 py-2.5 text-sm",
          size === "lg" && "px-6 py-3 text-base",

          !inactive && "hover:-translate-y-[1px] active:translate-y-0",
          variant === "primary" && "focus-visible:ring-brand-500/35 hover:[background:var(--rc-button-primary-bg-hover)] hover:[box-shadow:var(--rc-button-primary-shadow-hover)]",
          variant === "secondary" && "focus-visible:ring-black/10 hover:[background:var(--rc-button-secondary-bg-hover)] hover:[box-shadow:var(--rc-button-secondary-shadow-hover)]",
          variant === "ghost" && "focus-visible:ring-black/10 hover:[background:var(--rc-button-ghost-bg-hover)] hover:[box-shadow:var(--rc-button-ghost-shadow-hover)]",
          variant === "danger" && "focus-visible:ring-red-500/30",
          inactive ? "cursor-not-allowed opacity-50" : "cursor-pointer",

          className
        )}
        style={{ ...variantStyle, ...style }}
        {...props}
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
export default Button;
