import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Mail, Smartphone, Eye, EyeOff, LockKeyhole, ArrowRight } from "lucide-react";
import { Button, Card, Input } from "@research-copilot/ui";
import { useDesktopAuth, type AuthMethod } from "./useDesktopAuth";
import { hasToken } from "../../lib/apiBridge";
import { MAIN_ASSISTANT_WELCOME_TITLE, PRODUCT_NAME } from "@research-copilot/types";

export default function LoginPage() {
  const navigate = useNavigate();
  const {
    loading, error,
    loginWithEmail, registerWithEmail,
    sendPhoneCode, loginWithPhone,
  } = useDesktopAuth();

  const [method, setMethod] = useState<AuthMethod>("email");
  const [isRegister, setIsRegister] = useState(false);

  // Email
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Phone
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  // If already authenticated, go to home
  useEffect(() => {
    if (hasToken()) navigate("/", { replace: true });
  }, [navigate]);

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

  const goHome = () => navigate("/", { replace: true });

  const handleSendCode = async () => {
    if (!phone.trim() || countdown > 0) return;
    const ok = await sendPhoneCode(phone.trim());
    if (ok) { setCodeSent(true); setCountdown(60); }
  };

  const handleSubmit = async () => {
    if (method === "email") {
      if (!email.trim() || !password.trim()) return;
      const fn = isRegister ? registerWithEmail : loginWithEmail;
      const ok = await fn(email.trim(), password);
      if (ok) goHome();
    } else {
      if (!phone.trim() || !code.trim()) return;
      const ok = await loginWithPhone(phone.trim(), code.trim());
      if (ok) goHome();
    }
  };

  const canSubmit = method === "email"
    ? email.trim() && password.trim()
    : phone.trim() && code.trim();

  return (
    <div className="flex min-h-screen items-center justify-center bg-nm-bg p-6">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-brand-500/5 blur-[120px]" />
        <div className="absolute -bottom-32 -left-32 h-[400px] w-[400px] rounded-full bg-brand-500/5 blur-[100px]" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-nm-surface shadow-[var(--rc-raised-shadow)]">
            <Sparkles className="h-7 w-7 text-brand-500" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-ink-primary">{PRODUCT_NAME}</h1>
          <p className="mt-1.5 text-sm text-ink-tertiary">{MAIN_ASSISTANT_WELCOME_TITLE}</p>
        </div>

        <div className="mb-6 flex rounded-2xl bg-nm-surface p-1 shadow-[var(--rc-inset-shadow)]">
          <button type="button" onClick={() => setMethod("email")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
              method === "email" ? "bg-nm-elevated text-ink-primary shadow-[var(--rc-flat-shadow)]" : "text-ink-tertiary hover:text-ink-secondary"}`}>
            <Mail className="h-4 w-4" />邮箱
          </button>
          <button type="button" onClick={() => setMethod("phone")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
              method === "phone" ? "bg-nm-elevated text-ink-primary shadow-[var(--rc-flat-shadow)]" : "text-ink-tertiary hover:text-ink-secondary"}`}>
            <Smartphone className="h-4 w-4" />手机
          </button>
        </div>

        <Card className="space-y-5 p-6">
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
              <div className="flex gap-3">
                <div className="flex-1">
                  <input type="text" inputMode="numeric" maxLength={6} placeholder="6 位验证码" value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="w-full rounded-2xl border px-4 py-2.5 text-sm outline-none text-[var(--rc-text)] placeholder:text-[var(--rc-text-muted)]"
                    style={{background:"var(--rc-control-bg)",borderColor:"var(--rc-control-border)",boxShadow:"var(--rc-control-shadow)"}}
                    autoComplete="one-time-code" />
                </div>
                <button type="button" disabled={!phone.trim() || countdown > 0} onClick={handleSendCode}
                  className="shrink-0 rounded-2xl px-4 py-2.5 text-sm font-medium disabled:opacity-40"
                  style={{background:"var(--rc-chip-bg)",color:countdown>0?"var(--rc-text-muted)":"var(--rc-accent)",boxShadow:"var(--rc-chip-shadow)"}}>
                  {countdown > 0 ? `${countdown}s` : codeSent ? "重新发送" : "获取验证码"}
                </button>
              </div>
            </div>
          </>)}

          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-apple-red/10 px-4 py-2.5 text-sm text-apple-red">
              <LockKeyhole className="h-4 w-4 shrink-0" /><span>{error}</span>
            </div>
          )}

          <Button variant="primary" size="lg" className="w-full" disabled={!canSubmit || loading} loading={loading} onClick={handleSubmit}>
            {method === "email" ? (isRegister ? "注册" : "登录") : (codeSent ? "登录" : "获取验证码")}
          </Button>

          {method === "email" && (
            <button type="button" onClick={() => setIsRegister((v) => !v)}
              className="block w-full text-center text-sm text-brand-500 hover:text-brand-400 transition-colors">
              {isRegister ? "已有账号？使用邮箱登录" : "没有账号？使用邮箱注册"}
            </button>
          )}
        </Card>

        <div className="mt-6 text-center">
          <button type="button" onClick={goHome}
            className="inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-medium text-ink-tertiary hover:text-ink-secondary transition-colors">
            跳过，本地使用<ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
