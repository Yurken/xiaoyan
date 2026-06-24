import { clsx } from "clsx";
import { forwardRef, type ButtonHTMLAttributes } from "react";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: "sm" | "md" | "lg";
  pressed?: boolean;
}

const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ size = "md", className, style, children, disabled, pressed = false, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      disabled={disabled}
      data-pressed={pressed}
      className={clsx(
        "rc-icon-button",
        size === "sm" && "h-8 w-8",
        size === "md" && "h-10 w-10",
        size === "lg" && "h-11 w-11",
        className,
      )}
      style={style}
      {...props}
    >
      {children}
    </button>
  ),
);

IconButton.displayName = "IconButton";
export default IconButton;
