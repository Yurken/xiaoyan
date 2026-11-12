import { AlertCircle, Languages, Loader2 } from "lucide-react";
import { Card, Textarea } from "@research-copilot/ui";
import { TOOL_ERROR_STYLE, TOOL_PRIMARY_STYLE, TOOL_SECONDARY_STYLE } from "./shared";

const SOURCE_LANG_OPTIONS = [
  { value: "auto", label: "自动识别" },
  { value: "en", label: "English" },
  { value: "zh", label: "中文" },
  { value: "ja", label: "日本語" },
  { value: "de", label: "Deutsch" },
  { value: "fr", label: "Français" },
] as const;

const TARGET_LANG_OPTIONS = [
  { value: "zh", label: "中文" },
  { value: "en", label: "English" },
  { value: "ja", label: "日本語" },
  { value: "de", label: "Deutsch" },
  { value: "fr", label: "Français" },
] as const;

interface TranslationPanelProps {
  input: string;
  result: string;
  loading: boolean;
  error: string;
  sourceLang: string;
  targetLang: string;
  onInputChange: (value: string) => void;
  onSourceLangChange: (value: string) => void;
  onTargetLangChange: (value: string) => void;
  onSubmit: () => void | Promise<void>;
}

export function TranslationPanel({
  input,
  result,
  loading,
  error,
  sourceLang,
  targetLang,
  onInputChange,
  onSourceLangChange,
  onTargetLangChange,
  onSubmit,
}: TranslationPanelProps) {
  return (
    <>
      <Card padding="md" className="space-y-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-apple-blue/10 text-apple-blue">
            <Languages className="h-5 w-5" />
          </div>
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-ink-primary">学术翻译</p>
            <p className="text-xs leading-5 text-ink-tertiary">
              由小妍的译衡能力驱动，遵循信、达、雅，保留专业术语与学术表达。可在设置 → 模型分工中单独配置译衡模型。
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="ml-1 text-xs font-medium text-ink-tertiary">原文语言</p>
          <div className="flex flex-wrap gap-1.5">
            {SOURCE_LANG_OPTIONS.map((lang) => (
              <button
                key={lang.value}
                type="button"
                aria-pressed={sourceLang === lang.value}
                onClick={() => onSourceLangChange(lang.value)}
                className="rounded-xl px-3 py-1.5 text-xs font-medium transition-all duration-150"
                style={sourceLang === lang.value ? TOOL_PRIMARY_STYLE : TOOL_SECONDARY_STYLE}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>

        <Textarea
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              void onSubmit();
            }
          }}
          rows={6}
          placeholder="粘贴论文摘要、段落或任意学术文本…"
          label="待翻译内容"
        />

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 space-y-2">
            <p className="ml-1 text-xs font-medium text-ink-tertiary">目标语言</p>
            <div className="flex flex-wrap gap-1.5">
              {TARGET_LANG_OPTIONS.map((lang) => (
                <button
                  key={lang.value}
                  type="button"
                  aria-pressed={targetLang === lang.value}
                  onClick={() => onTargetLangChange(lang.value)}
                  className="rounded-xl px-3 py-1.5 text-xs font-medium transition-all duration-150"
                  style={targetLang === lang.value ? TOOL_PRIMARY_STYLE : TOOL_SECONDARY_STYLE}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={() => void onSubmit()}
            disabled={!input.trim() || loading}
            className="flex items-center gap-1.5 rounded-2xl px-5 py-2 text-sm font-semibold transition-all duration-150 active:scale-95 disabled:opacity-50"
            style={TOOL_PRIMARY_STYLE}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Languages className="h-4 w-4" />}
            {loading ? "翻译中…" : "翻译"}
          </button>
        </div>

        {error ? (
          <div className="flex items-start gap-2 rounded-2xl border border-apple-red/10 px-3 py-2 text-sm" style={TOOL_ERROR_STYLE}>
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}
      </Card>

      {result ? (
        <Card padding="md" className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-ink-secondary">翻译结果</p>
            <button
              type="button"
              onClick={() => void navigator.clipboard.writeText(result)}
              className="text-xs text-ink-tertiary transition-colors hover:text-apple-blue"
            >
              复制
            </button>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-7 text-ink-primary">{result}</p>
        </Card>
      ) : null}
    </>
  );
}
