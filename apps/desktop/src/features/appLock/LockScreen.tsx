import { useState, useRef } from "react";
import { Lock, XCircle } from "lucide-react";
import appLogo from "../../assets/xiaoyanv.svg";

interface LockScreenProps {
  onVerified: () => void;
  onVerify: (password: string) => Promise<boolean>;
}

export default function LockScreen({ onVerified, onVerify }: LockScreenProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [shaking, setShaking] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async () => {
    if (busy || !password.trim()) return;
    setBusy(true);
    setError("");
    try {
      const ok = await onVerify(password);
      if (ok) {
        onVerified();
      } else {
        setError("密码错误");
        setShaking(true);
        setTimeout(() => setShaking(false), 400);
      }
    } catch (err) {
      setError(typeof err === "string" ? err : "验证失败");
      setShaking(true);
      setTimeout(() => setShaking(false), 400);
    } finally {
      setBusy(false);
      setPassword("");
      inputRef.current?.focus();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{
        background: "var(--rc-surface)",
      }}
    >
      <div
        className={`flex flex-col items-center gap-6 rounded-3xl p-10 transition-transform ${shaking ? "animate-[shake_0.4s_ease-in-out]" : ""}`}
        style={{
          background: "var(--rc-elevated)",
          boxShadow: "var(--rc-raised-shadow)",
          border: "1px solid var(--rc-border)",
        }}
      >
        <img src={appLogo} alt="小妍" className="h-16 w-16 rounded-2xl" />
        <div className="text-center space-y-1">
          <h2 className="text-lg font-bold text-ink-primary">小妍已锁定</h2>
          <p className="text-sm text-ink-tertiary">输入密码以解锁应用</p>
        </div>

        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
            placeholder="输入应用锁密码"
            autoFocus
            className="w-56 rounded-2xl px-4 py-2.5 text-sm outline-none"
            style={{
              background: "var(--rc-surface)",
              boxShadow: "var(--rc-inset-shadow)",
              color: "var(--rc-text)",
            }}
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-2xl px-5 py-2.5 text-sm font-semibold text-white transition-all active:scale-95 disabled:opacity-50"
            style={{
              background: "linear-gradient(145deg,#1A8AFF,#0062CC)",
              boxShadow: "4px 4px 10px rgba(0,62,204,0.3)",
            }}
          >
            <Lock className="h-4 w-4" />
            {busy ? "验证中…" : "解锁"}
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-1.5 text-sm text-apple-red">
            <XCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
}
