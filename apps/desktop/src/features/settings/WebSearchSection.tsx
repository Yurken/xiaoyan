import { useState } from "react";
import { AlertCircle, Check, ExternalLink as ExternalLinkIcon, Loader2, Wifi } from "lucide-react";
import type { AppSettings, TavilyKeyTest } from "@research-copilot/types";
import { MASK, ToggleRow } from "./shared";
import { apiClient } from "../../lib/client";
import ExternalLink from "../../components/ExternalLink";

const WEB_SEARCH_PROVIDER_OPTIONS: { value: string; label: string; description: string }[] = [
  { value: "duckduckgo", label: "DuckDuckGo", description: "免费、无需密钥，结果质量一般。默认。" },
  { value: "tavily", label: "Tavily", description: "面向 AI 的联网搜索，质量更好，需自备 API Key。" },
];

interface WebSearchSectionProps {
  form: AppSettings;
  set: (key: keyof AppSettings) => (value: string) => void;
}

/**
 * 小妍联网搜索设置：启用开关 + 搜索来源（DuckDuckGo / Tavily）+ Tavily 多 Key 与测试。
 * 关闭联网搜索时折叠来源与 Tavily 配置。注意这与各模型自带的联网能力（如 Kimi、豆包）是两套机制。
 */
export default function WebSearchSection({ form, set }: WebSearchSectionProps) {
  const webSearchEnabled = form.web_search_enabled !== "false";

  const [tavilyTesting, setTavilyTesting] = useState(false);
  const [tavilyResults, setTavilyResults] = useState<TavilyKeyTest[] | null>(null);
  const [tavilyError, setTavilyError] = useState("");
  const runTavilyTest = async () => {
    setTavilyTesting(true);
    setTavilyError("");
    setTavilyResults(null);
    try {
      setTavilyResults(await apiClient.settings.testTavily(form));
    } catch (error) {
      setTavilyError(error instanceof Error ? error.message : String(error));
    } finally {
      setTavilyTesting(false);
    }
  };

  return (
    <>
      <ToggleRow
        title="启用小妍联网搜索"
        description="开启后小妍可在对话中联网搜索实时信息；关闭则仅依赖模型已有知识。部分模型（如 Kimi、豆包）自带联网能力，可关闭此项改用模型内置搜索。"
        checked={webSearchEnabled}
        onToggle={() => set("web_search_enabled")(webSearchEnabled ? "false" : "true")}
      />

      {webSearchEnabled ? (
        <>
          <div className="space-y-2">
            <label className="ml-1 block text-xs font-medium text-ink-tertiary">小妍联网搜索来源</label>
            <div className="grid gap-2 md:grid-cols-2">
              {WEB_SEARCH_PROVIDER_OPTIONS.map((option) => {
                const active = (form.web_search_provider || "duckduckgo") === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => set("web_search_provider")(option.value)}
                    className="rounded-[22px] p-3 text-left transition-all duration-150"
                    style={
                      active
                        ? {
                            background: "color-mix(in srgb, var(--rc-accent) 10%, var(--rc-elevated))",
                            border: "1px solid color-mix(in srgb, var(--rc-accent) 26%, var(--rc-border))",
                            boxShadow: "var(--rc-card-flat-shadow)",
                          }
                        : {
                            background: "var(--rc-card-inset-bg)",
                            border: "1px solid var(--rc-card-inset-outline)",
                            boxShadow: "var(--rc-card-inset-shadow)",
                          }
                    }
                  >
                    <p className="text-sm font-semibold text-ink-primary">{option.label}</p>
                    <p className="mt-1.5 text-xs leading-5 text-ink-tertiary">{option.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {form.web_search_provider === "tavily" ? (
            <div className="space-y-2">
              <div className="space-y-1.5">
                <label className="ml-1 block text-xs font-medium text-ink-tertiary">
                  Tavily API Key（每行一个，自动轮换）
                </label>
                <textarea
                  value={form.tavily_api_key}
                  onChange={(event) => set("tavily_api_key")(event.target.value)}
                  rows={3}
                  placeholder={"tvly-...\ntvly-..."}
                  className="w-full resize-y rounded-2xl border-0 px-4 py-2.5 text-sm text-ink-primary outline-none transition-shadow duration-150 placeholder:text-ink-tertiary"
                  style={{ background: "var(--rc-chip-inset-bg)", boxShadow: "var(--rc-chip-inset-shadow)" }}
                  onFocus={(event) => {
                    event.currentTarget.style.boxShadow =
                      "var(--rc-chip-inset-shadow), 0 0 0 2px rgba(0,122,255,0.25)";
                  }}
                  onBlur={(event) => {
                    event.currentTarget.style.boxShadow = "var(--rc-chip-inset-shadow)";
                  }}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="min-w-0 flex-1 text-xs leading-5 text-ink-tertiary">
                  填多个 Key 可分摊免费额度，某个达上限时自动切换。修改请清空后重新粘贴全部 Key；留空或 {MASK} 表示不更改。
                </p>
                <div className="flex items-center gap-2">
                  {tavilyError ? <span className="text-xs text-rose-500">{tavilyError}</span> : null}
                  <button
                    type="button"
                    onClick={() => void runTavilyTest()}
                    disabled={tavilyTesting}
                    className="flex flex-shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-all duration-150 disabled:opacity-60"
                    style={{ background: "var(--rc-chip-inset-bg)", color: "var(--rc-text-soft)" }}
                  >
                    {tavilyTesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wifi className="h-3.5 w-3.5" />}
                    {tavilyTesting ? "测试中…" : "测试 Key"}
                  </button>
                </div>
              </div>

              {tavilyResults ? (
                <div className="space-y-1 rounded-2xl px-3 py-2" style={{ background: "var(--rc-card-inset-bg)" }}>
                  {tavilyResults.map((result, index) => (
                    <div key={`${result.label}-${index}`} className="flex items-center gap-1.5 text-xs">
                      {result.ok ? (
                        <Check className="h-3.5 w-3.5 flex-shrink-0 text-emerald-500" />
                      ) : (
                        <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 text-rose-500" />
                      )}
                      <span className="font-mono text-ink-secondary">{result.label}</span>
                      <span className={result.ok ? "text-emerald-600" : "text-rose-500"}>{result.message}</span>
                    </div>
                  ))}
                </div>
              ) : null}

              <div
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl px-4 py-3 text-xs leading-5 text-ink-tertiary"
                style={{ background: "var(--rc-card-inset-bg)", border: "1px solid var(--rc-card-inset-outline)" }}
              >
                <span>启用后，小妍的搜索词会发送至 Tavily 服务器。</span>
                <ExternalLink
                  href="https://app.tavily.com/home"
                  className="inline-flex items-center gap-1 font-medium text-ink-secondary underline-offset-2 hover:underline"
                >
                  <span>申请入口</span>
                  <ExternalLinkIcon className="h-3 w-3" />
                </ExternalLink>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </>
  );
}
