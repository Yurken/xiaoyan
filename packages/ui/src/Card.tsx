import { clsx } from "clsx";
import { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: "sm" | "md" | "lg" | "none";
  variant?: "raised" | "flat" | "inset";
}

export function Card({
  padding = "md",
  variant = "raised",
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={clsx(
        "rounded-3xl transition-shadow duration-200",
        variant === "raised" && "shadow-nm-card",
        variant === "flat"   && "shadow-nm-flat",
        variant === "inset"  && "shadow-nm-pressed",
        padding === "sm"   && "p-4",
        padding === "md"   && "p-5",
        padding === "lg"   && "p-7",
        className
      )}
      style={
        variant === "inset"
          ? { background: "#E8ECF0" }
          : { background: "linear-gradient(145deg, #F2F6FA, #E0E4E8)" }
      }
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx("flex items-center justify-between mb-4", className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2 className={clsx("text-lg font-semibold text-ink-primary", className)} {...props}>
      {children}
    </h2>
  );
}
