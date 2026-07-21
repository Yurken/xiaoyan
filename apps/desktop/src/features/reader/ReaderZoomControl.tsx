import { Minus, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface ReaderZoomControlProps {
  scalePercent: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onScalePercentChange: (percent: number) => void;
}

const MIN_SCALE_PERCENT = 60;
const MAX_SCALE_PERCENT = 300;

/** 阅读画布右下角的悬浮缩放控件，不占用顶部批注工具栏空间。 */
export default function ReaderZoomControl({
  scalePercent,
  onZoomIn,
  onZoomOut,
  onScalePercentChange,
}: ReaderZoomControlProps) {
  const [draft, setDraft] = useState(String(scalePercent));
  const [active, setActive] = useState(false);
  const focusedRef = useRef(false);
  const hoverRef = useRef(false);
  const skipBlurCommitRef = useRef(false);

  // 只在真实缩放比例变化且输入框未聚焦时同步 draft；blur 由 commit 直接写 draft，
  // 避免父组件 setState 异步导致 useEffect 用旧 scalePercent 覆盖新值。
  useEffect(() => {
    if (!focusedRef.current) setDraft(String(scalePercent));
  }, [scalePercent]);

  const commit = () => {
    const parsed = Number(draft.replace("%", "").trim());
    if (!Number.isFinite(parsed)) {
      setDraft(String(scalePercent));
      return;
    }
    const next = Math.round(Math.min(MAX_SCALE_PERCENT, Math.max(MIN_SCALE_PERCENT, parsed)));
    setDraft(String(next));
    onScalePercentChange(next);
  };

  const controlBtn =
    "flex h-7 w-7 items-center justify-center rounded-lg text-ink-tertiary transition-colors hover:text-ink-primary active:text-ink-secondary";

  return (
    <div
      className="absolute bottom-5 right-5 z-20 flex items-center gap-0.5 rounded-2xl border px-1 py-1 transition-opacity duration-200"
      style={{
        opacity: active ? 1 : 0.65,
        background: "var(--rc-card-bg)",
        borderColor: "var(--rc-border)",
        boxShadow: "var(--rc-card-shadow)",
      }}
      onMouseEnter={() => {
        hoverRef.current = true;
        setActive(true);
      }}
      onMouseLeave={() => {
        hoverRef.current = false;
        if (!focusedRef.current) setActive(false);
      }}
      aria-label="页面缩放"
    >
      <button type="button" onClick={onZoomOut} className={controlBtn} title="缩小">
        <Minus className="h-3.5 w-3.5" />
      </button>
      <div className="flex h-7 items-center rounded-lg px-1.5 focus-within:text-ink-primary">
        <input
          type="text"
          inputMode="decimal"
          value={draft}
          onFocus={(event) => {
            focusedRef.current = true;
            setActive(true);
            event.currentTarget.select();
          }}
          onChange={(event) => setDraft(event.target.value.replace(/[^\d.]/g, ""))}
          onBlur={() => {
            focusedRef.current = false;
            if (!hoverRef.current) setActive(false);
            if (skipBlurCommitRef.current) {
              skipBlurCommitRef.current = false;
              return;
            }
            commit();
          }}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === "Enter") {
              event.preventDefault();
              event.currentTarget.blur();
            }
            if (event.key === "Escape") {
              event.preventDefault();
              skipBlurCommitRef.current = true;
              setDraft(String(scalePercent));
              event.currentTarget.blur();
            }
          }}
          aria-label="缩放比例"
          title="输入 60–300 的缩放比例，按回车应用"
          className="rc-selectable w-9 bg-transparent text-right text-[11px] font-semibold tabular-nums text-ink-secondary outline-none focus:text-ink-primary"
        />
        <span className="text-[10px] text-ink-tertiary">%</span>
      </div>
      <button type="button" onClick={onZoomIn} className={controlBtn} title="放大">
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
