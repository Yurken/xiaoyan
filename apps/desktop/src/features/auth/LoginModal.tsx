import { useState, useEffect } from "react";
import { X, Sparkles, Eye, EyeOff, LockKeyhole } from "lucide-react";
import { Button, Input } from "@research-copilot/ui";
import { useDesktopAuth } from "./useDesktopAuth";
import { hasToken } from "../../lib/apiBridge";
import { MAIN_ASSISTANT_WELCOME_TITLE, PRODUCT_NAME } from "@research-copilot/types";

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
  onLoginSuccess?: () => void;
}

export default function LoginModal({ open, onClose, onLoginSuccess }: LoginModalProps) {
  const { loading, error, loginWithEmail, registerWithEmail } = useDesktopAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState(false);

  // Reset when opening/closing
  useEffect(() => {
    if (open) {
      setEmail(""); setPassword(""); setSuccess(false);
      if (hasToken()) setSuccess(true);
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) return;
    const ok = await (isRegister ? registerWithEmail : loginWithEmail)(email.trim(), password);
    if (ok) { setSuccess(true); onLoginSuccess?.(); }
  };

  const canSubmit = Boolean(email.trim() && password.trim());

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-6"
        style={{ background: "var(--rc-modal-backdrop, rgba(5,7,11,0.82))", backdropFilter: "blur(8px)" }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        {/* Modal */}
        <div className="relative w-full max-w-md animate-in zoom-in-95 fade-in duration-200"
          style={{
            background: "var(--rc-card-bg)",
            borderRadius: 28,
            boxShadow: "var(--rc-card-shadow)",
            border: "1px solid var(--rc-card-outline, transparent)",
          }}
        >
          {/* Close */}
          <button onClick={onClose}
            className="absolute right-4 top-4 rounded-xl p-2 text-ink-tertiary hover:text-ink-secondary transition-colors"
            style={{ background: "transparent" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--rc-chip-inset-bg)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            <X className="h-4 w-4" />
          </button>

          <div className="p-8">
            {/* Success state */}
            {success ? (
              <div className="flex flex-col items-center gap-4 py-6">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-apple-green/10">
                  <Sparkles className="h-7 w-7 text-apple-green" />
                </div>
                <h2 className="text-lg font-semibold text-ink-primary">已登录</h2>
                <p className="text-sm text-ink-tertiary text-center">
                  现在可以配置 WebDAV 同步，在多设备间共享数据备份。
                </p>
                <Button variant="primary" size="md" onClick={onClose} className="mt-2">
                  确定
                </Button>
              </div>
            ) : (
              <>
                {/* Brand */}
                <div className="mb-6 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-nm-surface shadow-[var(--rc-raised-shadow)]">
                    <Sparkles className="h-5 w-5 text-brand-500" />
                  </div>
                  <h2 className="text-base font-bold text-ink-primary">{PRODUCT_NAME}</h2>
                  <p className="mt-1 text-xs text-ink-tertiary">{MAIN_ASSISTANT_WELCOME_TITLE}</p>
                </div>

                <div className="space-y-4">
                  <Input label="邮箱" type="email" placeholder="your@email.com" value={email}
                    onChange={(e) => setEmail(e.target.value)} autoComplete="email" autoFocus />
                  <div className="relative">
                    <Input label="密码" type={showPassword ? "text" : "password"} placeholder="••••••••"
                      value={password} onChange={(e) => setPassword(e.target.value)}
                      autoComplete={isRegister ? "new-password" : "current-password"} />
                    <button type="button" onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-[34px] text-ink-tertiary hover:text-ink-secondary">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 rounded-xl bg-apple-red/10 px-3 py-2 text-xs text-apple-red">
                      <LockKeyhole className="h-3.5 w-3.5 shrink-0" /><span>{error}</span>
                    </div>
                  )}

                  <Button variant="primary" size="md" className="w-full" disabled={!canSubmit || loading} loading={loading} onClick={handleSubmit}>
                    {isRegister ? "注册" : "登录"}
                  </Button>

                  <button type="button" onClick={() => setIsRegister((v) => !v)}
                    className="block w-full text-center text-xs text-brand-500 hover:text-brand-400 transition-colors">
                    {isRegister ? "已有账号？登录" : "没有账号？注册"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
