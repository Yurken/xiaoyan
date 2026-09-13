import { ArrowRight, BookOpen, Check, Compass, FileText, MessageSquare, PenLine, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { Button, Card } from "@research-copilot/ui";
import { HOME_ACTIONS, homeDate, type HomeModel, type HomeRecord } from "./shared";
import "./home.css";

const RECORD_ICONS = { paper: BookOpen, note: FileText, chat: MessageSquare };
const RECORD_LABELS = { paper: "论文", note: "笔记", chat: "对话" };
const ACTION_ICONS = { paper: BookOpen, chat: MessageSquare, writing: PenLine, plan: Compass };

function RecentRecord({ record }: { record: HomeRecord }) {
  const Icon = RECORD_ICONS[record.kind];
  return (
    <Link className="home-record" to={record.action.to} state={record.action.state}>
      <Icon className="h-4 w-4 shrink-0 text-ink-tertiary" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink-primary">{record.title}</p>
        <p className="mt-1 truncate text-xs text-ink-tertiary">{RECORD_LABELS[record.kind]}{record.context ? ` · ${record.context}` : ""}</p>
      </div>
      <time dateTime={record.updatedAt} className="shrink-0 text-xs tabular-nums text-ink-tertiary">{homeDate(record.updatedAt)}</time>
      <ArrowRight className="h-4 w-4 shrink-0 text-ink-tertiary" aria-hidden="true" />
    </Link>
  );
}

export default function HomeWorkspace({ model, loading, error, refresh }: {
  model: HomeModel;
  loading: boolean;
  error: string;
  refresh: () => void;
}) {
  const latest = model.recent[0];
  const otherRecords = model.recent.slice(1);
  return (
    <div className="home-workspace h-full overflow-y-auto">
      <div className="home-content">
        <header className="home-header">
          <div>
            <p className="mb-3 text-xs font-medium tracking-wide text-ink-tertiary">小妍 · 研究工作台</p>
            <h1 className="text-[clamp(1.6rem,3vw,2.25rem)] font-semibold tracking-tight text-ink-primary">今天，从这里继续。</h1>
            <p className="mt-3 text-sm leading-6 text-ink-secondary">接上最近的工作，或和小妍一起开始一个新问题。</p>
          </div>
          <Button className="shrink-0 whitespace-nowrap" variant="ghost" size="sm" disabled={loading} onClick={refresh} aria-label="刷新首页">
            <RefreshCw className={`h-3.5 w-3.5 shrink-0 ${loading ? "animate-spin motion-reduce:animate-none" : ""}`} aria-hidden="true" />
            <span className="hidden sm:inline">刷新</span>
          </Button>
        </header>

        {error ? <p role="status" className="mb-5 text-sm text-ink-secondary">{error}</p> : null}

        <div className="home-start-grid">
          <Card padding="none" className="home-resume">
            <p className="flex items-center gap-2 text-xs font-medium text-ink-secondary">
              <span className="h-1.5 w-1.5 rounded-full bg-apple-blue" aria-hidden="true" />
              {latest ? "最近更新" : "从一个问题开始"}
            </p>
            {loading && !latest ? (
              <div className="flex flex-1 items-center py-10" role="status"><p className="text-sm text-ink-tertiary">正在读取近期工作…</p></div>
            ) : latest ? (
              <>
                <div className="my-auto py-7">
                  <p className="mb-3 text-xs text-ink-tertiary">{RECORD_LABELS[latest.kind]} · {homeDate(latest.updatedAt)}</p>
                  <h2 className="line-clamp-3 break-words text-[clamp(1.2rem,2vw,1.65rem)] font-semibold leading-snug tracking-tight text-ink-primary">{latest.title}</h2>
                  {latest.context ? <p className="mt-3 truncate text-sm text-ink-secondary">{latest.context}</p> : null}
                </div>
                <Link className="home-primary-link" to={latest.action.to} state={latest.action.state}>
                  {latest.action.label}<ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </>
            ) : (
              <>
                <div className="my-auto py-8">
                  <h2 className="text-2xl font-semibold leading-snug text-ink-primary">还没想清楚，也可以开始。</h2>
                  <p className="mt-3 max-w-md text-sm leading-7 text-ink-secondary">把一个想法、一段困惑或想读的论文带给小妍，一起找到下一步。</p>
                </div>
                <Link className="home-primary-link" to="/chat">和小妍讨论<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
              </>
            )}
          </Card>

          <section aria-labelledby="home-start-title" className="home-actions">
            <h2 id="home-start-title" className="mb-2 text-sm font-semibold text-ink-primary">开始工作</h2>
            {HOME_ACTIONS.map((action) => {
              const Icon = ACTION_ICONS[action.kind];
              return (
                <Link key={action.to} to={action.to} className="home-action">
                  <Icon className="h-5 w-5 shrink-0 text-ink-secondary" strokeWidth={1.6} aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink-primary">{action.title}</p>
                    <p className="mt-1 text-xs text-ink-tertiary">{action.description}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-ink-tertiary" aria-hidden="true" />
                </Link>
              );
            })}
          </section>
        </div>

        {model.checkpoint ? (
          <Link className="home-next-step" to={model.checkpoint.action.to} state={model.checkpoint.action.state}>
            <div className="min-w-0 flex-1">
              <p className="mb-1 text-xs font-medium text-ink-tertiary">上次留下的下一步</p>
              <p className="line-clamp-2 text-sm leading-6 text-ink-primary">{model.checkpoint.description}</p>
            </div>
            <span className="flex shrink-0 items-center gap-2 text-xs font-medium text-apple-blue">继续讨论<ArrowRight className="h-4 w-4" aria-hidden="true" /></span>
          </Link>
        ) : null}

        <div className="home-lower-grid">
          <section aria-labelledby="home-recent-title">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 id="home-recent-title" className="text-sm font-semibold text-ink-primary">近期记录</h2>
              <span className="text-xs text-ink-tertiary">按更新时间</span>
            </div>
            {otherRecords.length ? otherRecords.map((record) => <RecentRecord key={record.id} record={record} />) : (
              <p className="py-6 text-sm leading-6 text-ink-tertiary">{loading ? "正在读取记录…" : error ? "读取后会在这里显示近期论文、笔记和对话。" : latest ? "其他论文、笔记和对话会在这里出现。" : "开始阅读或对话后，下次可以从这里接着做。"}</p>
            )}
          </section>

          <section aria-labelledby="home-attention-title" className="home-attention">
            <h2 id="home-attention-title" className="mb-3 text-sm font-semibold text-ink-primary">需要留意</h2>
            {model.attention.length ? model.attention.map((item) => (
              <Link key={item.id} to={item.action.to} state={item.action.state} className="home-attention-row">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-6 text-ink-primary">{item.title}</p>
                  <p className="mt-1 text-xs leading-5 text-ink-secondary">{item.detail}</p>
                </div>
                <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-ink-tertiary" aria-hidden="true" />
              </Link>
            )) : (
              <div className="flex items-start gap-2 py-4 text-sm leading-6 text-ink-tertiary">
                {!loading && !error ? <Check className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" /> : null}
                <p>{loading ? "正在检查待处理事项…" : error ? "部分事项未能读取，请稍后刷新。" : "暂无待处理提醒。"}</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
