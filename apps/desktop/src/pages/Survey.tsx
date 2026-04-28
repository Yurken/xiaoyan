import SurveyPanel from "../features/knowledge/SurveyPanel";

export default function Survey({ hideFolders = false }: { hideFolders?: boolean }) {
  return (
    <div className="rc-app-page space-y-5" style={{ background: "var(--rc-surface)" }}>
      <div className="shrink-0">
        <h1 className="text-2xl font-bold text-ink-primary">文献综述</h1>
        <p className="mt-1 text-sm text-ink-tertiary">
          告诉小妍一个研究问题，她来帮你检索相关文献、提炼核心观点、整理成结构化综述初稿。
        </p>
      </div>

      <SurveyPanel hideInterestPanel={hideFolders} />
    </div>
  );
}
