import { useState, useCallback, useEffect } from "react";
import { Card } from "@research-copilot/ui";
import { Cloud, Link2, Upload, Download, Trash2, Loader2, CheckCircle2, AlertCircle, CircleUser, CircleCheck, LogOut, Lock } from "lucide-react";
import { SectionIcon } from "./shared";
import { apiClient } from "../../lib/client";
import LoginModal from "../auth/LoginModal";
import { useDesktopAuth } from "../auth/useDesktopAuth";
import { hasToken } from "../../lib/apiBridge";
import { loadWebdavConfig, saveWebdavConfig } from "./webdavConfigStorage";

interface WebdavFile {
  name: string;
  path: string;
  size: number;
  lastModified: string;
}

export default function WebdavSyncSection() {
  const { logout } = useDesktopAuth();
  const [loginOpen, setLoginOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState(hasToken());

  const initialConfig = loadWebdavConfig();
  const [url, setUrl] = useState(initialConfig.url);
  const [username, setUsername] = useState(initialConfig.username);
  const [password, setPassword] = useState(initialConfig.password);

  const [testing, setTesting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [connectionError, setConnectionError] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [backups, setBackups] = useState<WebdavFile[]>([]);
  const [listingBackups, setListingBackups] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  // Sync is tied to the login session; remember the server config across restarts.
  useEffect(() => {
    saveWebdavConfig({ url, username, password });
  }, [url, username, password]);

  // A connection is only trusted within a logged-in session — re-verify after re-login.
  useEffect(() => {
    if (!loggedIn) {
      setConnected(false);
      setBackups([]);
      setConnectionError("");
      setSyncMsg("");
    }
  }, [loggedIn]);

  const handleLogout = useCallback(() => {
    logout();
    setLoggedIn(false);
  }, [logout]);

  const handleTestConnection = useCallback(async () => {
    if (!loggedIn || !url.trim()) return;
    setTesting(true);
    setConnectionError("");
    setConnected(false);
    try {
      await apiClient.settings.webdav.testConnection(url, username, password);
      setConnected(true);
    } catch (e) {
      setConnectionError(e instanceof Error ? e.message : "连接失败");
    } finally {
      setTesting(false);
    }
  }, [loggedIn, url, username, password]);

  const handleListBackups = useCallback(async () => {
    if (!url.trim() || !connected) return;
    setListingBackups(true);
    try {
      const files = await apiClient.settings.webdav.listBackups(url, username, password);
      setBackups(files.map((f: { name: string; path: string; size: number; lastModified?: string; last_modified?: string }) => ({
        name: f.name,
        path: f.path,
        size: f.size,
        lastModified: f.last_modified?.replace("last_modified", "") ?? f.lastModified ?? "",
      })));
    } catch {
      // Listing is optional
    } finally {
      setListingBackups(false);
    }
  }, [url, username, password, connected]);



  const handleUpload = useCallback(async () => {
    setSyncing(true);
    setSyncMsg("");
    try {
      const filename = await apiClient.settings.webdav.uploadBackup(url, username, password);
      setSyncMsg(`已上传: ${filename}`);
    } catch (e) {
      setSyncMsg(`上传失败: ${e instanceof Error ? e.message : "未知错误"}`);
    } finally {
      setSyncing(false);
    }
  }, [url, username, password]);

  const handleRestore = useCallback(async (filename: string) => {
    setRestoring(true);
    setSyncMsg("");
    try {
      await apiClient.settings.webdav.downloadBackup(url, username, password, filename);
      setSyncMsg(`已从 ${filename} 恢复数据`);
    } catch (e) {
      setSyncMsg(`恢复失败: ${e instanceof Error ? e.message : "未知错误"}`);
    } finally {
      setRestoring(false);
    }
  }, [url, username, password]);

  const handleDelete = useCallback(async (filename: string) => {
    try {
      await apiClient.settings.webdav.deleteBackup(url, username, password, filename);
      setBackups((prev) => prev.filter((b) => b.name !== filename));
      setSyncMsg(`已删除: ${filename}`);
    } catch (e) {
      setSyncMsg(`删除失败: ${e instanceof Error ? e.message : "未知错误"}`);
    }
  }, [url, username, password]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4">
      <Card padding="md" className="space-y-4">
        <div className="flex items-center gap-3">
          <SectionIcon icon={Cloud} color="#0A84FF" />
          <div>
            <h2 className="text-base font-semibold text-ink-primary">WebDAV 同步</h2>
            <p className="mt-0.5 text-xs text-ink-tertiary">
              使用自建 WebDAV 服务同步加密备份（支持 Nextcloud / 群晖 NAS / 坚果云等）
            </p>
          </div>
        </div>

        {/* Account — login is only used for syncing across devices */}
        <div
          className="flex items-center justify-between gap-3 rounded-2xl px-4 py-3"
          style={{ background: "var(--rc-chip-inset-bg)", boxShadow: "var(--rc-chip-inset-shadow)" }}
        >
          <div className="flex min-w-0 items-center gap-3">
            {loggedIn
              ? <CircleCheck className="h-5 w-5 shrink-0 text-apple-green" />
              : <CircleUser className="h-5 w-5 shrink-0 text-ink-tertiary" />}
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink-primary">{loggedIn ? "已登录" : "未登录"}</p>
              <p className="mt-0.5 text-xs text-ink-tertiary">
                {loggedIn ? "可在多设备间同步加密备份。" : "登录后即可在多设备间同步备份。"}
              </p>
            </div>
          </div>
          {loggedIn ? (
            <button
              type="button"
              onClick={handleLogout}
              className="flex shrink-0 items-center gap-1.5 rounded-2xl px-4 py-2 text-sm font-medium transition-all duration-150 active:scale-95"
              style={{ background: "var(--rc-chip-bg)", color: "var(--rc-text-soft)", boxShadow: "var(--rc-chip-shadow)" }}
            >
              <LogOut className="h-4 w-4" />
              退出登录
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setLoginOpen(true)}
              className="flex shrink-0 items-center gap-1.5 rounded-2xl px-4 py-2 text-sm font-medium text-white transition-all duration-150 active:scale-95"
              style={{ background: "linear-gradient(145deg,#1A8AFF,#0062CC)", boxShadow: "4px 4px 10px rgba(0,62,204,0.3)" }}
            >
              <CircleUser className="h-4 w-4" />
              登录
            </button>
          )}
        </div>

        {/* Login gate — sync requires an active session */}
        {!loggedIn && (
          <div className="flex items-center gap-2 rounded-2xl bg-apple-blue/10 px-4 py-3 text-xs text-apple-blue">
            <Lock className="h-3.5 w-3.5 shrink-0" />
            请先登录以配置并启用 WebDAV 同步。
          </div>
        )}

        {/* Connection config */}
        <div
          className="grid gap-3 rounded-2xl p-4 transition-opacity"
          style={{
            background: "var(--rc-chip-inset-bg)",
            boxShadow: "var(--rc-chip-inset-shadow)",
            opacity: loggedIn ? 1 : 0.5,
            pointerEvents: loggedIn ? "auto" : "none",
          }}
        >
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="mb-1.5 ml-1 block text-xs font-medium text-ink-tertiary">服务器地址</label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={!loggedIn}
                placeholder="https://dav.example.com/remote.php/dav/files/user/"
                className="w-full rounded-2xl border px-4 py-2.5 text-sm outline-none text-[var(--rc-text)] placeholder:text-[var(--rc-text-muted)]"
                style={{
                  background: "var(--rc-control-bg)",
                  borderColor: "var(--rc-control-border)",
                  boxShadow: "var(--rc-control-shadow)",
                }}
              />
            </div>
            <div>
              <label className="mb-1.5 ml-1 block text-xs font-medium text-ink-tertiary">用户名</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={!loggedIn}
                placeholder="用户名"
                className="w-full rounded-2xl border px-4 py-2.5 text-sm outline-none text-[var(--rc-text)] placeholder:text-[var(--rc-text-muted)]"
                style={{
                  background: "var(--rc-control-bg)",
                  borderColor: "var(--rc-control-border)",
                  boxShadow: "var(--rc-control-shadow)",
                }}
              />
            </div>
            <div>
              <label className="mb-1.5 ml-1 block text-xs font-medium text-ink-tertiary">密码</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={!loggedIn}
                placeholder="••••••••"
                className="w-full rounded-2xl border px-4 py-2.5 text-sm outline-none text-[var(--rc-text)] placeholder:text-[var(--rc-text-muted)]"
                style={{
                  background: "var(--rc-control-bg)",
                  borderColor: "var(--rc-control-border)",
                  boxShadow: "var(--rc-control-shadow)",
                }}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testing || !url.trim()}
              className="flex items-center gap-1.5 rounded-2xl px-4 py-2.5 text-sm font-medium transition-all duration-150 active:scale-95 disabled:opacity-50"
              style={{
                background: connected ? "rgba(52,199,89,0.12)" : "var(--rc-chip-bg)",
                color: connected ? "#34C759" : "var(--rc-text-soft)",
                boxShadow: connected ? "none" : "var(--rc-chip-shadow)",
              }}
            >
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> :
               connected ? <CheckCircle2 className="h-4 w-4" /> :
               <Link2 className="h-4 w-4" />}
              {testing ? "测试中…" : connected ? "已连接" : "测试连接"}
            </button>

            {connected && (
              <>
                <button
                  type="button"
                  onClick={handleUpload}
                  disabled={syncing}
                  className="flex items-center gap-1.5 rounded-2xl px-4 py-2.5 text-sm font-medium text-white transition-all duration-150 active:scale-95 disabled:opacity-50"
                  style={{
                    background: "linear-gradient(145deg,#1A8AFF,#0062CC)",
                    boxShadow: "4px 4px 10px rgba(0,62,204,0.3)",
                  }}
                >
                  {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {syncing ? "上传中…" : "立即同步"}
                </button>

                <button
                  type="button"
                  onClick={handleListBackups}
                  disabled={listingBackups}
                  className="flex items-center gap-1.5 rounded-2xl px-4 py-2.5 text-sm font-medium transition-all duration-150 active:scale-95 disabled:opacity-50"
                  style={{
                    background: "var(--rc-chip-bg)",
                    color: "var(--rc-text-soft)",
                    boxShadow: "var(--rc-chip-shadow)",
                  }}
                >
                  {listingBackups ? <Loader2 className="h-4 w-4 animate-spin" /> : <Cloud className="h-4 w-4" />}
                  刷新列表
                </button>
              </>
            )}
          </div>

          {/* Status */}
          {syncMsg && (
            <div
              className={`rounded-xl px-4 py-2.5 text-xs ${
                syncMsg.includes("失败") ? "bg-apple-red/10 text-apple-red" : "bg-apple-green/10 text-apple-green"
              }`}
            >
              {syncMsg.includes("失败") && <AlertCircle className="mr-1.5 inline-block h-3.5 w-3.5" />}
              {syncMsg}
            </div>
          )}
          {connectionError && (
            <div className="rounded-xl bg-apple-red/10 px-4 py-2.5 text-xs text-apple-red">
              <AlertCircle className="mr-1.5 inline-block h-3.5 w-3.5" />
              {connectionError}
            </div>
          )}
        </div>

        {/* Backup list */}
        {backups.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-ink-secondary">
              远程备份 ({backups.length})
            </h3>
            <div className="space-y-1.5">
              {backups.map((b) => (
                <div
                  key={b.name}
                  className="flex items-center justify-between rounded-2xl px-4 py-3"
                  style={{ background: "var(--rc-chip-bg)", boxShadow: "var(--rc-chip-shadow)" }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink-primary">{b.name}</p>
                    <p className="mt-0.5 text-xs text-ink-tertiary">
                      {formatSize(b.size)} · {b.lastModified}
                    </p>
                  </div>
                  <div className="ml-3 flex gap-1">
                    <button
                      type="button"
                      onClick={() => handleRestore(b.name)}
                      disabled={restoring}
                      className="rounded-xl p-2 text-brand-500 hover:bg-brand-500/10 transition-colors disabled:opacity-40"
                      title="恢复此备份"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(b.name)}
                      className="rounded-xl p-2 text-apple-red hover:bg-apple-red/10 transition-colors"
                      title="删除"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      <LoginModal
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        onLoginSuccess={() => setLoggedIn(true)}
      />
    </div>
  );
}
