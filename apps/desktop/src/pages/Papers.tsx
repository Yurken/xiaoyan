import { useState, useEffect } from "react";
import { FileText, Upload, Loader2, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { Button, Card, Badge } from "@research-copilot/ui";
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
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        multiple: false,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
      if (!selected) return;

      setUploading(true);
      const { readFile } = await import("@tauri-apps/plugin-fs");
      const bytes = await readFile(selected as string);
      const fileName = (selected as string).split("/").pop() ?? "paper.pdf";
      const file = new File([bytes], fileName, { type: "application/pdf" });

      const res = await apiClient.papers.upload(file);
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

  const statusBadge = (status: string) => {
    if (status === "analyzed") return <Badge variant="success">已分析</Badge>;
    if (status === "failed")   return <Badge variant="danger">失败</Badge>;
    if (status === "analyzing") return <Badge variant="info">分析中</Badge>;
    return <Badge variant="default">待分析</Badge>;
  };

  const statusIcon = (status: string) => {
    if (status === "analyzed")  return <CheckCircle className="w-5 h-5 text-apple-green" />;
    if (status === "failed")    return <XCircle className="w-5 h-5 text-apple-red" />;
    if (status === "analyzing") return <Loader2 className="w-5 h-5 text-apple-blue animate-spin" />;
    return <AlertCircle className="w-5 h-5 text-ink-tertiary" />;
  };

  return (
    <div className="h-full overflow-y-auto p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-primary">论文库</h1>
          <p className="text-sm text-ink-tertiary mt-0.5">
            共 {papers.length} 篇论文
          </p>
        </div>
        <Button onClick={handleUpload} loading={uploading} size="md">
          <Upload className="w-4 h-4" />
          导入 PDF
        </Button>
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
      ) : papers.length === 0 ? (
        <Card className="flex flex-col items-center py-20 text-center gap-4">
          <div
            className="w-16 h-16 rounded-3xl flex items-center justify-center"
            style={{
              background: "#E8ECF0",
              boxShadow: "inset 4px 4px 8px #C8CDD3, inset -4px -4px 8px #FFFFFF",
            }}
          >
            <FileText className="w-8 h-8 text-ink-tertiary" />
          </div>
          <div>
            <p className="text-ink-secondary font-medium">还没有论文</p>
            <p className="text-sm text-ink-tertiary mt-1">点击「导入 PDF」开始</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {papers.map((p) => (
            <Card key={p.id} padding="sm" className="flex items-center gap-4">
              {/* Icon */}
              <div
                className="w-10 h-10 rounded-2xl flex-shrink-0 flex items-center justify-center"
                style={{
                  background: "#E8ECF0",
                  boxShadow: "inset 2px 2px 5px #C8CDD3, inset -2px -2px 5px #FFFFFF",
                }}
              >
                {statusIcon(p.status)}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-ink-primary truncate">{p.title}</p>
                  {statusBadge(p.status)}
                </div>
                <p className="text-xs text-ink-tertiary mt-0.5">
                  {new Date(p.created_at).toLocaleDateString("zh-CN")}
                </p>
              </div>

              {/* Action */}
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
