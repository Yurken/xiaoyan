import Link from "next/link";
import { Map, BookOpen, FileText, Library, MessageSquare, ArrowRight, Sparkles } from "lucide-react";
import { Card } from "@research-copilot/ui";

const features = [
  {
    href: "/planner",
    icon: Map,
    title: "研究方向规划",
    description: "输入研究方向，AI 生成完整的学习路径、先修知识和经典论文推荐",
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  {
    href: "/survey",
    icon: BookOpen,
    title: "文献调研与综述",
    description: "输入关键词，自动检索论文并生成结构化的文献综述报告",
    color: "text-emerald-600",
    bg: "bg-emerald-50",
  },
  {
    href: "/papers",
    icon: FileText,
    title: "论文精读 & 复现",
    description: "上传 PDF，AI 提取研究问题、方法、创新点，并生成复现指导",
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
    title: "对话式 Copilot",
    description: "围绕论文、知识库和研究方向进行多轮问答，随时获取 AI 辅助",
    color: "text-rose-600",
    bg: "bg-rose-50",
  },
];

export default function HomePage() {
  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Hero */}
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 bg-brand-50 text-brand-700 text-sm font-medium px-3 py-1.5 rounded-full mb-4">
          <Sparkles className="w-4 h-4" />
          AI 科研全流程助手
        </div>
        <h1 className="text-4xl font-bold text-gray-900 mb-3">
          智研 Copilot
        </h1>
        <p className="text-lg text-gray-500 max-w-2xl">
          专为高校学生和科研新手设计的 AI 助手，帮助你高效完成从方向规划、文献调研、论文精读到实验复现的全流程科研工作。
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
                开始使用 <ArrowRight className="w-3 h-3" />
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
            { step: "1", text: "在「方向规划」中输入你的研究方向，获取系统化的学习路径" },
            { step: "2", text: "在「文献调研」中搜索关键词，生成结构化综述，快速了解领域现状" },
            { step: "3", text: "上传你感兴趣的 PDF 论文，获取 AI 精读分析和复现指导" },
            { step: "4", text: "所有内容自动归档到「知识库」，支持语义搜索和问答" },
            { step: "5", text: "随时打开「Copilot」进行多轮对话，围绕你的研究深度探讨" },
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
