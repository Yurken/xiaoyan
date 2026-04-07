import Link from "next/link";
import { Map, BookOpen, FileText, Library, MessageSquare, ArrowRight, SlidersHorizontal } from "lucide-react";
import { Button, Card } from "@research-copilot/ui";
import {
  MAIN_ASSISTANT_NAME,
  MAIN_ASSISTANT_WORKSPACE_NAME,
  PRODUCT_NAME,
} from "@research-copilot/types";

const features = [
  {
    href: "/planner",
    icon: Map,
    title: "研究方向规划",
    description: `请输入研究方向，小妍会为你生成完整学习路径、先修知识与经典论文推荐`,
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  {
    href: "/survey",
    icon: BookOpen,
    title: "文献调研与综述",
    description: `请输入研究关键词，小妍会自动检索论文并生成结构化综述报告`,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
  },
  {
    href: "/papers",
    icon: FileText,
    title: "论文精读 & 复现",
    description: `上传 PDF 后，小妍会提取研究问题、方法与创新点，并生成复现指导`,
    color: "text-violet-600",
    bg: "bg-violet-50",
  },
  {
    href: "/knowledge",
    icon: Library,
    title: "个人知识库",
    description: `小妍会自动归档所有分析结果，支持语义搜索和知识问答`,
    color: "text-amber-600",
    bg: "bg-amber-50",
  },
  {
    href: "/copilot",
    icon: MessageSquare,
    title: MAIN_ASSISTANT_WORKSPACE_NAME,
    description: `${MAIN_ASSISTANT_NAME}会先拆解你的目标，再联动检索、综述、论文解析与复现建议形成可观测链路`,
    color: "text-rose-600",
    bg: "bg-rose-50",
  },
  {
    href: "/settings",
    icon: SlidersHorizontal,
    title: "设置中心",
    description: `在这里配置${MAIN_ASSISTANT_NAME}的能力模块、RAG 参数和多能力域模型编排策略，避免配置散落在不同入口`,
    color: "text-slate-700",
    bg: "bg-slate-100",
  },
];

export default function HomePage() {
  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <Card padding="lg" className="overflow-hidden">
        <div className="space-y-6">
          <div className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--rc-text-muted)" }}>
              Research Copilot Desk
            </p>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.05em]" style={{ color: "var(--rc-text)" }}>
              {PRODUCT_NAME}
            </h1>
            <p className="max-w-2xl text-sm leading-7" style={{ color: "var(--rc-text-soft)" }}>
              {MAIN_ASSISTANT_NAME}会把研究目标拆成可执行的规划、检索、精读与沉淀步骤，让每次推进都能留在同一张工作台里。
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/planner">
              <Button>
                开始研究规划
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/copilot">
              <Button variant="secondary">进入{MAIN_ASSISTANT_WORKSPACE_NAME}</Button>
            </Link>
          </div>
        </div>
      </Card>

      <div className="mt-6 grid gap-4">
        {features.map(({ href, icon: Icon, title, description, color, bg }) => (
          <Link key={href} href={href} className="group">
            <Card className="cursor-pointer transition-transform duration-150 group-hover:-translate-y-px">
              <div className="flex items-start gap-4">
                <div
                  className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl ${bg}`}
                  style={{ border: "1px solid var(--rc-card-inset-outline)" }}
                >
                  <Icon className={`h-4.5 w-4.5 ${color}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold" style={{ color: "var(--rc-text)" }}>
                        {title}
                      </h3>
                      <p className="mt-1.5 text-sm leading-6" style={{ color: "var(--rc-text-soft)" }}>
                        {description}
                      </p>
                    </div>
                    <ArrowRight className="mt-0.5 h-4 w-4 flex-shrink-0" style={{ color: "var(--rc-text-muted)" }} />
                  </div>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="mt-6">
        <h2 className="mb-4 text-lg font-semibold" style={{ color: "var(--rc-text)" }}>
          推荐使用流程
        </h2>
        <ol className="space-y-3">
          {[
            { step: "1", text: "在「方向规划」中输入研究方向，获取系统化学习路径" },
            { step: "2", text: "在「文献调研」中输入研究关键词，生成结构化综述并快速了解领域现状" },
            { step: "3", text: "上传 PDF 论文，获取论文精读分析与复现指导" },
            { step: "4", text: `所有内容会自动归档到「知识库」，支持语义搜索和问答` },
            { step: "5", text: `随时打开「${MAIN_ASSISTANT_WORKSPACE_NAME}」查看任务计划、能力域模型时间线与结构化产物` },
          ].map(({ step, text }) => (
            <li key={step} className="flex items-start gap-3">
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: "var(--rc-accent)" }}>
                {step}
              </span>
              <span className="pt-0.5 text-sm" style={{ color: "var(--rc-text-soft)" }}>
                {text}
              </span>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
