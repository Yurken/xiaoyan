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

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={clsx(
          "inline-flex items-center justify-center gap-2 rounded-2xl border font-medium",
          "transition-all duration-150 ease-out",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-rc-bg",
          "select-none",

          size === "sm" && "px-3.5 py-1.5 text-xs",
          size === "md" && "px-5 py-2.5 text-sm",
          size === "lg" && "px-6 py-3 text-base",

          // Variants
          variant === "primary" && [
            "bg-[image:var(--rc-button-primary-bg)] border-transparent text-white",
            !inactive && "shadow-rc-button-primary hover:[background:var(--rc-button-primary-bg-hover)] hover:[box-shadow:var(--rc-button-primary-shadow-hover)]"
          ],
          variant === "secondary" && [
            "bg-rc-bg border-transparent text-rc-text-soft",
            !inactive && "shadow-rc-flat hover:bg-rc-elevated hover:shadow-rc-raised"
          ],
          variant === "ghost" && [
            "bg-transparent border-transparent text-rc-text-muted",
            !inactive && "hover:bg-rc-text/5"
          ],
          variant === "danger" && [
            "bg-gradient-to-b from-[#ff655b] to-[#d92b21] border-white/10 text-white",
            !inactive && "shadow-[0_10px_24px_rgba(217,43,33,0.2)]"
          ],

          !inactive && "hover:-translate-y-[1px] active:translate-y-0",
          inactive ? "cursor-not-allowed opacity-50 shadow-none" : "cursor-pointer",

          className
        )}
        style={style}
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
