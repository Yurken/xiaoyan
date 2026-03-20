import { useState, useEffect } from "react";
import { BookOpen, Search, Loader2 } from "lucide-react";
import { Card, Input } from "@research-copilot/ui";
import { apiClient } from "../lib/client";
import type { KnowledgeNote } from "@research-copilot/types";

export default function Knowledge() {
  const [notes, setNotes] = useState<KnowledgeNote[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.knowledge.listNotes(search || undefined)
      .then(setNotes)
      .finally(() => setLoading(false));
  }, [search]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">知识库</h1>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索笔记..."
          className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-gray-300" /></div>
      ) : notes.length === 0 ? (
        <Card className="flex flex-col items-center py-20 text-center">
          <BookOpen className="w-12 h-12 text-gray-300 mb-3" />
          <p className="text-gray-500">暂无笔记，分析论文后自动生成</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {notes.map((n) => (
            <Card key={n.id} padding="sm">
              <p className="text-sm font-medium text-gray-900">{n.title}</p>
              <p className="text-xs text-gray-500 mt-1 line-clamp-2">{n.content}</p>
              <p className="text-xs text-gray-400 mt-2">{new Date(n.created_at).toLocaleDateString("zh-CN")}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
