import { useState, useEffect } from "react";
import { FileText, Upload, Loader2, CheckCircle, XCircle, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { listen } from "@tauri-apps/api/event";
import { Button, Card, Badge } from "@research-copilot/ui";
import { apiClient, formatErrorMessage } from "../lib/client";
import type { Paper } from "@research-copilot/types";

export default function Papers() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setLoadError("");

    apiClient.papers.list()
      .then((data) => {
        if (!cancelled) {
          setPapers(data);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadError(formatErrorMessage(error));
          setPapers([]);
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
  }, []);

  const handleUpload = async () => {
    try {
      setLoadError("");
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        multiple: false,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
      if (!selected) return;

      const selectedPath =
        typeof selected === "string"
          ? selected
          : typeof selected === "object" && selected !== null && "path" in selected
            ? String((selected as { path: unknown }).path)
            : "";

      if (!selectedPath) {
        throw new Error("未识别的文件路径，请重新选择 PDF 文件");
      }

      setUploading(true);
      const res = await apiClient.papers.upload(selectedPath);
      const updated = await apiClient.papers.list();
      setPapers(updated);
    } catch (e) {
      console.error(e);
      setLoadError(formatErrorMessage(e));
    } finally {
      setUploading(false);
    }
  };

  // Listen for paper:status events from the Rust backend
  useEffect(() => {
    const unlisten = listen<{ paper_id: string; status: string; error?: string }>(
      "paper:status",
      (e) => {
        const { paper_id, status } = e.payload;
        setPapers((prev) =>
          prev.map((p) => (p.id === paper_id ? { ...p, status } : p))
        );
      }
    );
    return () => { void unlisten.then((fn) => fn()); };
  }, []);

  const handleAnalyze = async (id: string) => {
    try {
      setLoadError("");
      // Optimistic update
      setPapers((prev) => prev.map((p) => (p.id === id ? { ...p, status: "analyzing" } : p)));
      await apiClient.papers.analyze(id);
    } catch (error) {
      setLoadError(formatErrorMessage(error));
      setPapers((prev) => prev.map((p) => (p.id === id ? { ...p, status: "failed" } : p)));
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
            <Card key={p.id} padding="sm" className="space-y-0">
              <div className="flex items-center gap-4">
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

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void handleAnalyze(p.id)}
                    disabled={p.status === "analyzing"}
                  >
                    {p.status === "analyzing" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    {p.status === "analyzing" ? "分析中…" : "AI 分析"}
                  </Button>
                  {p.status === "analyzed" && (
                    <button
                      onClick={() => setExpanded(expanded === p.id ? null : p.id)}
                      className="p-1.5 rounded-xl text-ink-tertiary hover:text-ink-primary transition-colors"
                      style={{ background: "#E8ECF0", boxShadow: "2px 2px 5px #C8CDD3, -2px -2px 5px #FFFFFF" }}
                    >
                      {expanded === p.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              </div>

              {/* Analysis result panel */}
              {expanded === p.id && p.analysis && (
                <div className="mt-3 pt-3 border-t border-nm-dark/10 space-y-2">
                  {(
                    [
                      ["研究问题", p.analysis.research_question],
                      ["核心方法", p.analysis.core_method],
                      ["实验设计", p.analysis.experiment_design],
                      ["创新点", p.analysis.innovations],
                      ["局限性", p.analysis.limitations],
                      ["关键结论", p.analysis.key_conclusions],
                    ] as [string, string | undefined][]
                  ).filter(([, v]) => v).map(([label, value]) => (
                    <div key={label}>
                      <span className="text-[11px] font-semibold text-ink-tertiary uppercase tracking-wide">{label}</span>
                      <p className="text-xs text-ink-secondary mt-0.5 leading-5">{value}</p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
