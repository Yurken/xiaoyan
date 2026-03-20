"use client";
import { useState, useEffect } from "react";
import { FileText, Upload, Loader2, CheckCircle, XCircle } from "lucide-react";
import { Button, Card } from "@research-copilot/ui";
import { apiClient } from "../lib/client";
import type { Paper } from "@research-copilot/types";

export default function Papers() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    apiClient.papers.list().then(setPapers).finally(() => setLoading(false));
  }, []);

  const handleUpload = async () => {
    try {
      // Use Tauri dialog to pick PDF
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        multiple: false,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
      if (!selected) return;

      setUploading(true);
      // Read file via Tauri fs plugin and convert to File object
      const { readFile } = await import("@tauri-apps/plugin-fs");
      const bytes = await readFile(selected as string);
      const fileName = (selected as string).split("/").pop() ?? "paper.pdf";
      const file = new File([bytes], fileName, { type: "application/pdf" });

      const res = await apiClient.papers.upload(file);
      // Poll job until done
      if (res.job_id) {
        for await (const job of apiClient.jobs.poll(res.job_id)) {
          if (job.status === "done" || job.status === "failed") break;
        }
      }
      const updated = await apiClient.papers.list();
      setPapers(updated);
    } catch (e) {
      console.error(e);
    } finally {
      setUploading(false);
    }
  };

  const statusIcon = (status: string) => {
    if (status === "analyzed") return <CheckCircle className="w-4 h-4 text-green-500" />;
    if (status === "failed") return <XCircle className="w-4 h-4 text-red-500" />;
    return <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />;
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">论文库</h1>
        <Button onClick={handleUpload} loading={uploading} size="sm">
          <Upload className="w-4 h-4" />
          导入 PDF
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-gray-300" /></div>
      ) : papers.length === 0 ? (
        <Card className="flex flex-col items-center py-20 text-center">
          <FileText className="w-12 h-12 text-gray-300 mb-3" />
          <p className="text-gray-500">还没有论文，点击「导入 PDF」开始</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {papers.map((p) => (
            <Card key={p.id} padding="sm" className="flex items-center gap-3">
              {statusIcon(p.status)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{p.title}</p>
                <p className="text-xs text-gray-400">{new Date(p.created_at).toLocaleDateString("zh-CN")}</p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => apiClient.papers.analyze(p.id)}
                disabled={p.status === "analyzing"}
              >
                AI 分析
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
