import { useState } from "react";
import { Card } from "@research-copilot/ui";
import {
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Power,
  FolderSync,
} from "lucide-react";
import { SectionIcon } from "./shared";
import { useSync } from "./useSync";

/**
 * 无冲突自动同步设置区。
 *
 * 与「WebDAV 备份」不同，这里是基于每设备状态文件的记录级合并同步：
 * 配置一次后，应用会在启动 / 切回前台 / 定时 自动后台同步，多设备不冲突、不丢数据。
 */
export default function SyncSection() {
  const {
    status,
    url,
    setUrl,
    username,
    setUsername,
    loading,
    busy,
    error,
    configure,
    syncNow,
    disable,
  } = useSync();

  const [password, setPassword] = useState("");

  const handleEnable = async () => {
    const ok = await configure(password);
    if (ok) setPassword("");
  };

  const inputStyle = {
    background: "var(--rc-control-bg)",
    borderColor: "var(--rc-control-border)",
    boxShadow: "var(--rc-control-shadow)",
  } as const;

  return (
    <Card padding="md" className="space-y-4">
      <div className="flex items-center gap-3">
        <SectionIcon icon={FolderSync} color="#34C759" />
        <div className="flex-1">
          <h2 className="text-base font-semibold text-ink-primary">自动同步（无冲突）</h2>
          <p className="mt-0.5 text-xs text-ink-tertiary">
            基于 WebDAV 的多设备实时合并：启动、切回前台、定时自动同步，删除会传播，且不会互相覆盖。
          </p>
        </div>
        {status.configured && (
          <span className="flex items-center gap-1.5 rounded-full bg-apple-green/10 px-3 py-1 text-xs font-medium text-apple-green">
            {status.running ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}
            {status.running ? "同步中" : "已启用"}
          </span>
        )}
      </div>

      {/* 配置区 */}
      <div
        className="grid gap-3 rounded-2xl p-4"
        style={{ background: "var(--rc-chip-inset-bg)", boxShadow: "var(--rc-chip-inset-shadow)" }}
      >
        <div className="grid gap-3 md:grid-cols-3">
          <div className="md:col-span-3">
            <label className="mb-1.5 ml-1 block text-xs font-medium text-ink-tertiary">服务器地址</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={busy}
              placeholder="https://dav.jianguoyun.com/dav/"
              className="w-full rounded-2xl border px-4 py-2.5 text-sm outline-none text-[var(--rc-text)] placeholder:text-[var(--rc-text-muted)]"
              style={inputStyle}
            />
          </div>
          <div>
            <label className="mb-1.5 ml-1 block text-xs font-medium text-ink-tertiary">用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={busy}
              placeholder="账号"
              className="w-full rounded-2xl border px-4 py-2.5 text-sm outline-none text-[var(--rc-text)] placeholder:text-[var(--rc-text-muted)]"
              style={inputStyle}
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1.5 ml-1 block text-xs font-medium text-ink-tertiary">
              密码 {status.configured && "（如需更改凭据请重新填写）"}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
              placeholder={status.configured ? "已保存于系统钥匙串" : "应用密码 / WebDAV 密码"}
              className="w-full rounded-2xl border px-4 py-2.5 text-sm outline-none text-[var(--rc-text)] placeholder:text-[var(--rc-text-muted)]"
              style={inputStyle}
            />
          </div>
        </div>

        <p className="ml-1 text-xs text-ink-quaternary">
          密码同时用于端到端加密，仅保存在本机系统钥匙串；多台设备请使用同一 WebDAV 账号与密码。
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleEnable}
            disabled={busy || !url.trim() || !username.trim() || !password.trim()}
            className="flex items-center gap-1.5 rounded-2xl px-4 py-2.5 text-sm font-medium text-white transition-all duration-150 active:scale-95 disabled:opacity-50"
            style={{ background: "linear-gradient(145deg,#30D158,#248A3D)", boxShadow: "4px 4px 10px rgba(36,138,61,0.3)" }}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {status.configured ? "更新并同步" : "启用同步"}
          </button>

          {status.configured && (
            <>
              <button
                type="button"
                onClick={syncNow}
                disabled={busy || status.running}
                className="flex items-center gap-1.5 rounded-2xl px-4 py-2.5 text-sm font-medium transition-all duration-150 active:scale-95 disabled:opacity-50"
                style={{ background: "var(--rc-chip-bg)", color: "var(--rc-text-soft)", boxShadow: "var(--rc-chip-shadow)" }}
              >
                <RefreshCw className={`h-4 w-4 ${status.running ? "animate-spin" : ""}`} />
                立即同步
              </button>
              <button
                type="button"
                onClick={disable}
                disabled={busy}
                className="flex items-center gap-1.5 rounded-2xl px-4 py-2.5 text-sm font-medium text-apple-red transition-all duration-150 active:scale-95 disabled:opacity-50"
                style={{ background: "var(--rc-chip-bg)", boxShadow: "var(--rc-chip-shadow)" }}
              >
                <Power className="h-4 w-4" />
                停用
              </button>
            </>
          )}
        </div>

        {/* 状态行 */}
        {!loading && status.configured && status.last_sync_at && (
          <div className="ml-1 text-xs text-ink-tertiary">
            上次同步：{status.last_sync_at}
            {status.last_message ? ` · ${status.last_message}` : ""}
          </div>
        )}

        {error && (
          <div className="rounded-xl bg-apple-red/10 px-4 py-2.5 text-xs text-apple-red">
            <AlertCircle className="mr-1.5 inline-block h-3.5 w-3.5" />
            {error}
          </div>
        )}
        {status.last_error && !error && (
          <div className="rounded-xl bg-apple-red/10 px-4 py-2.5 text-xs text-apple-red">
            <AlertCircle className="mr-1.5 inline-block h-3.5 w-3.5" />
            上次同步失败：{status.last_error}
          </div>
        )}
      </div>
    </Card>
  );
}
