import { KeyRound, Loader2 } from "lucide-react";
import PasswordInput from "../../components/PasswordInput";
import type { CryptoModalState } from "./useSettingsCrypto";

interface CryptoConfigModalProps {
  modal: Exclude<CryptoModalState, null>;
  password: string;
  confirm: string;
  busy: boolean;
  error: string;
  onPasswordChange: (value: string) => void;
  onConfirmChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void | Promise<void>;
}

export default function CryptoConfigModal({
  modal,
  password,
  confirm,
  busy,
  error,
  onPasswordChange,
  onConfirmChange,
  onClose,
  onSubmit,
}: CryptoConfigModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-sm mx-4 rounded-3xl p-6 space-y-4"
        style={{ background: "var(--rc-card-bg)", boxShadow: "12px 12px 28px rgba(0,0,0,0.45), 0 0 0 1px var(--rc-border)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: "var(--rc-chip-inset-bg)", boxShadow: "var(--rc-chip-inset-shadow)" }}
          >
            <KeyRound className="w-5 h-5 text-apple-blue" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-ink-primary">
              {modal.mode === "export" ? "加密导出配置" : "解密导入配置"}
            </h3>
            <p className="text-xs text-ink-tertiary mt-0.5">
              {modal.mode === "export"
                ? "设置一个密码保护配置文件，导入时需要输入同一密码。"
                : "输入导出时设置的密码解锁配置文件。"}
            </p>
          </div>
        </div>

        <div className="space-y-2.5">
          <div className="space-y-1">
            <label className="text-xs font-medium text-ink-tertiary ml-1">密码</label>
            <PasswordInput
              value={password}
              onChange={onPasswordChange}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !busy) void onSubmit();
              }}
              placeholder="输入密码"
              autoFocus
              className="!rounded-2xl !px-4 !py-2.5"
              style={{ background: "var(--rc-chip-inset-bg)", boxShadow: "var(--rc-chip-inset-shadow)" }}
            />
          </div>

          {modal.mode === "export" ? (
            <div className="space-y-1">
              <label className="text-xs font-medium text-ink-tertiary ml-1">确认密码</label>
              <PasswordInput
                value={confirm}
                onChange={onConfirmChange}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !busy) void onSubmit();
                }}
                placeholder="再次输入密码"
                className="!rounded-2xl !px-4 !py-2.5"
                style={{ background: "var(--rc-chip-inset-bg)", boxShadow: "var(--rc-chip-inset-shadow)" }}
              />
            </div>
          ) : null}

          {modal.mode === "export" ? (
            <p className="text-xs text-ink-tertiary leading-relaxed px-1">
              配置文件包含所有 API Key，请妥善保管，切勿分享给他人。
            </p>
          ) : null}

          {error ? <p className="text-xs text-apple-red px-1">{error}</p> : null}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 rounded-2xl text-sm font-medium transition-all duration-150"
            style={{ background: "var(--rc-chip-bg)", color: "var(--rc-text-soft)", boxShadow: "var(--rc-chip-shadow)" }}
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => void onSubmit()}
            disabled={busy || !password.trim()}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-2xl text-sm font-semibold text-white transition-all duration-150 active:scale-95 disabled:opacity-50"
            style={{ background: "linear-gradient(145deg, #1A8AFF, #0062CC)", boxShadow: "4px 4px 10px rgba(0,62,204,0.3)" }}
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
            {busy ? "处理中…" : modal.mode === "export" ? "加密并保存" : "解密并导入"}
          </button>
        </div>
      </div>
    </div>
  );
}
