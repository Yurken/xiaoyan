import { ArrowRight, BookOpen, FileText, MessageSquare, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@research-copilot/ui";
import HomeComposer from "./HomeComposer";
import { homeDate, type HomeModel, type HomeRecord } from "./shared";
import "./home.css";

const RECORD_ICONS = { paper: BookOpen, note: FileText, chat: MessageSquare };
const RECORD_LABELS = { paper: "论文", note: "笔记", chat: "对话" };

function RecentRecord({ record }: { record: HomeRecord }) {
  const Icon = RECORD_ICONS[record.kind];
  return (
    <Link className="home-record" to={record.action.to} state={record.action.state} title={record.title}>
      <Icon className="h-4 w-4 shrink-0 text-ink-tertiary" aria-hidden="true" />
      <p className="min-w-0 flex-1 truncate text-sm text-ink-primary">{record.title}</p>
      <span className="home-record-kind text-xs text-ink-tertiary">{RECORD_LABELS[record.kind]}</span>
      <time dateTime={record.updatedAt} className="shrink-0 text-xs tabular-nums text-ink-tertiary">{homeDate(record.updatedAt)}</time>
      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-ink-tertiary" aria-hidden="true" />
    </Link>
  );
}

export default function HomeWorkspace({ model, loading, error, refresh }: {
  model: HomeModel;
  loading: boolean;
  error: string;
  refresh: () => void;
}) {
  const checkpoint = model.checkpoint;
  const concreteNextStep = checkpoint && !/^按需继续追问/.test(checkpoint.description);
  return (
    <div className="home-workspace h-full overflow-y-auto">
      <div className="home-content">
        <HomeComposer />
        <section className="home-history" aria-labelledby="home-recent-title">
          <header className="home-section-header">
            <h2 id="home-recent-title" className="text-sm font-medium text-ink-secondary">接着上次的工作</h2>
            <Button variant="ghost" size="sm" disabled={loading} onClick={refresh} aria-label="刷新首页">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin motion-reduce:animate-none" : ""}`} aria-hidden="true" />
            </Button>
          </header>
          {error ? <p role="status" className="py-3 text-xs leading-5 text-ink-secondary">{error}</p> : null}
          {model.recent.length ? model.recent.slice(0, 4).map((record) => <RecentRecord key={record.id} record={record} />) : (
            <p className="py-4 text-sm leading-6 text-ink-tertiary">
              {loading ? "正在读取近期工作…" : error ? "稍后刷新即可重试。你也可以先开始对话。" : "你的对话、论文和笔记会留在这里，随时接着做。"}
            </p>
          )}
          {concreteNextStep ? (
            <Link className="home-checkpoint" to={checkpoint.action.to} state={checkpoint.action.state}>
              <span className="shrink-0 text-xs text-ink-tertiary">上次的下一步</span>
              <span className="min-w-0 flex-1 truncate text-xs text-ink-secondary">{checkpoint.description}</span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-ink-tertiary" aria-hidden="true" />
            </Link>
          ) : null}
        </section>
        {model.attention.length > 0 ? (
          <section className="home-attention" aria-label="待处理提醒">
            <span className="text-xs font-medium text-ink-secondary">待处理</span>
            <div className="flex min-w-0 flex-1 flex-wrap gap-x-6 gap-y-3">
              {model.attention.map((item) => (
                <Link key={item.id} to={item.action.to} state={item.action.state} className="home-attention-link">
                  <span>{item.title}</span><span className="text-ink-tertiary">{item.detail.includes("截止") ? item.detail : ""}</span>
                  <ArrowRight className="h-3 w-3 shrink-0" aria-hidden="true" />
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
