import { Eye, EyeOff } from "lucide-react";
import { forwardRef, useState } from "react";

interface PasswordInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
  autoFocus?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(function PasswordInput(
  { value, onChange, placeholder, className, style, id, autoFocus, onKeyDown },
  ref,
) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative">
      <input
        ref={ref}
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={`w-full rounded-xl px-3 py-2 pr-9 text-sm outline-none ${className ?? ""}`}
        style={{
          background: "var(--rc-surface)",
          boxShadow: "var(--rc-inset-shadow)",
          color: "var(--rc-text)",
          ...style,
        }}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-tertiary hover:text-ink-primary transition-colors"
        tabIndex={-1}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
});

export default PasswordInput;
