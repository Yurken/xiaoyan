import { useState } from "react";
import KnowledgeGraphWorkspace from "../features/knowledge/KnowledgeGraphWorkspace";
import NotesPanel from "../features/knowledge/NotesPanel";

type KnowledgeView = "graph" | "notes";

export default function Knowledge({ hideFolders = false }: { hideFolders?: boolean }) {
  const [view, setView] = useState<KnowledgeView>("graph");

  return (
    <div className="h-full overflow-y-auto p-6 space-y-5">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-primary">知识库</h1>
          <p className="mt-1 text-sm text-ink-tertiary">
            不只是存笔记。把论文、观点、证据和实验组织成可追溯知识图谱，随时回答“这个结论从哪里来”。
          </p>
        </div>

        <div
          className="inline-flex rounded-2xl border p-1"
          style={{ borderColor: "var(--rc-border)", background: "var(--rc-panel-bg-soft, rgba(255,255,255,0.52))" }}
        >
          {([
            { key: "graph", label: "知识图谱" },
            { key: "notes", label: "知识笔记" },
          ] as const).map((item) => {
            const active = view === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setView(item.key)}
                className="rounded-xl px-4 py-2 text-sm font-medium transition-all duration-150"
                style={active
                  ? {
                      background: "var(--rc-button-secondary-bg)",
                      boxShadow: "var(--rc-button-secondary-shadow)",
                      color: "var(--rc-text)",
                    }
                  : {
                      color: "var(--rc-text-muted)",
                    }}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {view === "graph" ? (
        <KnowledgeGraphWorkspace />
      ) : (
        <NotesPanel hideFolders={hideFolders} />
      )}
    </div>
  );
}
