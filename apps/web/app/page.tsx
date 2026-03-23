import Link from "next/link";
import { Map, BookOpen, FileText, Library, MessageSquare, ArrowRight, Sparkles, SlidersHorizontal } from "lucide-react";
import { Card } from "@research-copilot/ui";
import {
  MAIN_ASSISTANT_BADGE,
  MAIN_ASSISTANT_NAME,
  MAIN_ASSISTANT_WORKSPACE_NAME,
  PRODUCT_NAME,
} from "@research-copilot/types";

const features = [
  {
    href: "/planner",
    icon: Map,
    title: "研究方向规划",
    description: "请输入研究方向，系统将生成完整学习路径、先修知识与经典论文推荐",
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  {
    href: "/survey",
    icon: BookOpen,
    title: "文献调研与综述",
    description: "请输入研究关键词，系统将自动检索论文并生成结构化综述报告",
    color: "text-emerald-600",
    bg: "bg-emerald-50",
  },
  {
    href: "/papers",
    icon: FileText,
    title: "论文精读 & 复现",
    description: "上传 PDF 后，系统将提取研究问题、方法与创新点，并生成复现指导",
    color: "text-violet-600",
    bg: "bg-violet-50",
  },
  {
    href: "/knowledge",
    icon: Library,
    title: "个人知识库",
    description: "自动归档所有分析结果，支持语义搜索和知识问答",
    color: "text-amber-600",
    bg: "bg-amber-50",
  },
  {
    href: "/copilot",
    icon: MessageSquare,
    title: MAIN_ASSISTANT_WORKSPACE_NAME,
    description: `由${MAIN_ASSISTANT_NAME}自动拆解任务，将检索、综述、论文解析与复现建议串联为可观测执行链路`,
    color: "text-rose-600",
    bg: "bg-rose-50",
  },
  {
    href: "/settings",
    icon: SlidersHorizontal,
    title: "设置中心",
    description: "统一管理模型、RAG 参数和多 Agent 编排策略，避免配置散落在不同入口",
    color: "text-slate-700",
    bg: "bg-slate-100",
  },
];

export default function HomePage() {
  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Hero */}
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 bg-brand-50 text-brand-700 text-sm font-medium px-3 py-1.5 rounded-full mb-4">
          <Sparkles className="w-4 h-4" />
          {MAIN_ASSISTANT_BADGE}
        </div>
        <h1 className="text-4xl font-bold text-gray-900 mb-3">
          {PRODUCT_NAME}
        </h1>
        <p className="text-lg text-gray-500 max-w-2xl">
          主 AI {MAIN_ASSISTANT_NAME} 现已接入多 Agent 协同，把方向规划、文献调研、论文精读、实验复现和最终回答串成一条可追踪的科研工作流。
        </p>
      </div>

      {/* Quick start */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
        {features.map(({ href, icon: Icon, title, description, color, bg }) => (
          <Link key={href} href={href} className="group">
            <Card className="h-full hover:border-brand-200 hover:shadow-md transition-all duration-200 cursor-pointer">
              <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center mb-3`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1.5 group-hover:text-brand-600 transition-colors">
                {title}
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed mb-3">{description}</p>
              <div className="flex items-center gap-1 text-xs font-medium text-brand-600 opacity-0 group-hover:opacity-100 transition-opacity">
                进入功能 <ArrowRight className="w-3 h-3" />
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {/* Workflow */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">推荐使用流程</h2>
        <ol className="space-y-3">
          {[
            { step: "1", text: "在「方向规划」中输入研究方向，获取系统化学习路径" },
            { step: "2", text: "在「文献调研」中输入研究关键词，生成结构化综述并快速了解领域现状" },
            { step: "3", text: "上传 PDF 论文，获取论文精读分析与复现指导" },
            { step: "4", text: "所有内容自动归档到「知识库」，支持语义搜索和问答" },
            { step: "5", text: `随时打开「${MAIN_ASSISTANT_NAME}」查看调度计划、Agent 时间线与结构化产物` },
          ].map(({ step, text }) => (
            <li key={step} className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-600 text-white text-xs font-bold flex items-center justify-center">
                {step}
              </span>
              <span className="text-sm text-gray-600 pt-0.5">{text}</span>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
