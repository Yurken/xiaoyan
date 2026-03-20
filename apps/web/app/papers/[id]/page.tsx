"use client";

import { useState, useEffect, use, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft, Sparkles, Code2, FlaskConical, Lightbulb, AlertTriangle,
  CheckCircle, ChevronDown, ChevronUp, MessageSquare
} from "lucide-react";
import { Card, CardHeader, CardTitle, Button, Badge } from "@research-copilot/ui";
import { papersApi } from "@/lib/client";
import type { Paper } from "@research-copilot/types";

interface SectionProps {
  title: string;
  icon: ReactNode;
  content?: string;
  defaultOpen?: boolean;
}

function Section({ title, icon, content, defaultOpen = false }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  if (!content) return null;

  let parsed: unknown = null;
  try { parsed = JSON.parse(content); } catch { parsed = null; }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-medium text-sm text-gray-900">{title}</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && (
        <div className="p-4">
          {Array.isArray(parsed) ? (
            <ul className="space-y-2">
              {(parsed as string[]).map((item, i) => (
                <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                  <span className="text-brand-400 mt-0.5">•</span>
                  <span>{typeof item === "string" ? item : JSON.stringify(item)}</span>
                </li>
              ))}
            </ul>
          ) : typeof parsed === "object" && parsed !== null ? (
            <pre className="text-xs text-gray-700 whitespace-pre-wrap bg-gray-50 p-3 rounded-lg overflow-auto max-h-96">
              {JSON.stringify(parsed, null, 2)}
            </pre>
          ) : (
            <p className="text-sm text-gray-700 leading-relaxed">{content}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function PaperDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [paper, setPaper] = useState<Paper | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [reproducing, setReproducing] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"analysis" | "reproduction">("analysis");

  const fetchPaper = async () => {
    try {
      const data = await papersApi.get(id) as Paper;
      setPaper(data);
    } catch {
      setError("论文不存在或加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPaper(); }, [id]);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setError("");
    try {
      await papersApi.analyze(id);
      await fetchPaper();
    } catch (e) {
      setError(e instanceof Error ? e.message : "分析失败");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleReproduce = async () => {
    setReproducing(true);
    setError("");
    try {
      await papersApi.reproduce(id);
      await fetchPaper();
      setActiveTab("reproduction");
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成复现指导失败");
    } finally {
      setReproducing(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-400">加载中...</div>;
  if (!paper) return <div className="p-8 text-center text-red-500">{error}</div>;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link href="/papers" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft className="w-4 h-4" />
          返回论文库
        </Link>
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900 leading-snug mb-2">{paper.title}</h1>
            <div className="flex flex-wrap items-center gap-2">
              {paper.authors && <span className="text-sm text-gray-500">{paper.authors}</span>}
              {paper.year && <Badge variant="info">{paper.year}</Badge>}
              {paper.venue && <Badge>{paper.venue}</Badge>}
              <Badge variant={paper.status === "analyzed" ? "success" : "default"}>
                {paper.status === "analyzed" ? "已分析" : paper.status === "parsed" ? "已解析" : "已上传"}
              </Badge>
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Link href={`/copilot?context_type=paper&context_id=${id}&title=${encodeURIComponent(paper.title)}`}>
              <Button variant="secondary" size="sm">
                <MessageSquare className="w-4 h-4" />
                对话
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>
      )}

      {/* Action buttons */}
      {!paper.analysis && (
        <Card className="mb-5 bg-brand-50 border-brand-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-brand-900">还没有 AI 精读分析</div>
              <div className="text-sm text-brand-700 mt-0.5">点击按钮，AI 自动提取研究问题、方法、创新点等结构化信息</div>
            </div>
            <Button onClick={handleAnalyze} loading={analyzing}>
              <Sparkles className="w-4 h-4" />
              {analyzing ? "分析中..." : "开始精读"}
            </Button>
          </div>
        </Card>
      )}

      {paper.analysis && !paper.reproduction_guide && (
        <Card className="mb-5 bg-violet-50 border-violet-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-violet-900">还没有复现指导</div>
              <div className="text-sm text-violet-700 mt-0.5">基于论文内容生成详细的实验复现流程</div>
            </div>
            <Button onClick={handleReproduce} loading={reproducing}
              className="bg-violet-600 hover:bg-violet-700 text-white">
              <FlaskConical className="w-4 h-4" />
              {reproducing ? "生成中..." : "生成复现指导"}
            </Button>
          </div>
        </Card>
      )}

      {/* Tabs */}
      {(paper.analysis || paper.reproduction_guide) && (
        <>
          <div className="flex gap-1 mb-5 border-b border-gray-200">
            {[
              { key: "analysis", label: "论文精读" },
              { key: "reproduction", label: "复现指导" },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key as "analysis" | "reproduction")}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === key
                    ? "border-brand-600 text-brand-700"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {activeTab === "analysis" && paper.analysis && (
            <div className="space-y-3">
              <Section
                title="研究问题"
                icon={<Lightbulb className="w-4 h-4 text-amber-500" />}
                content={paper.analysis.research_question}
                defaultOpen
              />
              <Section
                title="核心方法"
                icon={<Code2 className="w-4 h-4 text-blue-500" />}
                content={paper.analysis.core_method}
                defaultOpen
              />
              <Section
                title="实验设计"
                icon={<FlaskConical className="w-4 h-4 text-violet-500" />}
                content={paper.analysis.experiment_design}
                defaultOpen
              />
              <Section
                title="创新点"
                icon={<Sparkles className="w-4 h-4 text-emerald-500" />}
                content={paper.analysis.innovations}
                defaultOpen
              />
              <Section
                title="局限性"
                icon={<AlertTriangle className="w-4 h-4 text-amber-500" />}
                content={paper.analysis.limitations}
              />
              <Section
                title="关键结论"
                icon={<CheckCircle className="w-4 h-4 text-green-500" />}
                content={paper.analysis.key_conclusions}
                defaultOpen
              />
            </div>
          )}

          {activeTab === "reproduction" && paper.reproduction_guide && (
            <div className="space-y-3">
              <Section
                title="环境配置"
                icon={<Code2 className="w-4 h-4 text-blue-500" />}
                content={paper.reproduction_guide.environment_setup}
                defaultOpen
              />
              <Section
                title="依赖安装"
                icon={<Code2 className="w-4 h-4 text-gray-500" />}
                content={paper.reproduction_guide.dependencies}
                defaultOpen
              />
              <Section
                title="数据集准备"
                icon={<FlaskConical className="w-4 h-4 text-violet-500" />}
                content={paper.reproduction_guide.dataset_preparation}
                defaultOpen
              />
              <Section
                title="训练流程"
                icon={<Sparkles className="w-4 h-4 text-brand-500" />}
                content={paper.reproduction_guide.training_process}
                defaultOpen
              />
              <Section
                title="推理 / 测试流程"
                icon={<CheckCircle className="w-4 h-4 text-green-500" />}
                content={paper.reproduction_guide.inference_process}
              />
              <Section
                title="评价指标"
                icon={<CheckCircle className="w-4 h-4 text-emerald-500" />}
                content={paper.reproduction_guide.evaluation_metrics}
              />
              <Section
                title="复现风险 & 注意事项"
                icon={<AlertTriangle className="w-4 h-4 text-amber-500" />}
                content={paper.reproduction_guide.risks_and_notes}
                defaultOpen
              />
            </div>
          )}

          {activeTab === "reproduction" && !paper.reproduction_guide && (
            <div className="text-center py-12 text-gray-400">
              <FlaskConical className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p>还没有生成复现指导</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
