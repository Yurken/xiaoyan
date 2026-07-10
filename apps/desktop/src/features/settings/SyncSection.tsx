import { useState } from "react";
import { Card } from "@research-copilot/ui";
import {
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Power,
  FolderSync,
  Link2,
} from "lucide-react";
import { SectionIcon } from "./shared";
import { useSync } from "./useSync";
import { apiClient, type SyncSummary } from "../../lib/client";

/** 把同步结果转成给用户看的中文说明，重点强调本地数据已保留。 */
function describeSummary(s: SyncSummary): string {
  if (s.pulled_devices === 0) {
    return "这是接入的第一台设备，本地数据已全部上传到云端，可放心在其它设备登录同步。";
  }
  const parts = [`已与 ${s.pulled_devices} 台设备合并`];
  if (s.rows_applied > 0) parts.push(`新增/更新 ${s.rows_applied} 条记录`);
  if (s.rows_deleted > 0) parts.push(`应用 ${s.rows_deleted} 条删除`);
  if (s.assets_downloaded > 0) parts.push(`下载 ${s.assets_downloaded} 个附件`);
  return `${parts.join("，")}；本地原有数据已保留并上传，不会被覆盖。`;
}

function formatSyncTime(value: string): string {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) return value;
  return timestamp.toLocaleString("zh-CN", { hour12: false });
}

/**
 * WebDAV 同步设置区（无冲突自动同步）。
 *
 * 基于每设备状态文件的记录级合并同步：配置一次 WebDAV 账号后，
 * 应用会在启动后、每 15 分钟以及切回前台时检查同步；后台同步受 15 分钟冷却限制。
 */
export default function SyncSection() {
  const {
    status,
    url,
    setUrl,
    username,
    setUsername,
    hasSavedCredentials,
    loading,
    busy,
    error,
    lastSummary,
    configure,
    syncNow,
    disable,
  } = useSync();

  const [password, setPassword] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);

  const handleEnable = async () => {
    const ok = await configure(password);
    if (ok) setPassword("");
  };

  const handleTestConnection = async () => {
    if (!url.trim() || !username.trim() || !password.trim()) return;
    setTesting(true);
    setTestResult(null);
    try {
      await apiClient.settings.webdav.testConnection(url, username, password);
      setTestResult({ ok: true, text: "连接成功，账号可用" });
    } catch (e) {
      setTestResult({ ok: false, text: `连接失败：${e instanceof Error ? e.message : "请检查地址与账号密码"}` });
    } finally {
      setTesting(false);
    }
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
          <h2 className="flex items-center gap-2 text-base font-semibold text-ink-primary">
            WebDAV 同步
            <span
              className="rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
              style={{ background: "rgba(255,159,10,0.15)", color: "#FF9F0A" }}
            >
              beta
            </span>
          </h2>
          <p className="mt-0.5 text-xs text-ink-tertiary">
            填一次账号即可多设备自动同步：启动后、每 15 分钟及切回前台会检查；后台请求最多每 15 分钟一次。
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
              密码 {hasSavedCredentials && "（已安全保存；留空可重新启用）"}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
              placeholder={hasSavedCredentials ? "已保存于系统钥匙串" : "应用密码 / WebDAV 密码"}
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
            onClick={handleTestConnection}
            disabled={busy || testing || !url.trim() || !username.trim() || !password.trim()}
            className="flex items-center gap-1.5 rounded-2xl px-4 py-2.5 text-sm font-medium transition-all duration-150 active:scale-95 disabled:opacity-50"
            style={{
              background: testResult?.ok ? "rgba(52,199,89,0.12)" : "var(--rc-chip-bg)",
              color: testResult?.ok ? "#34C759" : "var(--rc-text-soft)",
              boxShadow: testResult?.ok ? "none" : "var(--rc-chip-shadow)",
            }}
          >
            {testing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : testResult?.ok ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <Link2 className="h-4 w-4" />
            )}
            {testing ? "测试中…" : testResult?.ok ? "连接正常" : "测试连接"}
          </button>

          <button
            type="button"
            onClick={handleEnable}
            disabled={busy || !url.trim() || !username.trim() || (!password.trim() && !hasSavedCredentials)}
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
                停用（保留账号）
              </button>
            </>
          )}
        </div>

        {/* 测试连接结果 */}
        {testResult && (
          <div
            className={`flex items-start gap-1.5 rounded-xl px-4 py-2.5 text-xs ${
              testResult.ok ? "bg-apple-green/10 text-apple-green" : "bg-apple-red/10 text-apple-red"
            }`}
          >
            {testResult.ok ? (
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            ) : (
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            )}
            <span>{testResult.text}</span>
          </div>
        )}

        {/* 首次配置 / 手动同步后的合并结果说明 */}
        {lastSummary && !error && (
          <div className="flex items-start gap-1.5 rounded-xl bg-apple-green/10 px-4 py-2.5 text-xs text-apple-green">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{describeSummary(lastSummary)}</span>
          </div>
        )}

        {/* 状态行 */}
        {!loading && status.configured && status.last_sync_at && (
          <div className="ml-1 text-xs text-ink-tertiary">
            上次同步：{formatSyncTime(status.last_sync_at)}
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
