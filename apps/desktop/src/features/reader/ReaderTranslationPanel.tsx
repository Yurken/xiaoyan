import { useEffect, useState } from "react";
import { Check, ChevronRight, Copy, HelpCircle, Languages, Lock, Pencil, Sparkles, Trash2 } from "lucide-react";
import {
  type InterpretationState,
  type TranslationState,
} from "./useReaderTranslation";
import InterpretationContent from "./InterpretationContent";
import { splitReasoning } from "./readerReasoning";

interface ReaderTranslationPanelProps {
  current: TranslationState | null;
  interpretation: InterpretationState | null;
  locked: boolean;
  continuous: boolean;
  fontSize: number;
  translationModel: string;
  availableModels: string[];
  loadingModels: boolean;
  modelsError: string;
  onToggleLock: () => void;
  onToggleContinuous: () => void;
  onInterpret: () => void;
  onTranslationModelChange: (model: string) => void;
  onEditSource: (text: string) => void;
  onClear: () => void;
  onCollapse: () => void;
  width?: number;
  onDragStart?: (event: React.MouseEvent) => void;
}

type CopyKey = "result" | "source" | "interpret";

const CONTINUOUS_HINT =
  "开启后，新选中的文字会接到上一段未完的句子后面，合并成完整文本重新翻译，专治跨页把句子切断。按 Shift+空格 可快速开启/关闭。";

