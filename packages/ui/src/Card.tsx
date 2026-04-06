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
          ? { background: "var(--rc-card-inset-bg)" }
          : { background: "var(--rc-card-bg)" }
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
    <h2 className={clsx("text-base font-semibold text-ink-primary", className)} {...props}>
      {children}
    </h2>
  );
}

/** 卡片内分区：带上分隔线，用于卡片内的次级信息区块 */
export function CardSection({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        "pt-4 mt-4 border-t",
        className
      )}
      style={{ borderColor: "var(--rc-border)" }}
      {...props}
    >
      {children}
    </div>
  );
}

/** 卡片内次级标题（字段组标签、子区块标题） */
export function CardSectionTitle({ className, children, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={clsx("text-xs font-semibold uppercase tracking-wide text-ink-tertiary mb-2", className)}
      {...props}
    >
      {children}
    </p>
  );
}
