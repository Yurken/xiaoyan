import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Eye, EyeOff, LockKeyhole, ArrowRight } from "lucide-react";
import { Button, Card, Input } from "@research-copilot/ui";
import { useDesktopAuth } from "./useDesktopAuth";
import { hasToken } from "../../lib/apiBridge";
import { MAIN_ASSISTANT_WELCOME_TITLE, PRODUCT_NAME } from "@research-copilot/types";

export default function LoginPage() {
  const navigate = useNavigate();
  const {
    loading, error,
    loginWithEmail, registerWithEmail,
  } = useDesktopAuth();

  const [isRegister, setIsRegister] = useState(false);

  // Email
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // If already authenticated, go to home
  useEffect(() => {
    if (hasToken()) navigate("/", { replace: true });
  }, [navigate]);

  const goHome = () => navigate("/", { replace: true });

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) return;
    const fn = isRegister ? registerWithEmail : loginWithEmail;
    const ok = await fn(email.trim(), password);
    if (ok) goHome();
  };

  const canSubmit = Boolean(email.trim() && password.trim());

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

        <Card className="space-y-5 p-6">
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
            <div className="flex items-center gap-2 rounded-xl bg-apple-red/10 px-4 py-2.5 text-sm text-apple-red">
              <LockKeyhole className="h-4 w-4 shrink-0" /><span>{error}</span>
            </div>
          )}

          <Button variant="primary" size="lg" className="w-full" disabled={!canSubmit || loading} loading={loading} onClick={handleSubmit}>
            {isRegister ? "注册" : "登录"}
          </Button>

          <button type="button" onClick={() => setIsRegister((v) => !v)}
            className="block w-full text-center text-sm text-brand-500 hover:text-brand-400 transition-colors">
            {isRegister ? "已有账号？使用邮箱登录" : "没有账号？使用邮箱注册"}
          </button>
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
