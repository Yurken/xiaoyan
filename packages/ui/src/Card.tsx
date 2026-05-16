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
  style,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={clsx(
        "rounded-3xl transition-all duration-200 border",
        padding === "sm" && "p-4",
        padding === "md" && "p-5",
        padding === "lg" && "p-7",
        
        // Backgrounds
        variant === "inset" ? "bg-rc-card-inset-bg" : "bg-[image:var(--rc-card-bg)]",
        
        // Borders
        variant === "inset" ? "border-rc-border/10" : "border-[color:var(--rc-card-outline)]",
        
        // Shadows
        variant === "raised" && "shadow-rc-card",
        variant === "flat" && "shadow-rc-card-flat",
        variant === "inset" && "shadow-rc-inset",
        
        className
      )}
      style={style}
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

export function CardTitle({ className, children, style, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={clsx("text-base font-semibold", className)}
      style={{ color: "var(--rc-text)", ...style }}
      {...props}
    >
      {children}
    </h2>
  );
}

/** 卡片内分区：带上分隔线，用于卡片内的次级信息区块 */
export function CardSection({ className, children, style, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        "pt-4 mt-4 border-t",
        className
      )}
      style={{ borderColor: "var(--rc-border)", ...style }}
      {...props}
    >
      {children}
    </div>
  );
}

/** 卡片内次级标题（字段组标签、子区块标题） */
export function CardSectionTitle({ className, children, style, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={clsx("mb-2 text-xs font-semibold uppercase tracking-wide", className)}
      style={{ color: "var(--rc-text-muted)", ...style }}
      {...props}
    >
      {children}
    </p>
  );
}
