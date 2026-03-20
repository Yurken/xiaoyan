import { clsx } from "clsx";
import { ButtonHTMLAttributes, forwardRef } from "react";
import { Loader2 } from "lucide-react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", loading, className, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={clsx(
          "inline-flex items-center justify-center gap-2 font-medium rounded-2xl",
          "transition-all duration-150 ease-out",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
          "select-none",

          size === "sm" && "px-3.5 py-1.5 text-xs",
          size === "md" && "px-5 py-2.5 text-sm",
          size === "lg" && "px-6 py-3 text-base",

          variant === "primary" && [
            "text-white",
            "focus-visible:ring-brand-500",
            !disabled && !loading
              ? "shadow-apple-blue hover:-translate-y-[1px] hover:shadow-[10px_10px_20px_rgba(0,62,204,0.45),-4px_-4px_10px_rgba(58,155,255,0.35)] active:translate-y-0 active:shadow-apple-blue-pressed"
              : "opacity-50 cursor-not-allowed",
          ],

          variant === "secondary" && [
            "bg-nm-bg text-ink-secondary",
            "focus-visible:ring-nm-dark",
            !disabled && !loading
              ? "shadow-nm-flat hover:shadow-nm-raised hover:-translate-y-[1px] active:translate-y-0 active:shadow-nm-pressed"
              : "opacity-50 cursor-not-allowed",
          ],

          variant === "ghost" && [
            "bg-transparent text-ink-tertiary",
            "focus-visible:ring-nm-dark",
            !disabled && !loading
              ? "hover:bg-white/50 hover:shadow-nm-sm active:shadow-nm-pressed"
              : "opacity-50 cursor-not-allowed",
          ],

          variant === "danger" && [
            "text-white",
            "focus-visible:ring-apple-red",
            !disabled && !loading
              ? "shadow-[5px_5px_12px_rgba(180,0,0,0.35),-3px_-3px_8px_rgba(255,100,100,0.25)] hover:-translate-y-[1px] active:translate-y-0"
              : "opacity-50 cursor-not-allowed",
          ],

          className
        )}
        style={
          variant === "primary"
            ? { background: "linear-gradient(145deg, #1A8AFF, #0062CC)" }
            : variant === "danger"
            ? { background: "linear-gradient(145deg, #FF5555, #CC2200)" }
            : undefined
        }
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
