import { AlertCircle, Languages, Loader2 } from "lucide-react";
import { Card, Textarea } from "@research-copilot/ui";

const raisedShadow = "var(--rc-raised-shadow)";
const activeChipStyle = {
  background: "linear-gradient(145deg,#1A8AFF,#0062CC)",
  color: "#fff",
  boxShadow: "3px 3px 8px rgba(0,62,204,0.3)",
} as const;
const inactiveChipStyle = {
  background: "var(--rc-surface)",
  color: "var(--rc-text-soft)",
  boxShadow: raisedShadow,
} as const;
const primaryButtonStyle = {
  background: "linear-gradient(145deg,#1A8AFF,#0062CC)",
  boxShadow: "4px 4px 10px rgba(0,62,204,0.3),-3px -3px 8px rgba(58,155,255,0.15)",
} as const;

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
              由小妍的译衡能力驱动，优先保留专业术语和学术表达。可在设置 → 模型分工中单独配置译衡模型。
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
                onClick={() => onSourceLangChange(lang.value)}
                className="rounded-xl px-3 py-1.5 text-xs font-medium transition-all duration-150"
                style={sourceLang === lang.value ? activeChipStyle : inactiveChipStyle}
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
                  onClick={() => onTargetLangChange(lang.value)}
                  className="rounded-xl px-3 py-1.5 text-xs font-medium transition-all duration-150"
                  style={targetLang === lang.value ? activeChipStyle : inactiveChipStyle}
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
            className="flex items-center gap-1.5 rounded-2xl px-5 py-2 text-sm font-semibold text-white transition-all duration-150 active:scale-95 disabled:opacity-50"
            style={primaryButtonStyle}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Languages className="h-4 w-4" />}
            {loading ? "翻译中…" : "翻译"}
          </button>
        </div>

        {error ? (
          <div className="flex items-start gap-2 rounded-2xl border border-apple-red/10 bg-[#F7ECEA] px-3 py-2 text-sm text-apple-red">
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
