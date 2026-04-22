"use client";

import { useState, useEffect, useRef, type ChangeEvent } from "react";
import Link from "next/link";
import { FileText, Upload, Plus, Trash2, Eye, Clock } from "lucide-react";
import { Card, Button, Badge, ConfirmDialog } from "@research-copilot/ui";
import { papersApi } from "@/lib/client";
import type { Paper } from "@research-copilot/types";

const statusMap: Record<string, { label: string; variant: "default" | "info" | "success" | "warning" }> = {
  uploaded: { label: "已上传", variant: "default" },
  parsed: { label: "已解析", variant: "info" },
  analyzed: { label: "已分析", variant: "success" },
};

export default function PapersPage() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingPaperId, setDeletingPaperId] = useState<string | null>(null);
  const [pendingDeletePaper, setPendingDeletePaper] = useState<Paper | null>(null);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchPapers = async () => {
    try {
      const data = await papersApi.list() as Paper[];
      setPapers(data);
    } catch {
      setError("加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPapers(); }, []);

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      await papersApi.upload(file);
      await fetchPapers();
    } catch (e) {
      setError(e instanceof Error ? e.message : "上传失败");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleDelete = async () => {
    if (!pendingDeletePaper) return;
    setDeletingPaperId(pendingDeletePaper.id);
    try {
      await papersApi.delete(pendingDeletePaper.id);
      setPapers((prev) => prev.filter((p) => p.id !== pendingDeletePaper.id));
      setPendingDeletePaper(null);
    } catch {
      setError("删除失败");
    } finally {
      setDeletingPaperId(null);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center">
            <FileText className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">论文库</h1>
            <p className="text-sm text-gray-500">上传 PDF，小妍帮你精读论文并生成可执行的复现指导</p>
          </div>
        </div>
        <div>
          <input ref={fileRef} type="file" accept=".pdf" onChange={handleUpload} className="hidden" />
          <Button onClick={() => fileRef.current?.click()} loading={uploading}>
            <Upload className="w-4 h-4" />
            上传论文
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>
      )}

      {loading ? (
        <div className="text-center py-16 text-gray-400">正在加载...</div>
      ) : papers.length === 0 ? (
        <Card className="text-center py-16">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <FileText className="w-7 h-7 text-gray-400" />
          </div>
          <h3 className="font-semibold text-gray-700 mb-2">暂无论文</h3>
          <p className="text-sm text-gray-500 mb-4">上传第一篇论文，小妍会帮你梳理核心内容并生成复现指导</p>
          <Button onClick={() => fileRef.current?.click()} variant="secondary">
            <Plus className="w-4 h-4" />
            上传第一篇
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {papers.map((paper) => {
            const status = statusMap[paper.status] || { label: paper.status, variant: "default" as const };
            return (
              <Card key={paper.id} padding="sm">
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <Link href={`/papers/${paper.id}`} className="hover:text-brand-600">
                      <h3 className="font-semibold text-gray-900 text-sm leading-snug mb-1 hover:text-brand-600 transition-colors line-clamp-2">
                        {paper.title}
                      </h3>
                    </Link>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      {paper.authors && <span className="text-xs text-gray-500 truncate max-w-xs">{paper.authors}</span>}
                      {paper.year && <span className="text-xs text-gray-400">· {paper.year}</span>}
                      {paper.venue && <span className="text-xs text-gray-400">· {paper.venue}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={status.variant}>{status.label}</Badge>
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(paper.created_at).toLocaleDateString("zh-CN")}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Link href={`/papers/${paper.id}`}>
                      <Button variant="ghost" size="sm">
                        <Eye className="w-4 h-4" />
                        精读
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`删除论文 ${paper.title}`}
                      title="删除论文"
                      onClick={() => setPendingDeletePaper(paper)}
                      className="text-red-400 hover:text-red-600 hover:bg-red-50">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={pendingDeletePaper !== null}
        title="删除论文"
        description={
          pendingDeletePaper
            ? `确认删除《${pendingDeletePaper.title}》吗？删除后无法恢复。`
            : ""
        }
        confirmLabel="确认删除"
        tone="danger"
        loading={deletingPaperId !== null}
        onClose={() => {
          if (deletingPaperId) return;
          setPendingDeletePaper(null);
        }}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}
