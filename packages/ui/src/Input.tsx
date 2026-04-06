import { clsx } from "clsx";
import { InputHTMLAttributes, TextareaHTMLAttributes, forwardRef } from "react";

const nmInset = "var(--rc-chip-inset-shadow, inset 2px 2px 5px #C8CDD3, inset -2px -2px 5px #FFFFFF)";
const nmInsetError = "inset 2px 2px 5px rgba(255,59,48,0.3), inset -2px -2px 5px rgba(255,255,255,0.6)";
const nmInsetFocus = "var(--rc-chip-inset-shadow, inset 2px 2px 5px #C8CDD3, inset -2px -2px 5px #FFFFFF), 0 0 0 2px rgba(0,122,255,0.25)";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, style, onFocus, onBlur, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-xs font-medium text-ink-tertiary mb-1.5 ml-1">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={clsx(
            "w-full rounded-2xl px-4 py-2.5 text-sm text-ink-primary",
            "placeholder:text-ink-tertiary",
            "outline-none border-0",
            "transition-shadow duration-150",
            className
          )}
          style={{
            background: "var(--rc-chip-inset-bg, #E8ECF0)",
            boxShadow: error ? nmInsetError : nmInset,
            ...style,
          }}
          onFocus={(e) => {
            (e.currentTarget as HTMLInputElement).style.boxShadow = nmInsetFocus;
            onFocus?.(e);
          }}
          onBlur={(e) => {
            (e.currentTarget as HTMLInputElement).style.boxShadow = error ? nmInsetError : nmInset;
            onBlur?.(e);
          }}
          {...props}
        />
        {error && <p className="mt-1 text-xs text-apple-red ml-1">{error}</p>}
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
  ({ label, error, className, style, onFocus, onBlur, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-xs font-medium text-ink-tertiary mb-1.5 ml-1">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          className={clsx(
            "w-full rounded-2xl px-4 py-2.5 text-sm text-ink-primary",
            "placeholder:text-ink-tertiary",
            "outline-none border-0 resize-none",
            "transition-shadow duration-150",
            className
          )}
          style={{
            background: "var(--rc-chip-inset-bg, #E8ECF0)",
            boxShadow: error ? nmInsetError : nmInset,
            ...style,
          }}
          onFocus={(e) => {
            (e.currentTarget as HTMLTextAreaElement).style.boxShadow = nmInsetFocus;
            onFocus?.(e);
          }}
          onBlur={(e) => {
            (e.currentTarget as HTMLTextAreaElement).style.boxShadow = error ? nmInsetError : nmInset;
            onBlur?.(e);
          }}
          {...props}
        />
        {error && <p className="mt-1 text-xs text-apple-red ml-1">{error}</p>}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";
