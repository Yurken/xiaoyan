import SurveyPanel from "../features/knowledge/SurveyPanel";

export default function Survey({ hideFolders = false }: { hideFolders?: boolean }) {
  return (
    <div className="rc-app-page space-y-5" style={{ background: "var(--rc-surface)" }}>
      <div className="shrink-0 px-2 pt-2">
        <h1 className="text-2xl font-bold text-ink-primary">文献综述</h1>
        <p className="mt-1 text-sm text-ink-tertiary">
          告诉小妍一个研究问题，她会帮你找文献、读摘要、整理成综述初稿。
        </p>
      </div>

      <SurveyPanel hideInterestPanel={hideFolders} />
    </div>
  );
}
