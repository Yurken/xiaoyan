import NotesPanel from "../features/knowledge/NotesPanel";

export default function Knowledge({ hideFolders = false }: { hideFolders?: boolean }) {
  return (
    <div className="h-full overflow-y-auto p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-ink-primary">知识库</h1>
        <p className="mt-1 text-sm text-ink-tertiary">
          把读过的论文、写过的综述整理成知识卡片，小妍帮你做好语义检索，让知识随时可用。
        </p>
      </div>

      <NotesPanel hideFolders={hideFolders} />
    </div>
  );
}
