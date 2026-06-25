import { FileText, ImageIcon, Loader2, Paperclip, Sparkles, X } from "lucide-react";
import { Button } from "@research-copilot/ui";
import { useIdeaFromMaterials } from "./useIdeaFromMaterials";

interface Props {
  onSelect: (topic: string) => void;
  onClose: () => void;
}

export default function IdeaFromMaterialsPanel({ onSelect, onClose }: Props) {
  const { notes, setNotes, items, ideas, reading, loading, error, addFiles, removeItem, generate } =
    useIdeaFromMaterials();

  const hasMaterials = notes.trim().length > 0 || items.length > 0;

  return (
    <div
      className="rounded-2xl p-4 space-y-4"
      style={{ background: "var(--rc-elevated)", boxShadow: "var(--rc-inset-shadow)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink-primary flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-apple-blue flex-shrink-0" />
            给小妍一些资料，帮你找 idea
          </p>
          <p className="mt-0.5 text-xs text-ink-tertiary">
            和老师讨论的记录、会议笔记、灵感碎片、相关截图都行，小妍帮你提炼方向和背景
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-ink-tertiary hover:text-ink-primary px-2 py-1 rounded-lg transition-colors flex-shrink-0"
        >
          收起
        </button>
      </div>

      {/* 自由文字 / 碎片 */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-ink-secondary">粘贴文字、笔记或讨论记录</p>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="例如：和导师讨论时提到想结合扩散模型做分子生成；会议里说现有数据噪声大、缺评测基准…"
          rows={4}
          className="w-full resize-none rounded-xl px-3 py-2 text-xs text-ink-primary placeholder:text-ink-tertiary outline-none"
          style={{ background: "var(--rc-chip-inset-bg)", boxShadow: "var(--rc-chip-inset-shadow)" }}
        />
      </div>

      {/* 文件 / 图片材料 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-ink-secondary">添加文档或图片（可选）</p>
          <button
            type="button"
            onClick={() => void addFiles()}
            disabled={reading}
            className="inline-flex items-center gap-1 text-xs text-apple-blue hover:underline disabled:opacity-50"
          >
            {reading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
            添加文件（txt / md / pdf / 图片）
          </button>
        </div>
        {items.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {items.map((item) => (
              <span
                key={item.id}
                className="group inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[11px] text-ink-soft"
                style={{ background: "var(--rc-chip-inset-bg)", boxShadow: "var(--rc-chip-inset-shadow)" }}
                title={item.name}
              >
                {item.kind === "image" ? (
                  <ImageIcon className="h-3.5 w-3.5 flex-shrink-0 text-apple-blue" />
                ) : (
                  <FileText className="h-3.5 w-3.5 flex-shrink-0 text-apple-blue" />
                )}
                <span className="max-w-[8rem] truncate">{item.name}</span>
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="text-ink-tertiary hover:text-apple-red"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        {error ? <p className="text-xs text-apple-red flex-1">{error}</p> : <span className="flex-1" />}
        <Button size="sm" onClick={() => void generate()} disabled={!hasMaterials || loading || reading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {ideas.length > 0 ? "换一批" : "让小妍找 idea"}
        </Button>
      </div>

      {/* 结果 */}
      {loading ? (
        <div className="flex items-center gap-2 py-4 justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-apple-blue" />
          <span className="text-xs text-ink-tertiary">小妍正在阅读材料、提炼 idea…</span>
        </div>
      ) : ideas.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-ink-secondary">从你的材料里提炼的方向（点一个开始规划）</p>
          <div className="flex flex-col gap-2">
            {ideas.map((idea, index) => (
              <button
                key={`${idea.title}-${index}`}
                type="button"
                onClick={() => onSelect(idea.title)}
                className="w-full text-left px-3 py-2.5 rounded-xl transition-all duration-150 hover:text-apple-blue"
                style={{ background: "var(--rc-chip-inset-bg)", boxShadow: "var(--rc-chip-inset-shadow)" }}
              >
                <p className="text-xs font-semibold text-ink-primary">{idea.title}</p>
                {idea.rationale && <p className="mt-1 text-[11px] leading-5 text-ink-secondary">{idea.rationale}</p>}
                {idea.background && <p className="mt-1 text-[11px] leading-5 text-ink-tertiary">背景：{idea.background}</p>}
                {idea.keywords.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {idea.keywords.map((kw) => (
                      <span
                        key={kw}
                        className="rounded-md px-1.5 py-0.5 text-[10px] text-ink-tertiary"
                        style={{ background: "var(--rc-chip-bg)" }}
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
