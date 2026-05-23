import SurveyLatexEditor from "./SurveyLatexEditor";

export default function WritePage() {
  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-emerald-600"
          >
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">论文撰写</h1>
          <p className="text-sm text-gray-500">
            在线 LaTeX 学术写作编辑器，实时渲染数学公式，支持导出与下载。
          </p>
        </div>
      </div>

      <SurveyLatexEditor />
    </div>
  );
}
