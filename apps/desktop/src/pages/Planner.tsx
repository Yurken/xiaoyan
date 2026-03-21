import InterestsPanel from "../features/knowledge/InterestsPanel";

export default function Planner() {
  return (
    <div className="h-full overflow-y-auto p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-ink-primary">研究方向规划</h1>
        <p className="mt-1 text-sm text-ink-tertiary">
          为研究主题生成系统化学习路线、候选论文和可切入的研究问题。
        </p>
      </div>

      <InterestsPanel />
    </div>
  );
}
