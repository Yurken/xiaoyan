import { useState, useRef, useEffect } from "react";
import { X, Sparkles, Mail, Smartphone, Eye, EyeOff, LockKeyhole } from "lucide-react";
import { Button, Input } from "@research-copilot/ui";
import { useDesktopAuth, type AuthMethod } from "./useDesktopAuth";
import { hasToken } from "../../lib/apiBridge";
import { MAIN_ASSISTANT_WELCOME_TITLE, PRODUCT_NAME } from "@research-copilot/types";

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
  onLoginSuccess?: () => void;
}

export default function LoginModal({ open, onClose, onLoginSuccess }: LoginModalProps) {
  const { loading, error, loginWithEmail, registerWithEmail, sendPhoneCode, loginWithPhone } = useDesktopAuth();
  const [method, setMethod] = useState<AuthMethod>("email");
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [success, setSuccess] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  // Reset when opening/closing
  useEffect(() => {
    if (open) {
      setEmail(""); setPassword(""); setPhone(""); setCode("");
      setCodeSent(false); setCountdown(0); setSuccess(false);
      if (hasToken()) setSuccess(true);
    }
  }, [open]);

  useEffect(() => {
    if (countdown > 0 && !timerRef.current) {
      timerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) { clearInterval(timerRef.current); timerRef.current = undefined; return 0; }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [countdown]);

  if (!open) return null;

  const handleSendCode = async () => {
    if (!phone.trim() || countdown > 0) return;
    const ok = await sendPhoneCode(phone.trim());
    if (ok) { setCodeSent(true); setCountdown(60); }
  };

  const handleSubmit = async () => {
    if (method === "email") {
      if (!email.trim() || !password.trim()) return;
      const ok = await (isRegister ? registerWithEmail : loginWithEmail)(email.trim(), password);
      if (ok) { setSuccess(true); onLoginSuccess?.(); }
    } else {
      if (!phone.trim() || !code.trim()) return;
      const ok = await loginWithPhone(phone.trim(), code.trim());
      if (ok) { setSuccess(true); onLoginSuccess?.(); }
    }
  };

  const canSubmit = method === "email" ? email.trim() && password.trim() : phone.trim() && code.trim();

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

                {/* Method tabs */}
                <div className="mb-5 flex rounded-xl bg-nm-surface p-1 shadow-[var(--rc-inset-shadow)]">
                  <button type="button" onClick={() => setMethod("email")}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                      method === "email" ? "bg-nm-elevated text-ink-primary shadow-[var(--rc-flat-shadow)]" : "text-ink-tertiary hover:text-ink-secondary"}`}>
                    <Mail className="h-3.5 w-3.5" />邮箱
                  </button>
                  <button type="button" onClick={() => setMethod("phone")}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                      method === "phone" ? "bg-nm-elevated text-ink-primary shadow-[var(--rc-flat-shadow)]" : "text-ink-tertiary hover:text-ink-secondary"}`}>
                    <Smartphone className="h-3.5 w-3.5" />手机
                  </button>
                </div>

                <div className="space-y-4">
                  {method === "email" ? (<>
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
                  </>) : (<>
                    <Input label="手机号" type="tel" placeholder="请输入手机号" value={phone}
                      onChange={(e) => setPhone(e.target.value)} autoComplete="tel" autoFocus />
                    <div>
                      <label className="mb-1.5 ml-1 block text-xs font-medium text-ink-tertiary">验证码</label>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <input type="text" inputMode="numeric" maxLength={6} placeholder="6 位验证码" value={code}
                            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                            className="w-full rounded-xl border px-3 py-2 text-sm outline-none text-[var(--rc-text)] placeholder:text-[var(--rc-text-muted)]"
                            style={{background:"var(--rc-control-bg)",borderColor:"var(--rc-control-border)",boxShadow:"var(--rc-control-shadow)"}}
                            autoComplete="one-time-code" />
                        </div>
                        <button type="button" disabled={!phone.trim() || countdown > 0} onClick={handleSendCode}
                          className="shrink-0 rounded-xl px-3 py-2 text-xs font-medium disabled:opacity-40"
                          style={{background:"var(--rc-chip-bg)",color:countdown>0?"var(--rc-text-muted)":"var(--rc-accent)",boxShadow:"var(--rc-chip-shadow)"}}>
                          {countdown > 0 ? `${countdown}s` : codeSent ? "重发" : "获取"}
                        </button>
                      </div>
                    </div>
                  </>)}

                  {error && (
                    <div className="flex items-center gap-2 rounded-xl bg-apple-red/10 px-3 py-2 text-xs text-apple-red">
                      <LockKeyhole className="h-3.5 w-3.5 shrink-0" /><span>{error}</span>
                    </div>
                  )}

                  <Button variant="primary" size="md" className="w-full" disabled={!canSubmit || loading} loading={loading} onClick={handleSubmit}>
                    {method === "email" ? (isRegister ? "注册" : "登录") : (codeSent ? "登录" : "获取验证码")}
                  </Button>

                  {method === "email" && (
                    <button type="button" onClick={() => setIsRegister((v) => !v)}
                      className="block w-full text-center text-xs text-brand-500 hover:text-brand-400 transition-colors">
                      {isRegister ? "已有账号？登录" : "没有账号？注册"}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