export default function ReaderTranslationPanel({
  current,
  interpretation,
  locked,
  continuous,
  fontSize,
  translationModel,
  availableModels,
  loadingModels,
  modelsError,
  onToggleLock,
  onToggleContinuous,
  onInterpret,
  onTranslationModelChange,
  onEditSource,
  onClear,
  onCollapse,
  width,
  onDragStart,
}: ReaderTranslationPanelProps) {
  const [copied, setCopied] = useState<CopyKey | null>(null);
  const [draft, setDraft] = useState<string | null>(null);

  // 切换到新的一条翻译时，退出原文编辑态。
  useEffect(() => {
    setDraft(null);
  }, [current?.id]);

  const copy = async (key: CopyKey, text: string) => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(key);
    window.setTimeout(() => setCopied((value) => (value === key ? null : value)), 1200);
  };

  const interpretBusy = interpretation?.status === "loading";
  const canInterpret = Boolean(current) && current?.status !== "loading" && !interpretBusy;
  const interpretingImage = interpretation?.sourceType === "image";

  return (
    <aside
      className="relative flex h-full shrink-0 flex-col border-l"
      style={{ width, background: "var(--rc-card-bg)", borderColor: "var(--rc-border)" }}
    >
      {/* 控件栏 */}
      <div
        className="flex h-11 shrink-0 items-center gap-2 border-b px-3 text-xs"
        style={{ borderColor: "var(--rc-border)" }}
      >
        <button
          type="button"
          onClick={onToggleLock}
          className="mr-2 flex select-none items-center gap-1 rounded p-0.5 text-xs font-medium transition-colors"
          style={{ color: locked ? "var(--rc-accent)" : "var(--rc-text-secondary)" }}
          title={locked ? "已锁定，不再随划词更新" : "点击锁定当前翻译"}
        >
          <Lock className="h-2.5 w-2.5" />
          {/* 锁定 */}
        </button>

        <button
          type="button"
          onClick={onToggleContinuous}
          className="flex select-none items-center gap-1 text-xs font-medium transition-colors"
          style={{ color: continuous ? "#34C759" : "var(--rc-text-secondary)" }}
          title={CONTINUOUS_HINT}
        >
          连续翻译
          <span className="inline-flex">
            <HelpCircle className="h-3 w-3" />
          </span>
        </button>

        <div className="ml-auto flex items-center gap-2">
          <select
            value={translationModel}
            onChange={(event) => onTranslationModelChange(event.target.value)}
            disabled={loadingModels}
            className="max-w-[120px] truncate rounded border bg-transparent px-1 py-0.5 text-xs text-ink-primary outline-none disabled:opacity-50"
            style={{ borderColor: "var(--rc-border)" }}
            title={modelsError || translationModel || "译衡模型"}
          >
            {availableModels.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
            {translationModel && !availableModels.includes(translationModel) ? (
              <option value={translationModel}>{translationModel}</option>
            ) : null}
          </select>

          <button
            type="button"
            onClick={onClear}
            disabled={!current && !interpretation}
            className="flex items-center rounded p-0.5 text-ink-tertiary transition-colors hover:text-apple-red disabled:opacity-40"
            title="清空当前翻译/解读"
          >
            <Trash2 className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={onCollapse}
            className="rounded p-1 text-ink-tertiary transition-colors hover:text-ink-secondary"
            title="收起翻译栏"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {!current && !interpretation ? (
          <div
            className="flex h-40 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 text-center"
            style={{ borderColor: "var(--rc-border)" }}
          >
            <Languages className="h-5 w-5 text-ink-tertiary" />
            <p className="text-xs leading-5 text-ink-tertiary">
              在 PDF 中选中文字即自动翻译，也可以用顶部图像按钮框选图表让小妍解读。锁定后将固定当前内容、不再随划词变化。
            </p>
          </div>
        ) : (
          <>
            {/* 译文 */}
            {current ? (
              <section>
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-sm font-bold text-ink-primary">译文</span>
                  {current.page ? (
                    <span className="text-[11px] font-semibold text-ink-tertiary">第 {current.page} 页</span>
                  ) : null}
                  <div className="ml-auto flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => void onInterpret()}
                      disabled={!canInterpret}
                      className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-violet-500 transition-colors hover:text-violet-600 disabled:opacity-40"
                      title="让小妍解读这段内容"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      解读
                    </button>
                    <button
                      type="button"
                      onClick={() => void copy("result", current.result)}
                      disabled={current.status !== "done"}
                      className="flex items-center rounded px-1.5 py-0.5 text-ink-tertiary transition-colors hover:text-apple-blue disabled:opacity-40"
                      title="复制译文"
                    >
                      {copied === "result" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                {current.status === "loading" ? (
                  current.result ? (
                    <div>
                      <p className="whitespace-pre-wrap text-ink-primary" style={{ fontSize, lineHeight: 1.7 }}>{current.result}</p>
                      <p className="mt-1 text-[11px] text-ink-tertiary">小妍翻译中…</p>
                    </div>
                  ) : <p className="text-xs text-ink-tertiary">小妍翻译中…</p>
                ) : current.status === "error" ? (
                  <p className="text-xs text-apple-red">{current.error}</p>
                ) : (
                  <p
                    className="whitespace-pre-wrap text-ink-primary"
                    style={{ fontSize, lineHeight: 1.7 }}
                  >
                    {current.result}
                  </p>
                )}
              </section>
            ) : null}

            {/* 解读（可独立于译文存在：划词「解读」时只显示这张卡片） */}
            {interpretation ? (
              <section>
                {!current ? (
                  <>
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-sm font-bold text-ink-primary">{interpretingImage ? "框选图像" : "原文"}</span>
                      {interpretation.page ? (
                        <span className="text-[11px] font-semibold text-ink-tertiary">第 {interpretation.page} 页</span>
                      ) : null}
                      {!interpretingImage ? (
                        <button
                          type="button"
                          onClick={() => void copy("source", interpretation.source)}
                          className="ml-auto flex items-center rounded px-1.5 py-0.5 text-ink-tertiary transition-colors hover:text-apple-blue"
                          title="复制原文"
                        >
                          {copied === "source" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      ) : null}
                    </div>
                    {interpretingImage && interpretation.imageDataUrl ? (
                      <div
                        className="mb-2 overflow-hidden rounded-lg border"
                        style={{ borderColor: "var(--rc-border)", background: "var(--rc-card-inset-bg)" }}
                      >
                        <img src={interpretation.imageDataUrl} alt={interpretation.source} className="block max-h-72 w-full object-contain" />
                      </div>
                    ) : (
                      <div
                        className="mb-2 whitespace-pre-wrap rounded-lg border p-2.5 text-ink-secondary"
                        style={{ borderColor: "var(--rc-border)", background: "var(--rc-card-inset-bg)", fontSize, lineHeight: 1.7 }}
                      >
                        {interpretation.source}
                      </div>
                    )}
                  </>
                ) : null}

                <div
                  className="rounded-lg border p-2.5"
                  style={{ borderColor: "rgba(124,92,255,0.35)", background: "rgba(124,92,255,0.07)" }}
                >
                  <div className="mb-1 flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3 text-violet-500" />
                    <span className="text-[11px] font-semibold text-violet-500">解读</span>
                    {splitReasoning(interpretation.text).answer ? (
                      <button
                        type="button"
                        onClick={() => void copy("interpret", splitReasoning(interpretation.text).answer)}
                        className="ml-auto flex items-center gap-1 text-[11px] text-ink-tertiary transition-colors hover:text-apple-blue"
                        title="复制解读"
                      >
                        {copied === "interpret" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      </button>
                    ) : null}
                  </div>
                  {interpretation.status === "error" ? (
                    <p className="text-xs text-apple-red">{interpretation.error}</p>
                  ) : (
                    <InterpretationContent
                      text={interpretation.text}
                      loading={interpretation.status === "loading"}
                    />
                  )}
                </div>
              </section>
            ) : null}

            {/* 原文 */}
            {current ? (
            <section>
              <div className="mb-1.5 flex items-center gap-2">
                <span className="text-sm font-bold text-ink-primary">原文</span>
                <div className="ml-auto flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => void copy("source", current.source)}
                    className="flex items-center rounded p-0.5 text-ink-tertiary transition-colors hover:text-apple-blue"
                    title="复制原文"
                  >
                    {copied === "source" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDraft(draft === null ? current.source : null)}
                    className="flex items-center rounded p-0.5 text-ink-tertiary transition-colors hover:text-apple-blue"
                    title="修改原文后重新翻译（修正识别错误）"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {draft === null ? (
                <div
                  className="whitespace-pre-wrap rounded-lg border p-2.5 text-ink-secondary"
                  style={{ borderColor: "var(--rc-border)", background: "var(--rc-card-inset-bg)", fontSize, lineHeight: 1.7 }}
                >
                  {current.source}
                </div>
              ) : (
                <div className="space-y-2">
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    rows={5}
                    autoFocus
                    className="w-full rounded-lg border p-2.5 text-ink-primary outline-none"
                    style={{ borderColor: "var(--rc-accent)", background: "var(--rc-card-inset-bg)", fontSize, lineHeight: 1.7 }}
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setDraft(null)}
                      className="rounded px-2 py-1 text-[11px] text-ink-tertiary transition-colors hover:text-ink-secondary"
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const text = draft?.trim();
                        if (text) onEditSource(text);
                        setDraft(null);
                      }}
                      className="rounded px-2.5 py-1 text-[11px] font-semibold text-white transition-opacity hover:opacity-90"
                      style={{ background: "var(--rc-accent)" }}
                    >
                      重新翻译
                    </button>
                  </div>
                </div>
              )}
            </section>
            ) : null}
          </>
        )}
      </div>

      {onDragStart ? (
        <div
          className="absolute left-0 top-0 z-10 h-full w-1.5 cursor-col-resize transition-colors hover:bg-apple-blue/30"
          onMouseDown={onDragStart}
        />
      ) : null}
    </aside>
  );
}
