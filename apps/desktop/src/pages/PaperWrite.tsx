import SurveyLatexEditor from "../features/knowledge/SurveyLatexEditor";

export default function PaperWrite() {
  return (
    <div className="rc-app-page !overflow-hidden flex h-full flex-col" style={{ background: "var(--rc-surface)" }}>
      {/* Header */}
      <div className="shrink-0 mb-5">
        <h1 className="text-2xl font-bold text-ink-primary">论文撰写</h1>
        <p className="mt-1 text-sm text-ink-tertiary">
          基于 KaTeX 的专业级 LaTeX 学术写作环境。支持实时公式渲染、结构化预览与跨平台导出。
        </p>
      </div>

      {/* Main Content Area */}
      <div className="min-h-0 flex-1">
        <SurveyLatexEditor />
      </div>
    </div>
  );
}
