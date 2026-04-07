import type { ReactNode } from "react";
import { Card } from "@research-copilot/ui";
import { LayoutDashboard, Monitor, Moon, Sun } from "lucide-react";
import type { LayoutMode } from "../../lib/layoutMode";
import type { ThemePreference } from "../../lib/themeMode";
import type { ThemeStyle } from "../../lib/themeStyle";
import { SectionIcon } from "./shared";

function OptionCard({
  selected,
  title,
  description,
  icon,
  preview,
  onClick,
}: {
  selected: boolean;
  title: string;
  description: string;
  icon?: ReactNode;
  preview?: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-[24px] p-4 text-left transition-all duration-150"
      style={
        selected
          ? {
              background: "color-mix(in srgb, var(--rc-accent) 10%, var(--rc-elevated))",
              border: "1px solid color-mix(in srgb, var(--rc-accent) 28%, var(--rc-border))",
              boxShadow: "0 14px 28px rgb(var(--rc-sidebar-shadow-rgb) / 0.1)",
            }
          : {
              background: "var(--rc-elevated)",
              border: "1px solid var(--rc-border)",
              boxShadow: "var(--rc-flat-shadow)",
            }
      }
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {preview ?? icon}
          <div>
            <p className="text-sm font-semibold text-ink-primary">{title}</p>
          </div>
        </div>
        {selected ? (
          <span
            className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full"
            style={{ background: "var(--rc-accent)" }}
          >
            <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
              <path d="M1 3l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        ) : null}
      </div>
      <p className="text-xs leading-5 text-ink-secondary">{description}</p>
    </button>
  );
}

function ThemeSwatch({ mode }: { mode: "light" | "dark" | "auto" }) {
  if (mode === "auto") {
    return (
      <div className="flex h-10 w-10 overflow-hidden rounded-2xl border" style={{ borderColor: "var(--rc-border)" }}>
        <div className="flex-1 bg-[#f7f4ee]" />
        <div className="flex-1 bg-[#15181d]" />
      </div>
    );
  }

  return (
    <div
      className="flex h-10 w-10 items-center justify-center rounded-2xl border"
      style={{
        borderColor: "var(--rc-border)",
        background: mode === "light" ? "#f7f4ee" : "#15181d",
        color: mode === "light" ? "#191b1f" : "#f3f2ed",
      }}
    >
      {mode === "light" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </div>
  );
}

function StylePreview({ style }: { style: ThemeStyle }) {
  if (style === "neumorphic") {
    return (
      <div className="flex h-10 w-14 items-center justify-center rounded-2xl border px-2" style={{ borderColor: "var(--rc-border)", background: "#eef2f5" }}>
        <div className="h-5 w-full rounded-xl bg-white shadow-[4px_4px_10px_rgba(120,132,148,0.18),-4px_-4px_10px_rgba(255,255,255,0.85)]" />
      </div>
    );
  }

  return (
    <div className="flex h-10 w-14 items-center justify-center rounded-2xl border px-2" style={{ borderColor: "var(--rc-border)", background: "#111317" }}>
      <div className="h-5 w-full rounded-xl border" style={{ borderColor: "#2b3039", background: "#171b21" }} />
    </div>
  );
}

export default function LayoutSettingsSection({
  currentTheme,
  currentStyle,
  pendingLayout,
  onThemeChange,
  onStyleChange,
  onLayoutChange,
}: {
  currentTheme: ThemePreference;
  currentStyle: ThemeStyle;
  pendingLayout: LayoutMode;
  onThemeChange: (mode: ThemePreference) => void;
  onStyleChange: (style: ThemeStyle) => void;
  onLayoutChange: (mode: LayoutMode) => void;
}) {
  return (
    <Card padding="md" className="space-y-5">
      <div className="flex items-center gap-3">
        <SectionIcon icon={LayoutDashboard} color="#30B0C7" />
        <div>
          <h2 className="text-base font-semibold text-ink-primary">界面布局模式</h2>
          <p className="mt-0.5 text-xs text-ink-tertiary">外观立即生效，布局模式切换后会自动重启应用</p>
        </div>
      </div>

      <div>
        <p className="mb-2 ml-1 text-xs font-medium text-ink-tertiary">外观主题</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {([
            {
              mode: "auto" as ThemePreference,
              label: "跟随系统",
              description: "沿用系统深浅模式，让界面在白天和低光环境之间自然切换。",
              icon: (
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border" style={{ borderColor: "var(--rc-border)", background: "var(--rc-card-inset-bg)", color: "var(--rc-text-soft)" }}>
                  <Monitor className="h-4 w-4" />
                </div>
              ),
              preview: <ThemeSwatch mode="auto" />,
            },
            {
              mode: "light" as ThemePreference,
              label: "浅色",
              description: "偏纸面的浅暖底色，阅读更轻，层级更像一张整理好的研究桌面。",
              preview: <ThemeSwatch mode="light" />,
            },
            {
              mode: "dark" as ThemePreference,
              label: "深色",
              description: "石墨感深色壳层，弱化装饰色，突出内容和结构。",
              preview: <ThemeSwatch mode="dark" />,
            },
          ] as const).map(({ mode, label, description, icon, preview }) => (
            <OptionCard
              key={mode}
              selected={currentTheme === mode}
              title={label}
              description={description}
              icon={icon}
              preview={preview}
              onClick={() => onThemeChange(mode)}
            />
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 ml-1 text-xs font-medium text-ink-tertiary">界面风格</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {([
            {
              style: "modern-minimal" as ThemeStyle,
              label: "极简工作台",
              description: "借鉴 Codex / ChatGPT 的克制壳层，信息靠边界、密度和排版建立层次。",
            },
            {
              style: "neumorphic" as ThemeStyle,
              label: "柔和拟态",
              description: "保留软投影和流动质感，但边界与对比更清晰，不再显得发虚。",
            },
          ] as const).map(({ style, label, description }) => (
            <OptionCard
              key={style}
              selected={currentStyle === style}
              title={label}
              description={description}
              preview={<StylePreview style={style} />}
              onClick={() => onStyleChange(style)}
            />
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 ml-1 text-xs font-medium text-ink-tertiary">布局模式</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {([
            {
              mode: "landscape" as LayoutMode,
              label: "纵横",
              description: "保留侧边导航和多模块切换，适合同时推进多个研究任务。",
            },
            {
              mode: "focus" as LayoutMode,
              label: "聚焦",
              description: "围绕研究主题进入专属工作台，减少切换，保持连续专注。",
            },
          ] as const).map(({ mode, label, description }) => (
            <OptionCard
              key={mode}
              selected={pendingLayout === mode}
              title={label}
              description={description}
              onClick={() => onLayoutChange(mode)}
            />
          ))}
        </div>
      </div>

      <div
        className="rounded-2xl px-4 py-3 text-xs leading-5 text-ink-tertiary"
        style={{ background: "var(--rc-card-inset-bg)", border: "1px solid var(--rc-card-inset-outline)" }}
      >
        切换布局后应用会自动重启。主题和风格会立即保存并作用到当前窗口。
      </div>
    </Card>
  );
}
