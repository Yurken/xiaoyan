import InterestsPanel from "../features/knowledge/InterestsPanel";

export default function Planner() {
  return (
    <div className="h-full overflow-y-auto p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-ink-primary">研究方向规划</h1>
        <p className="mt-1 text-sm text-ink-tertiary">
          输入一个研究方向，小妍帮你梳理学习路线、找到关键论文和值得深挖的问题。
        </p>
      </div>

      <InterestsPanel />
    </div>
  );
}
