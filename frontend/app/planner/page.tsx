"use client";

import { useState } from "react";
import { Map, Sparkles, BookOpen, Target, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { plannerApi } from "@/lib/api";
import type { LearningPath } from "@/lib/types";

export default function PlannerPage() {
  const [topic, setTopic] = useState("");
  const [keywords, setKeywords] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LearningPath | null>(null);
  const [error, setError] = useState("");
  const [expandedStage, setExpandedStage] = useState<number | null>(0);

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const kwList = keywords.split(/[,，\s]+/).filter(Boolean);
      const res = await plannerApi.generate(topic, kwList) as { data: LearningPath };
      setResult(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
          <Map className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">研究方向规划</h1>
          <p className="text-sm text-gray-500">输入你的研究方向，AI 为你生成系统化学习路径</p>
        </div>
      </div>

      <Card className="mb-6">
        <div className="space-y-4">
          <Input
            label="研究方向"
            placeholder="例如：大语言模型的对齐技术、联邦学习隐私保护..."
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
          />
          <Input
            label="关键词（可选，用逗号分隔）"
            placeholder="例如：RLHF, PPO, reward model"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
          />
          <Button onClick={handleGenerate} loading={loading} size="lg" className="w-full">
            <Sparkles className="w-4 h-4" />
            {loading ? "AI 生成中..." : "生成学习路径"}
          </Button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </Card>

      {result && (
        <div className="space-y-5">
          {/* Overview */}
          {result.overview && (
            <Card>
              <CardHeader>
                <CardTitle>领域概述</CardTitle>
              </CardHeader>
              <p className="text-gray-700 leading-relaxed">{result.overview}</p>
            </Card>
          )}

          {/* Prerequisites */}
          {result.prerequisites && result.prerequisites.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>先修知识</CardTitle>
              </CardHeader>
              <div className="space-y-3">
                {result.prerequisites.map((p, i) => (
                  <div key={i} className="p-3 bg-gray-50 rounded-lg">
                    <div className="font-medium text-gray-900 text-sm">{p.name}</div>
                    <div className="text-gray-600 text-sm mt-1">{p.description}</div>
                    {p.resources?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {p.resources.map((r, j) => (
                          <span key={j} className="text-xs bg-white border border-gray-200 px-2 py-0.5 rounded text-gray-600">{r}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Learning Stages */}
          {result.learning_stages && result.learning_stages.length > 0 && (
            <Card padding="none">
              <div className="p-6 pb-2">
                <CardTitle>学习路径</CardTitle>
              </div>
              <div className="divide-y divide-gray-100">
                {result.learning_stages.map((stage, i) => (
                  <div key={i} className="px-6 py-4">
                    <button
                      onClick={() => setExpandedStage(expandedStage === i ? null : i)}
                      className="w-full flex items-center justify-between text-left"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-7 h-7 rounded-full bg-brand-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                          {stage.stage}
                        </span>
                        <div>
                          <div className="font-semibold text-gray-900">{stage.title}</div>
                          <div className="text-xs text-gray-500">{stage.duration}</div>
                        </div>
                      </div>
                      {expandedStage === i ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </button>
                    {expandedStage === i && (
                      <div className="mt-4 ml-10 space-y-3">
                        <div>
                          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">学习目标</div>
                          <ul className="space-y-1">
                            {stage.goals?.map((g, j) => (
                              <li key={j} className="text-sm text-gray-700 flex items-start gap-1.5">
                                <span className="text-brand-500 mt-0.5">•</span>{g}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">涵盖主题</div>
                          <div className="flex flex-wrap gap-1.5">
                            {stage.topics?.map((t, j) => (
                              <span key={j} className="text-xs bg-brand-50 text-brand-700 px-2 py-0.5 rounded">{t}</span>
                            ))}
                          </div>
                        </div>
                        {stage.resources?.length > 0 && (
                          <div>
                            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">推荐资源</div>
                            <ul className="space-y-1">
                              {stage.resources.map((r, j) => (
                                <li key={j} className="text-sm text-gray-600 flex items-start gap-1.5">
                                  <BookOpen className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />{r}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Classic Papers */}
          {result.classic_papers && result.classic_papers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>经典必读论文</CardTitle>
              </CardHeader>
              <div className="space-y-3">
                {result.classic_papers.map((p, i) => (
                  <div key={i} className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                    <span className="text-xl font-bold text-gray-200 leading-none">{String(i + 1).padStart(2, "0")}</span>
                    <div>
                      <div className="font-medium text-gray-900 text-sm">{p.title}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{p.authors} · {p.year}</div>
                      <div className="text-xs text-gray-600 mt-1">{p.reason}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Research Directions */}
          {result.research_directions && result.research_directions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>进一步探索方向</CardTitle>
              </CardHeader>
              <div className="grid sm:grid-cols-2 gap-3">
                {result.research_directions.map((d, i) => (
                  <div key={i} className="p-3 border border-gray-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <Target className="w-3.5 h-3.5 text-brand-500" />
                      <span className="font-medium text-sm text-gray-900">{d.direction}</span>
                    </div>
                    <p className="text-xs text-gray-600 mb-2">{d.description}</p>
                    {d.open_problems?.length > 0 && (
                      <ul className="space-y-0.5">
                        {d.open_problems.slice(0, 3).map((p, j) => (
                          <li key={j} className="text-xs text-gray-500 flex items-start gap-1"><span>→</span>{p}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Tools */}
          {result.tools_and_frameworks && result.tools_and_frameworks.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>常用工具 & 框架</CardTitle>
              </CardHeader>
              <div className="flex flex-wrap gap-2">
                {result.tools_and_frameworks.map((t, i) => (
                  <span key={i} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">{t}</span>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
