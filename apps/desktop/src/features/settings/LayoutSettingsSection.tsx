import type { ReactNode } from "react";
import { Card } from "@research-copilot/ui";
import { Layers, LayoutDashboard, Monitor, Moon, Square, Sun } from "lucide-react";
import type { LayoutMode } from "../../lib/layoutMode";
import type { ThemePreference } from "../../lib/themeMode";
import type { ThemeStyle } from "../../lib/themeStyle";
import { SectionIcon } from "./shared";
import ModuleVisibilitySettingsPanel from "../module-visibility/ModuleVisibilitySettingsPanel";
import CodeHarnessSettingsPanel from "../code-harness/CodeHarnessSettingsPanel";

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
      aria-pressed={selected}
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

const LIGHT_SWATCH = "#F0F4F8";
const DARK_SWATCH = "#090B10";

function ThemeSwatch({ mode }: { mode: "light" | "dark" | "auto" }) {
  if (mode === "auto") {
    return (
      <div className="flex h-10 w-10 overflow-hidden rounded-2xl border" style={{ borderColor: "var(--rc-border)" }}>
        <div className="flex-1" style={{ background: LIGHT_SWATCH }} />
        <div className="flex-1" style={{ background: DARK_SWATCH }} />
      </div>
    );
  }

  return (
    <div
      className="flex h-10 w-10 items-center justify-center rounded-2xl border"
      style={{
        borderColor: "var(--rc-border)",
        background: mode === "light" ? LIGHT_SWATCH : DARK_SWATCH,
        color: mode === "light" ? "#1A2233" : "#F5F7FA",
      }}
    >
      {mode === "light" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </div>
  );
}

function StyleSwatch({ flat }: { flat: boolean }) {
  return (
    <div
      className={`flex h-10 w-10 items-center justify-center rounded-2xl border ${flat ? "" : "rc-style-swatch--raised"}`}
      style={{
        borderColor: "rgba(200, 205, 211, 0.9)",
        background: "#E8ECF0",
        color: "#007AFF",
      }}
    >
      {flat ? <Square className="h-4 w-4" /> : <Layers className="h-4 w-4" />}
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
          <p className="mt-0.5 text-xs text-ink-tertiary">外观和界面风格立即生效，布局模式切换后会自动重启应用</p>
        </div>
      </div>

      <div>
        <p className="mb-2 ml-1 text-xs font-medium text-ink-tertiary">外观主题</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {([
            {
              mode: "auto" as ThemePreference,
              label: "跟随系统",
              description: "沿用系统的深浅设置，在同一套清透淡蓝配色的浅色和深色之间切换。",
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
              description: "清透淡蓝的浅色界面，背景更亮，适合长时间阅读。",
              preview: <ThemeSwatch mode="light" />,
            },
            {
              mode: "dark" as ThemePreference,
              label: "深色",
              description: "同一套蓝灰配色的深色界面，压低亮度，突出内容。",
              preview: <ThemeSwatch mode="dark" />,
            },
          ] as const).map(({ mode, label, description, preview }) => (
            <OptionCard
              key={mode}
              selected={currentTheme === mode}
              title={label}
              description={description}
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
              style: "neumorphic" as ThemeStyle,
              label: "拟态",
              description: "保留双向光影，用凸起和内凹区分卡片、按钮和输入。",
              flat: false,
            },
            {
              style: "modern-minimal" as ThemeStyle,
              label: "极简",
              description: "黑白灰为主色的平面版式，去掉模块卡片，内容直接平铺，只用细线分隔层级。",
              flat: true,
            },
          ] as const).map(({ style, label, description, flat }) => (
            <OptionCard
              key={style}
              selected={currentStyle === style}
              title={label}
              description={description}
              preview={<StyleSwatch flat={flat} />}
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

      <CodeHarnessSettingsPanel />

      <ModuleVisibilitySettingsPanel />

      <div
        className="rounded-2xl px-4 py-3 text-xs leading-5 text-ink-tertiary"
        style={{ background: "var(--rc-card-inset-bg)", border: "1px solid var(--rc-card-inset-outline)" }}
      >
        切换布局后应用会自动重启。外观主题、界面风格和代码助手会立即保存并作用到当前窗口。
      </div>
    </Card>
  );
}
