import SurveyPanel from "../features/knowledge/SurveyPanel";

export default function Survey() {
  return (
    <div className="h-full overflow-y-auto p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-ink-primary">文献综述</h1>
        <p className="mt-1 text-sm text-ink-tertiary">
          请输入研究问题，系统将自动规划检索、筛选候选论文并输出结构化综述。
        </p>
      </div>

      <SurveyPanel />
    </div>
  );
}
