import { clsx } from "clsx";
import { InputHTMLAttributes, TextareaHTMLAttributes, forwardRef, useId } from "react";

const nmInset = "var(--rc-control-shadow)";
const nmInsetError = "0 0 0 1px rgba(255, 59, 48, 0.45), 0 0 0 4px rgba(255, 59, 48, 0.12)";
const nmInsetFocus = "var(--rc-control-focus-shadow)";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, id, className, style, onFocus, onBlur, ...props }, ref) => {
    const generatedId = useId();
    const controlId = id ?? generatedId;
    const errorId = `${controlId}-error`;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={controlId} className="block text-xs font-medium text-ink-tertiary mb-1.5 ml-1">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={controlId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={clsx(
            "w-full rounded-2xl border px-4 py-2.5 text-sm outline-none",
            "text-[var(--rc-text)] placeholder:text-[var(--rc-text-muted)]",
            "transition-[box-shadow,border-color,background-color] duration-150",
            className
          )}
          style={{
            background: "var(--rc-control-bg)",
            borderColor: "var(--rc-control-border)",
            boxShadow: error ? nmInsetError : nmInset,
            ...style,
          }}
          onFocus={(e) => {
            (e.currentTarget as HTMLInputElement).style.boxShadow = nmInsetFocus;
            (e.currentTarget as HTMLInputElement).style.borderColor = "rgba(0, 122, 255, 0.42)";
            onFocus?.(e);
          }}
          onBlur={(e) => {
            (e.currentTarget as HTMLInputElement).style.boxShadow = error ? nmInsetError : nmInset;
            (e.currentTarget as HTMLInputElement).style.borderColor = error ? "rgba(255, 59, 48, 0.45)" : "var(--rc-control-border)";
            onBlur?.(e);
          }}
          {...props}
        />
        {error && <p id={errorId} role="alert" className="mt-1 text-xs text-apple-red ml-1">{error}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, id, className, style, onFocus, onBlur, ...props }, ref) => {
    const generatedId = useId();
    const controlId = id ?? generatedId;
    const errorId = `${controlId}-error`;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={controlId} className="block text-xs font-medium text-ink-tertiary mb-1.5 ml-1">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={controlId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={clsx(
            "w-full rounded-2xl border px-4 py-2.5 text-sm outline-none resize-none",
            "text-[var(--rc-text)] placeholder:text-[var(--rc-text-muted)]",
            "transition-[box-shadow,border-color,background-color] duration-150",
            className
          )}
          style={{
            background: "var(--rc-control-bg)",
            borderColor: "var(--rc-control-border)",
            boxShadow: error ? nmInsetError : nmInset,
            ...style,
          }}
          onFocus={(e) => {
            (e.currentTarget as HTMLTextAreaElement).style.boxShadow = nmInsetFocus;
            (e.currentTarget as HTMLTextAreaElement).style.borderColor = "rgba(0, 122, 255, 0.42)";
            onFocus?.(e);
          }}
          onBlur={(e) => {
            (e.currentTarget as HTMLTextAreaElement).style.boxShadow = error ? nmInsetError : nmInset;
            (e.currentTarget as HTMLTextAreaElement).style.borderColor = error ? "rgba(255, 59, 48, 0.45)" : "var(--rc-control-border)";
            onBlur?.(e);
          }}
          {...props}
        />
        {error && <p id={errorId} role="alert" className="mt-1 text-xs text-apple-red ml-1">{error}</p>}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";
