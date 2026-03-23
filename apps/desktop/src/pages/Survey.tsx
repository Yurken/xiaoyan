import SurveyPanel from "../features/knowledge/SurveyPanel";

export default function Survey() {
  return (
    <div className="h-full overflow-y-auto p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-ink-primary">文献综述</h1>
        <p className="mt-1 text-sm text-ink-tertiary">
          输入一个研究问题，小妍帮你找文献、筛选、写成综述初稿。
        </p>
      </div>

      <SurveyPanel />
    </div>
  );
}
