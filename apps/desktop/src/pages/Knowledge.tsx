import NotesPanel from "../features/knowledge/NotesPanel";

export default function Knowledge() {
  return (
    <div className="h-full overflow-y-auto p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-ink-primary">知识库</h1>
        <p className="mt-1 text-sm text-ink-tertiary">
          管理知识卡片、标签和研究方向关联，让分析结果真正沉淀为可复用资产。
        </p>
      </div>

      <NotesPanel />
    </div>
  );
}
