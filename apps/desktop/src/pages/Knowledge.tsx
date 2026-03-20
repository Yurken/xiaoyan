import { useState, useEffect } from "react";
import { BookOpen, Search, Loader2, AlertCircle } from "lucide-react";
import { Card } from "@research-copilot/ui";
import { apiClient, formatErrorMessage } from "../lib/client";
import type { KnowledgeNote } from "@research-copilot/types";

export default function Knowledge() {
  const [notes, setNotes] = useState<KnowledgeNote[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setLoadError("");

    apiClient.knowledge
      .listNotes(search || undefined)
      .then((data) => {
        if (!cancelled) {
          setNotes(data);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadError(formatErrorMessage(error));
          setNotes([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [search]);

  return (
    <div className="h-full overflow-y-auto p-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-ink-primary">知识库</h1>
        <p className="text-sm text-ink-tertiary mt-0.5">
          {notes.length > 0 ? `共 ${notes.length} 条笔记` : "分析论文后自动生成"}
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <div
          className="absolute left-4 top-1/2 -translate-y-1/2"
          style={{ color: "#8E8E93" }}
        >
          <Search className="w-4 h-4" />
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索笔记…"
          className="w-full rounded-3xl pl-10 pr-4 py-3 text-sm text-ink-primary placeholder:text-ink-tertiary outline-none border-0 transition-shadow duration-150"
          style={{
            background: "#E8ECF0",
            boxShadow: "inset 2px 2px 5px #C8CDD3, inset -2px -2px 5px #FFFFFF",
          }}
          onFocus={(e) => {
            e.currentTarget.style.boxShadow =
              "inset 3px 3px 7px #C0C5CB, inset -3px -3px 7px #FFFFFF, 0 0 0 2px rgba(0,122,255,0.2)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.boxShadow =
              "inset 2px 2px 5px #C8CDD3, inset -2px -2px 5px #FFFFFF";
          }}
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <div
            className="w-14 h-14 rounded-3xl flex items-center justify-center"
            style={{ background: "#E8ECF0", boxShadow: "5px 5px 10px #C8CDD3, -5px -5px 10px #FFFFFF" }}
          >
            <Loader2 className="w-7 h-7 text-apple-blue animate-spin" />
          </div>
          <p className="text-sm text-ink-tertiary">加载中…</p>
        </div>
      ) : loadError ? (
        <Card className="flex flex-col items-center py-20 text-center gap-4">
          <div
            className="w-16 h-16 rounded-3xl flex items-center justify-center"
            style={{
              background: "#E8ECF0",
              boxShadow: "inset 4px 4px 8px #C8CDD3, inset -4px -4px 8px #FFFFFF",
            }}
          >
            <AlertCircle className="w-8 h-8 text-apple-red" />
          </div>
          <div>
            <p className="text-ink-secondary font-medium">无法连接后端</p>
            <p className="mt-1 break-all text-sm text-apple-red">{loadError}</p>
          </div>
        </Card>
      ) : notes.length === 0 ? (
        <Card className="flex flex-col items-center py-20 text-center gap-4">
          <div
            className="w-16 h-16 rounded-3xl flex items-center justify-center"
            style={{
              background: "#E8ECF0",
              boxShadow: "inset 4px 4px 8px #C8CDD3, inset -4px -4px 8px #FFFFFF",
            }}
          >
            <BookOpen className="w-8 h-8 text-ink-tertiary" />
          </div>
          <div>
            <p className="text-ink-secondary font-medium">
              {search ? "未找到相关笔记" : "暂无笔记"}
            </p>
            <p className="text-sm text-ink-tertiary mt-1">
              {search ? "换个关键词试试" : "分析论文后自动生成知识卡片"}
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {notes.map((n) => (
            <Card key={n.id} padding="sm" className="flex flex-col gap-2 cursor-default hover:scale-[1.01] transition-transform duration-150">
              <p className="text-sm font-semibold text-ink-primary line-clamp-1">{n.title}</p>
              <p className="text-xs text-ink-secondary leading-relaxed line-clamp-3">{n.content}</p>
              <p className="text-xs text-ink-tertiary mt-auto pt-1">
                {new Date(n.created_at).toLocaleDateString("zh-CN")}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
