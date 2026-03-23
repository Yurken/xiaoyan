import NotesPanel from "../features/knowledge/NotesPanel";

export default function Knowledge({ hideFolders = false }: { hideFolders?: boolean }) {
  return (
    <div className="h-full overflow-y-auto p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-ink-primary">知识库</h1>
        <p className="mt-1 text-sm text-ink-tertiary">
          把读过的论文、写过的综述整理成笔记，随时检索，慢慢积累。
        </p>
      </div>

      <NotesPanel hideFolders={hideFolders} />
    </div>
  );
}
