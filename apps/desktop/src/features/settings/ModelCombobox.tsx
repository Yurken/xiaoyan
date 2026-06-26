import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Loader2, RefreshCw } from "lucide-react";

interface ModelComboboxProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
  /** 已查询到的可用模型；为空时点开会触发一次查询。 */
  models: string[];
  loading: boolean;
  error?: string;
  /** 向服务商查询可用模型列表。 */
  onQuery: () => void;
}

/**
 * 模型输入组合框：自由输入 + 下拉选择。下拉项来自服务商 `/models` 查询结果，
 * 按当前输入做子串过滤；输入框始终可手填任意模型名。
 */
export default function ModelCombobox({
  label,
  value,
  onChange,
  placeholder,
  hint,
  models,
  loading,
  error,
  onQuery,
}: ModelComboboxProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointer = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const keyword = value.trim().toLowerCase();
    if (!keyword) return models;
    return models.filter((model) => model.toLowerCase().includes(keyword));
  }, [models, value]);

  const openAndQuery = () => {
    setOpen(true);
    if (models.length === 0 && !loading) onQuery();
  };

  return (
    <div className="space-y-1.5" ref={containerRef}>
      <label className="ml-1 block text-xs font-medium text-ink-tertiary">{label}</label>
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={(event) => {
            event.currentTarget.style.boxShadow =
              "var(--rc-chip-inset-shadow), 0 0 0 2px rgba(0,122,255,0.25)";
          }}
          onBlur={(event) => {
            event.currentTarget.style.boxShadow = "var(--rc-chip-inset-shadow)";
          }}
          placeholder={placeholder}
          className="w-full rounded-2xl border-0 px-4 py-2.5 pr-10 text-sm text-ink-primary outline-none transition-shadow duration-150 placeholder:text-ink-tertiary"
          style={{ background: "var(--rc-chip-inset-bg)", boxShadow: "var(--rc-chip-inset-shadow)" }}
        />
        <button
          type="button"
          onClick={() => (open ? setOpen(false) : openAndQuery())}
          title="查询可用模型"
          className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-ink-tertiary transition-colors hover:text-ink-secondary"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ChevronDown
              className="h-4 w-4 transition-transform duration-150"
              style={{ transform: open ? "rotate(180deg)" : "none" }}
            />
          )}
        </button>

        {open ? (
          <div
            className="absolute z-30 mt-1 w-full overflow-hidden rounded-2xl p-1"
            style={{
              background: "var(--rc-elevated)",
              border: "1px solid var(--rc-border)",
              boxShadow: "var(--rc-card-pop-shadow, 0 12px 32px rgba(0,0,0,0.18))",
            }}
          >
            <button
              type="button"
              onClick={() => onQuery()}
              disabled={loading}
              className="flex w-full items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[11px] font-medium text-ink-tertiary transition-colors hover:bg-[var(--rc-chip-bg)] disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              {loading ? "查询中…" : "重新查询可用模型"}
            </button>

            <div className="max-h-56 overflow-y-auto py-1">
              {error ? (
                <p className="px-2.5 py-2 text-[11px] leading-4 text-rose-500">{error}</p>
              ) : loading ? null : filtered.length === 0 ? (
                <p className="px-2.5 py-2 text-[11px] leading-4 text-ink-tertiary">
                  {models.length === 0 ? "尚未查询到模型，点击上方按钮获取。" : "无匹配模型，可直接手动输入。"}
                </p>
              ) : (
                filtered.map((model) => {
                  const active = model === value;
                  return (
                    <button
                      key={model}
                      type="button"
                      onClick={() => {
                        onChange(model);
                        setOpen(false);
                      }}
                      className="block w-full truncate rounded-xl px-2.5 py-1.5 text-left text-xs font-mono transition-colors hover:bg-[var(--rc-chip-bg)]"
                      style={{
                        color: active ? "var(--rc-text)" : "var(--rc-text-soft)",
                        background: active ? "color-mix(in srgb, var(--rc-accent) 10%, transparent)" : "transparent",
                      }}
                    >
                      {model}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        ) : null}
      </div>
      {hint ? <p className="ml-1 text-xs leading-5 text-ink-tertiary">{hint}</p> : null}
    </div>
  );
}
