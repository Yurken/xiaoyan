import { useState } from "react";
import { ArrowRight, Bot, CheckCircle2, Circle, FileSearch, Link2, Lock, Route, Unlock } from "lucide-react";
import { Card } from "@research-copilot/ui";

interface TaskSetupSectionProps {
  currentProviderLabel: string;
  connectionReady: boolean;
  rolesReady: boolean;
  multiAgentReady: boolean;
  paperImportReady: boolean;
  appLockEnabled: boolean;
  appLockTimeoutMinutes: number;
  onOpenAssistant: () => void;
  onOpenPaperLibrary: () => void;
  onOpenAbout: () => void;
  onSetAppLockPassword: (password: string) => Promise<void>;
  onClearAppLock: () => Promise<void>;
  onSetAppLockTimeout: (minutes: string) => Promise<void>;
}

function StatusDot({ ready }: { ready: boolean }) {
  return ready ? (
    <CheckCircle2 className="w-4 h-4 text-[#34C759]" />
  ) : (
    <Circle className="w-4 h-4 text-ink-tertiary" />
  );
}

export default function TaskSetupSection({
  currentProviderLabel,
  connectionReady,
  rolesReady,
  multiAgentReady,
  paperImportReady,
  appLockEnabled,
  appLockTimeoutMinutes,
  onOpenAssistant,
  onOpenPaperLibrary,
  onOpenAbout,
  onSetAppLockPassword,
  onClearAppLock,
  onSetAppLockTimeout,
}: TaskSetupSectionProps) {
  const [lockPassword, setLockPassword] = useState("");
  const [lockConfirm, setLockConfirm] = useState("");
  const [lockBusy, setLockBusy] = useState(false);
  const [lockMsg, setLockMsg] = useState("");
  const [showLockForm, setShowLockForm] = useState(false);
  const steps = [
    {
      title: "先接通小妍",
      description: connectionReady
        ? `当前小妍默认模型已连到 ${currentProviderLabel}。没有单独指定的场景，会先回退到这里。`
        : "先选服务商，填好 URL、API Key 和默认对话模型。先让小妍稳定可用，再看细分分工。",
      ready: connectionReady,
      action: "打开小妍设置",
      onClick: onOpenAssistant,
      icon: Link2,
    },
    {
      title: "再按需要补任务分工",
      description: rolesReady
        ? "阅读、综述、复现或视觉识别里，至少有一类任务已经配置了专用模型。"
        : "这一步不是必填。先从论文阅读、综述写作和视觉识别三类高频任务里挑需要单独提速的场景即可。",
      ready: rolesReady,
      action: "打开小妍设置",
      onClick: onOpenAssistant,
      icon: Route,
    },
    {
      title: "最后决定是否启用多能力域协作",
      description: multiAgentReady
        ? "多能力域协作已启用。复杂任务会走调度和分工流程。"
        : "如果你只想先稳定使用单模型对话，可以暂时关闭，等基础配置跑顺再打开。",
      ready: multiAgentReady,
      action: "去调整协作模式",
      onClick: onOpenAssistant,
      icon: Bot,
    },
  ] as const;

  return (
    <div className="space-y-4">
      <Card padding="md" className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-ink-primary">快速开始</h2>
          <p className="text-xs leading-5 text-ink-tertiary">
            设置页先做三件事就够了：先接通小妍，再按需要补任务分工，最后决定是否启用多能力域协作。剩下的参数放到后面的分区再看。
          </p>
        </div>

        <div className="grid gap-3">
          {steps.map(({ title, description, ready, action, onClick, icon: Icon }) => (
            <div
              key={title}
              className="rounded-3xl border px-4 py-4"
              style={{ background: "var(--rc-surface)", borderColor: "var(--rc-border)" }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "var(--rc-card-inset-bg)", boxShadow: "var(--rc-inset-shadow)" }}
                  >
                    <Icon className="w-4.5 h-4.5 text-[#007AFF]" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <StatusDot ready={ready} />
                      <p className="text-sm font-semibold text-ink-primary">{title}</p>
                    </div>
                    <p className="text-xs leading-5 text-ink-secondary">{description}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onClick}
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-150"
                  style={{ background: "var(--rc-chip-bg)", color: "var(--rc-text-soft)", boxShadow: "var(--rc-chip-shadow)" }}
                >
                  {action}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-3xl px-4 py-4" style={{ background: "var(--rc-chip-inset-bg)", boxShadow: "var(--rc-chip-inset-shadow)" }}>
              <p className="text-sm font-semibold text-ink-primary">论文库默认建议</p>
              <p className="mt-1 text-xs leading-5 text-ink-secondary">
                {paperImportReady
                ? "论文导入识别当前已开启。你可以等小妍默认连接稳定后，再去调整标签显示和自动识别范围。"
                : "如果导入结果不稳定，先恢复默认识别项，让小妍自动补标题、作者、年份和来源。"}
              </p>
            <button
              type="button"
              onClick={onOpenPaperLibrary}
              className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[#007AFF]"
            >
              <FileSearch className="w-3.5 h-3.5" />
              打开论文导入设置
            </button>
          </div>

          <div className="rounded-3xl px-4 py-4" style={{ background: "var(--rc-chip-inset-bg)", boxShadow: "var(--rc-chip-inset-shadow)" }}>
            <p className="text-sm font-semibold text-ink-primary">版本与备份</p>
            <p className="mt-1 text-xs leading-5 text-ink-secondary">
              导出配置、导入配置和桌面端升级都在同一处。只有当你开始跨设备迁移或准备发布版时，才需要频繁进入这里。
            </p>
            <button
              type="button"
              onClick={onOpenAbout}
              className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[#007AFF]"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              打开升级与备份
            </button>
          </div>
        </div>

        {/* App Lock */}
        <div className="rounded-3xl px-4 py-4 mt-3" style={{ background: "var(--rc-chip-inset-bg)", boxShadow: "var(--rc-chip-inset-shadow)" }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: appLockEnabled ? "rgba(255,149,0,0.14)" : "transparent", color: appLockEnabled ? "#FF9500" : "var(--rc-text-muted)" }}>
                {appLockEnabled ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
              </span>
              <div>
                <p className="text-sm font-semibold text-ink-primary">应用锁</p>
                <p className="text-xs leading-5 text-ink-secondary">
                  {appLockEnabled
                    ? `已开启${appLockTimeoutMinutes > 0 ? `，${appLockTimeoutMinutes} 分钟无操作自动锁定` : "，启动时需输入密码"}`
                    : "设置密码后，打开应用需验证身份"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                if (appLockEnabled) {
                  void onClearAppLock().then(() => { setShowLockForm(false); setLockPassword(""); setLockConfirm(""); setLockMsg(""); });
                } else {
                  setShowLockForm(!showLockForm);
                }
              }}
              className="shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-all"
              style={{
                background: appLockEnabled ? "rgba(255,59,48,0.1)" : "var(--rc-chip-bg)",
                color: appLockEnabled ? "#FF3B30" : "var(--rc-accent)",
              }}
            >
              {appLockEnabled ? "关闭" : showLockForm ? "取消" : "设置密码"}
            </button>
          </div>

          {showLockForm && !appLockEnabled && (
            <div className="mt-4 space-y-3">
              <input
                type="password"
                value={lockPassword}
                onChange={(e) => setLockPassword(e.target.value)}
                placeholder="输入密码"
                className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                style={{ background: "var(--rc-surface)", boxShadow: "var(--rc-inset-shadow)", color: "var(--rc-text)" }}
              />
              <input
                type="password"
                value={lockConfirm}
                onChange={(e) => setLockConfirm(e.target.value)}
                placeholder="确认密码"
                className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                style={{ background: "var(--rc-surface)", boxShadow: "var(--rc-inset-shadow)", color: "var(--rc-text)" }}
              />
              <div className="flex items-center gap-2">
                <span className="text-xs text-ink-tertiary shrink-0">自动锁定：</span>
                <select
                  value={String(appLockTimeoutMinutes)}
                  onChange={(e) => { void onSetAppLockTimeout(e.target.value); }}
                  className="rounded-xl px-2 py-1 text-xs outline-none"
                  style={{ background: "var(--rc-surface)", boxShadow: "var(--rc-inset-shadow)", color: "var(--rc-text)" }}
                >
                  <option value="0">仅启动时</option>
                  <option value="1">1 分钟</option>
                  <option value="5">5 分钟</option>
                  <option value="15">15 分钟</option>
                  <option value="30">30 分钟</option>
                </select>
              </div>
              <button
                type="button"
                disabled={lockBusy || !lockPassword.trim() || lockPassword !== lockConfirm}
                onClick={async () => {
                  if (lockPassword !== lockConfirm) { setLockMsg("两次密码不一致"); return; }
                  setLockBusy(true); setLockMsg("");
                  try {
                    await onSetAppLockPassword(lockPassword);
                    setLockPassword(""); setLockConfirm(""); setShowLockForm(false);
                  } catch (e) { setLockMsg(String(e)); }
                  finally { setLockBusy(false); }
                }}
                className="w-full rounded-xl py-2 text-sm font-semibold text-white transition-all active:scale-95 disabled:opacity-50"
                style={{ background: "linear-gradient(145deg,#1A8AFF,#0062CC)" }}
              >
                {lockBusy ? "设置中…" : "确认设置"}
              </button>
              {lockMsg && <p className="text-xs text-apple-red">{lockMsg}</p>}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
