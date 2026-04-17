import InterestsPanel from "../features/knowledge/InterestsPanel";

export default function Planner() {
  return (
    <div className="rc-app-page space-y-5" style={{ background: "var(--rc-surface)" }}>
      <div className="shrink-0">
        <h1 className="text-2xl font-bold text-ink-primary">研究方向规划</h1>
        <p className="mt-1 text-sm text-ink-tertiary">
          告诉小妍你的研究方向，她会帮你梳理学习路线、找到关键论文和值得深挖的问题。
        </p>
      </div>

      <InterestsPanel />
    </div>
  );
}
