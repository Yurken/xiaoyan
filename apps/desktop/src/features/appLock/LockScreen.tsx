import { useState, useRef, useEffect } from "react";
import { ArrowLeft, Lock, ShieldCheck, XCircle } from "lucide-react";
import appLogo from "../../assets/xiaoyanv.svg";
import PasswordInput from "../../components/PasswordInput";

interface RecoveryInfo {
  hint: string;
  question: string;
  hasEmail?: boolean;
  hasSecurity?: boolean;
}

interface LockScreenProps {
  onVerified: () => void;
  onVerify: (password: string) => Promise<boolean>;
  onGetRecoveryInfo: () => Promise<RecoveryInfo>;
  onVerifyRecovery: (email: string, answer: string) => Promise<boolean>;
  onResetPassword: (email: string, answer: string, newPassword: string) => Promise<void>;
}

export default function LockScreen({
  onVerified,
  onVerify,
  onGetRecoveryInfo,
  onVerifyRecovery,
  onResetPassword,
}: LockScreenProps) {
  const [mode, setMode] = useState<"unlock" | "forgot" | "reset">("unlock");

  // Unlock
  const [password, setPassword] = useState("");

  // Recovery
  const [recoveryHint, setRecoveryHint] = useState("");
  const [recoveryQuestion, setRecoveryQuestion] = useState("");
  const [recoveryHasEmail, setRecoveryHasEmail] = useState(true);
  const [recoveryHasSecurity, setRecoveryHasSecurity] = useState(true);
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoveryAnswer, setRecoveryAnswer] = useState("");

  // Reset
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");

  // Common
  const [error, setError] = useState("");
  const [shaking, setShaking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mode === "unlock") {
      inputRef.current?.focus();
    }
  }, [mode]);

  const triggerShake = () => {
    setShaking(true);
    setTimeout(() => setShaking(false), 400);
  };

  const handleUnlock = async () => {
    if (busy || !password.trim()) return;
    setBusy(true);
    setError("");
    setSuccessMsg("");
    try {
      const ok = await onVerify(password);
      if (ok) {
        onVerified();
      } else {
        setError("密码错误");
        triggerShake();
      }
    } catch (err) {
      setError(typeof err === "string" ? err : "验证失败");
      triggerShake();
    } finally {
      setBusy(false);
      setPassword("");
      inputRef.current?.focus();
    }
  };

  const handleStartForgot = async () => {
    setError("");
    setSuccessMsg("");
    setRecoveryEmail("");
    setRecoveryAnswer("");
    setNewPassword("");
    setNewPasswordConfirm("");
    try {
      const info = await onGetRecoveryInfo();
      setRecoveryHint(info.hint);
      setRecoveryQuestion(info.question);
      setRecoveryHasEmail(info.hasEmail !== false);
      setRecoveryHasSecurity(info.hasSecurity !== false);
      setMode("forgot");
    } catch (err) {
      setError(typeof err === "string" ? err : "获取找回信息失败");
    }
  };

  const handleVerifyRecovery = async () => {
    if (busy || !recoveryHasEmail || !recoveryHasSecurity || !recoveryEmail.trim()) return;
    setBusy(true);
    setError("");
    try {
      const ok = await onVerifyRecovery(recoveryEmail, recoveryAnswer);
      if (!ok) {
        setError("邮箱或密保答案不正确");
        triggerShake();
        return;
      }
      setMode("reset");
    } catch (err) {
      setError(typeof err === "string" ? err : "验证失败");
      triggerShake();
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async () => {
    if (busy || !newPassword.trim()) return;
    if (newPassword !== newPasswordConfirm) {
      setError("两次密码不一致");
      triggerShake();
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onResetPassword(recoveryEmail, recoveryAnswer, newPassword);
      setSuccessMsg("密码已重置，请用新密码解锁");
      setMode("unlock");
      setNewPassword("");
      setNewPasswordConfirm("");
      setRecoveryEmail("");
      setRecoveryAnswer("");
    } catch (err) {
      setError(typeof err === "string" ? err : "重置失败");
      triggerShake();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: "var(--rc-surface)" }}
    >
      <div
        className={`flex flex-col items-center gap-6 rounded-3xl p-10 transition-transform ${shaking ? "animate-[shake_0.4s_ease-in-out]" : ""}`}
        style={{
          background: "var(--rc-elevated)",
          boxShadow: "var(--rc-raised-shadow)",
          border: "1px solid var(--rc-border)",
          minWidth: 320,
        }}
      >
        <img src={appLogo} alt="小妍" className="h-16 w-16 rounded-2xl" />
        <div className="text-center space-y-1">
          {mode === "unlock" && (
            <>
              <h2 className="text-lg font-bold text-ink-primary">小妍已锁定</h2>
              <p className="text-sm text-ink-tertiary">输入密码以解锁应用</p>
            </>
          )}
          {mode === "forgot" && (
            <>
              <h2 className="text-lg font-bold text-ink-primary">找回密码</h2>
              <p className="text-sm text-ink-tertiary">验证身份后重置密码</p>
            </>
          )}
          {mode === "reset" && (
            <>
              <h2 className="text-lg font-bold text-ink-primary">重置密码</h2>
              <p className="text-sm text-ink-tertiary">设置新的应用锁密码</p>
            </>
          )}
        </div>

        {mode === "unlock" && (
          <>
            <div className="flex items-center gap-2 w-full">
              <PasswordInput
                ref={inputRef}
                value={password}
                onChange={(v) => { setPassword(v); setError(""); setSuccessMsg(""); }}
                onKeyDown={(e) => { if (e.key === "Enter") handleUnlock(); }}
                placeholder="输入应用锁密码"
                autoFocus
                className="!rounded-2xl !pl-4 !pr-10 !py-2.5"
              />
              <button
                type="button"
                onClick={handleUnlock}
                disabled={busy}
                className="flex items-center gap-1.5 rounded-2xl px-5 py-2.5 text-sm font-semibold text-white transition-all active:scale-95 disabled:opacity-50 shrink-0"
                style={{
                  background: "linear-gradient(145deg,#1A8AFF,#0062CC)",
                  boxShadow: "4px 4px 10px rgba(0,62,204,0.3)",
                }}
              >
                <Lock className="h-4 w-4" />
                {busy ? "验证中…" : "解锁"}
              </button>
            </div>
            <button
              type="button"
              onClick={handleStartForgot}
              className="text-xs text-[#007AFF] hover:underline"
            >
              忘记密码？
            </button>
          </>
        )}

        {mode === "forgot" && (
          <div className="w-full space-y-3">
            {recoveryHint && (
              <div className="rounded-xl px-3 py-2 text-xs text-ink-secondary" style={{ background: "var(--rc-chip-inset-bg)" }}>
                <span className="font-medium text-ink-primary">密码提示：</span> {recoveryHint}
              </div>
            )}
            {recoveryQuestion && (
              <div className="rounded-xl px-3 py-2 text-xs text-ink-secondary" style={{ background: "var(--rc-chip-inset-bg)" }}>
                <span className="font-medium text-ink-primary">密保问题：</span> {recoveryQuestion}
              </div>
            )}
            {!recoveryHasEmail && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-700">
                当前应用锁未绑定邮箱，无法通过邮箱找回密码。
              </div>
            )}
            {recoveryHasEmail && !recoveryHasSecurity && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-700">
                当前应用锁未设置密保问题，无法通过邮箱找回密码。
              </div>
            )}
            <input
              type="email"
              value={recoveryEmail}
              onChange={(e) => { setRecoveryEmail(e.target.value); setError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleVerifyRecovery(); }}
              placeholder="输入绑定邮箱"
              disabled={!recoveryHasEmail || !recoveryHasSecurity}
              className="w-full rounded-2xl px-4 py-2.5 text-sm outline-none"
              style={{
                background: "var(--rc-surface)",
                boxShadow: "var(--rc-inset-shadow)",
                color: "var(--rc-text)",
              }}
            />
            <input
              type="text"
              value={recoveryAnswer}
              onChange={(e) => { setRecoveryAnswer(e.target.value); setError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleVerifyRecovery(); }}
              placeholder={recoveryQuestion ? "输入密保答案" : "未设置密保，无法找回"}
              disabled={!recoveryHasEmail || !recoveryHasSecurity}
              className="w-full rounded-2xl px-4 py-2.5 text-sm outline-none"
              style={{
                background: "var(--rc-surface)",
                boxShadow: "var(--rc-inset-shadow)",
                color: "var(--rc-text)",
              }}
            />
            <button
              type="button"
              onClick={handleVerifyRecovery}
              disabled={busy || !recoveryHasEmail || !recoveryHasSecurity || !recoveryEmail.trim()}
              className="w-full flex items-center justify-center gap-1.5 rounded-2xl px-5 py-2.5 text-sm font-semibold text-white transition-all active:scale-95 disabled:opacity-50"
              style={{
                background: "linear-gradient(145deg,#1A8AFF,#0062CC)",
                boxShadow: "4px 4px 10px rgba(0,62,204,0.3)",
              }}
            >
              <ShieldCheck className="h-4 w-4" />
              {busy ? "验证中…" : "验证并继续"}
            </button>
            <button
              type="button"
              onClick={() => { setMode("unlock"); setError(""); }}
              className="mx-auto flex items-center gap-1 text-xs text-ink-tertiary hover:text-ink-secondary transition-colors"
            >
              <ArrowLeft className="h-3 w-3" />
              返回解锁
            </button>
          </div>
        )}

        {mode === "reset" && (
          <div className="w-full space-y-3">
            <PasswordInput
              value={newPassword}
              onChange={(v) => { setNewPassword(v); setError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleReset(); }}
              placeholder="输入新密码"
              autoFocus
              className="!rounded-2xl !pl-4 !pr-10 !py-2.5"
            />
            <PasswordInput
              value={newPasswordConfirm}
              onChange={(v) => { setNewPasswordConfirm(v); setError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleReset(); }}
              placeholder="确认新密码"
              className="!rounded-2xl !pl-4 !pr-10 !py-2.5"
            />
            <button
              type="button"
              onClick={handleReset}
              disabled={busy || !newPassword.trim() || !newPasswordConfirm.trim()}
              className="w-full flex items-center justify-center gap-1.5 rounded-2xl px-5 py-2.5 text-sm font-semibold text-white transition-all active:scale-95 disabled:opacity-50"
              style={{
                background: "linear-gradient(145deg,#1A8AFF,#0062CC)",
                boxShadow: "4px 4px 10px rgba(0,62,204,0.3)",
              }}
            >
              <Lock className="h-4 w-4" />
              {busy ? "重置中…" : "确认重置"}
            </button>
            <button
              type="button"
              onClick={() => { setMode("forgot"); setError(""); }}
              className="mx-auto flex items-center gap-1 text-xs text-ink-tertiary hover:text-ink-secondary transition-colors"
            >
              <ArrowLeft className="h-3 w-3" />
              返回上一步
            </button>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-1.5 text-sm text-apple-red">
            <XCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}
        {successMsg && mode === "unlock" && (
          <div className="flex items-center gap-1.5 text-sm text-[#34C759]">
            <ShieldCheck className="h-4 w-4" />
            <span>{successMsg}</span>
          </div>
        )}
      </div>
    </div>
  );
}
