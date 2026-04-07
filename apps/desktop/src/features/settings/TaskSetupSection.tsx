import { ArrowRight, Bot, CheckCircle2, Circle, FileSearch, Link2, Route } from "lucide-react";
import { Card } from "@research-copilot/ui";

interface TaskSetupSectionProps {
  currentProviderLabel: string;
  connectionReady: boolean;
  rolesReady: boolean;
  multiAgentReady: boolean;
  paperImportReady: boolean;
  onOpenConnection: () => void;
  onOpenRoles: () => void;
  onOpenPaperLibrary: () => void;
  onOpenAbout: () => void;
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
  onOpenConnection,
  onOpenRoles,
  onOpenPaperLibrary,
  onOpenAbout,
}: TaskSetupSectionProps) {
  const steps = [
    {
      title: "先接通主模型",
      description: connectionReady
        ? `当前入口模型已连到 ${currentProviderLabel}。后续没有单独指定的场景，会先回退到这里。`
        : "先选一个服务商，填好默认对话模型和密钥。先可用，再谈细分分工。",
      ready: connectionReady,
      action: "去配置基础连接",
      onClick: onOpenConnection,
      icon: Link2,
    },
    {
      title: "再按任务分工",
      description: rolesReady
        ? "阅读、综述、复现或视觉识别里，至少有一类任务已经配置了专用模型。"
        : "不要一上来填满所有卡片。优先配置论文阅读、综述写作和视觉识别这三类高频任务。",
      ready: rolesReady,
      action: "去配置任务分工",
      onClick: onOpenRoles,
      icon: Route,
    },
    {
      title: "最后决定是否启用多能力域协作",
      description: multiAgentReady
        ? "多能力域协作已启用。复杂任务会走调度和分工流程。"
        : "如果你只想先稳定使用单模型对话，可以暂时关闭，等基础配置跑顺再打开。",
      ready: multiAgentReady,
      action: "去调整协作模式",
      onClick: onOpenRoles,
      icon: Bot,
    },
  ] as const;

  return (
    <div className="space-y-4">
      <Card padding="md" className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-ink-primary">快速开始</h2>
          <p className="text-xs leading-5 text-ink-tertiary">
            设置页先做三件事就够了：接通主模型、给高频任务分工、决定是否启用多能力域协作。剩下的参数放到后面的高级分区再看。
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
                ? "论文导入识别当前已开启。你可以等基础连接稳定后，再去调整标签显示和自动识别范围。"
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
      </Card>
    </div>
  );
}
