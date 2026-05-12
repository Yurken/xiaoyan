import { useState } from "react";
import { KeyRound, Loader2, LockKeyhole, ShieldCheck, Trash2, UnlockKeyhole } from "lucide-react";
import { Card } from "@research-copilot/ui";
import PasswordInput from "../../components/PasswordInput";
import type { MemoryPrivacyGate } from "./useMemoryPrivacyGate";

interface MemoryPrivacyPanelProps {
  privacy: MemoryPrivacyGate;
}

function PasswordField({
  label,
  value,
  placeholder,
  onChange,
  onEnter,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  onEnter?: () => void;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="ml-1 block text-xs font-medium text-ink-tertiary">{label}</span>
      <PasswordInput
        value={value}
        onChange={onChange}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            onEnter?.();
          }
        }}
        placeholder={placeholder}
        className="!rounded-2xl !px-4 !py-2.5"
        style={{
          background: "var(--rc-chip-inset-bg)",
          boxShadow: "var(--rc-chip-inset-shadow)",
        }}
      />
    </label>
  );
}

export default function MemoryPrivacyPanel({ privacy }: MemoryPrivacyPanelProps) {
  const [unlockPassword, setUnlockPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const clearPasswordDrafts = () => {
    setNextPassword("");
    setConfirmPassword("");
  };

  const handleUnlock = async () => {
    const unlocked = await privacy.unlock(unlockPassword);
    if (unlocked) {
      setUnlockPassword("");
    }
  };

  const handleSetPassword = async () => {
    const saved = await privacy.setPassword(nextPassword, confirmPassword);
    if (saved) {
      clearPasswordDrafts();
    }
  };

  const handleClearPassword = async () => {
    const cleared = await privacy.clearPassword();
    if (cleared) {
      setUnlockPassword("");
      clearPasswordDrafts();
    }
  };

  const statusLabel = privacy.loading
    ? "检查中"
    : privacy.enabled
      ? privacy.unlocked
        ? "已解锁"
        : "已锁定"
      : "未设置";

  return (
    <Card padding="md" className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl"
            style={{
              background: "var(--rc-chip-inset-bg)",
              boxShadow: "var(--rc-chip-inset-shadow)",
              color: "#0A84FF",
            }}
          >
            <ShieldCheck className="h-4.5 w-4.5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-ink-primary">记忆详情密码</h2>
            <p className="mt-0.5 text-xs leading-5 text-ink-tertiary">
              保护自动操作记录和长期记忆观察详情。
            </p>
          </div>
        </div>
        <span
          className="inline-flex items-center gap-1.5 self-start rounded-full px-2.5 py-1 text-xs font-medium"
          style={{
            background: privacy.enabled ? "rgba(10,132,255,0.1)" : "var(--rc-chip-bg)",
            color: privacy.enabled ? "#0A84FF" : "var(--rc-text-soft)",
            boxShadow: "var(--rc-chip-shadow)",
          }}
        >
          {privacy.loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <LockKeyhole className="h-3 w-3" />}
          {statusLabel}
        </span>
      </div>

      {privacy.error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs leading-5 text-rose-700">
          {privacy.error}
        </div>
      ) : null}
      {privacy.message ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs leading-5 text-emerald-700">
          {privacy.message}
        </div>
      ) : null}

      {privacy.enabled && !privacy.unlocked ? (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr),auto] lg:items-end">
          <PasswordField
            label="输入密码"
            value={unlockPassword}
            placeholder="解锁详情"
            onChange={(value) => {
              setUnlockPassword(value);
              privacy.clearFeedback();
            }}
            onEnter={() => void handleUnlock()}
          />
          <button
            type="button"
            onClick={() => void handleUnlock()}
            disabled={privacy.loading || privacy.busy || !unlockPassword.trim()}
            className="flex items-center justify-center gap-1.5 rounded-2xl px-4 py-2.5 text-sm font-medium transition-all duration-150 active:scale-95 disabled:opacity-50"
            style={{
              background: "linear-gradient(145deg,#1A8AFF,#0062CC)",
              color: "#fff",
              boxShadow: "4px 4px 10px rgba(0,62,204,0.3), -3px -3px 8px rgba(58,155,255,0.15)",
            }}
          >
            {privacy.busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UnlockKeyhole className="h-3.5 w-3.5" />}
            解锁详情
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-3 lg:grid-cols-2">
            <PasswordField
              label={privacy.enabled ? "新密码" : "设置密码"}
              value={nextPassword}
              placeholder={privacy.enabled ? "输入新密码" : "输入密码"}
              onChange={(value) => {
                setNextPassword(value);
                privacy.clearFeedback();
              }}
              onEnter={() => void handleSetPassword()}
            />
            <PasswordField
              label="确认密码"
              value={confirmPassword}
              placeholder="再次输入"
              onChange={(value) => {
                setConfirmPassword(value);
                privacy.clearFeedback();
              }}
              onEnter={() => void handleSetPassword()}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleSetPassword()}
              disabled={privacy.loading || privacy.busy || !nextPassword.trim() || !confirmPassword.trim()}
              className="flex items-center gap-1.5 rounded-2xl px-3.5 py-2 text-xs font-medium transition-all duration-150 active:scale-95 disabled:opacity-50"
              style={{
                background: "var(--rc-chip-bg)",
                color: "var(--rc-text-soft)",
                boxShadow: "var(--rc-chip-shadow)",
              }}
            >
              {privacy.busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
              {privacy.enabled ? "更换密码" : "设置密码"}
            </button>
            {privacy.enabled ? (
              <>
                <button
                  type="button"
                  onClick={privacy.lock}
                  disabled={privacy.loading || privacy.busy}
                  className="flex items-center gap-1.5 rounded-2xl px-3.5 py-2 text-xs font-medium transition-all duration-150 active:scale-95 disabled:opacity-50"
                  style={{
                    background: "var(--rc-chip-bg)",
                    color: "var(--rc-text-soft)",
                    boxShadow: "var(--rc-chip-shadow)",
                  }}
                >
                  <LockKeyhole className="h-3.5 w-3.5" />
                  锁定详情
                </button>
                <button
                  type="button"
                  onClick={() => void handleClearPassword()}
                  disabled={privacy.loading || privacy.busy}
                  className="flex items-center gap-1.5 rounded-2xl px-3.5 py-2 text-xs font-medium transition-all duration-150 active:scale-95 disabled:opacity-50"
                  style={{
                    background: "rgba(255,59,48,0.08)",
                    color: "#D92D20",
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  移除密码
                </button>
              </>
            ) : null}
          </div>
        </div>
      )}
    </Card>
  );
}
