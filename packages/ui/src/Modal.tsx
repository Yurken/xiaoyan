"use client";

import { clsx } from "clsx";
import { useEffect, useId, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}

const sizeClassName: Record<NonNullable<ModalProps["size"]>, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-2xl",
};

export default function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
}: ModalProps) {
  const titleId = useId();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      style={{
        background: "var(--rc-modal-backdrop, rgba(23, 25, 29, 0.28))",
        backdropFilter: "blur(6px)",
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        className={clsx("w-full rounded-[28px] border p-5", sizeClassName[size])}
        style={{
          background: "var(--rc-modal-bg, var(--rc-elevated, var(--rc-surface)))",
          borderColor: "var(--rc-border)",
          boxShadow: "var(--rc-modal-shadow, var(--rc-card-shadow))",
        }}
      >
        {title ? (
          <h3 id={titleId} className="text-base font-semibold text-ink-primary">
            {title}
          </h3>
        ) : null}
        <div className={title ? "mt-2" : undefined}>{children}</div>
        {footer ? (
          <div className="mt-5 flex items-center justify-end gap-2">{footer}</div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
