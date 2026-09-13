import type { WorkbenchLinkAction, WorkbenchOverviewSource } from "../shared";
import { buildCheckpointAgendaItem } from "../checkpointOverview";
import { interestFolderName } from "../../../lib/interestUtils";

export interface HomeRecord {
  id: string;
  kind: "paper" | "note" | "chat";
  title: string;
  context: string;
  updatedAt: string;
  action: WorkbenchLinkAction;
}

export interface HomeAttention {
  id: string;
  title: string;
  detail: string;
  action: WorkbenchLinkAction;
}

export interface HomeModel {
  recent: HomeRecord[];
  attention: HomeAttention[];
  checkpoint: ReturnType<typeof buildCheckpointAgendaItem>;
}

export const EMPTY_HOME: HomeModel = { recent: [], attention: [], checkpoint: null };

export const SUGGESTION_FADE_MS = 240;
export const SUGGESTION_HOLD_MS = 6500;
export const HOME_SUGGESTIONS = [
  "帮我把一个模糊的选题，变成可以验证的研究问题",
  "读论文时，怎样判断一个方法是否值得复现？",
  "帮我检查实验设计：还缺哪些有说服力的对照？",
  "一起梳理综述提纲，把文献之间的联系讲清楚",
  "这段学术表达不够清楚，帮我理顺逻辑再润色",
  "研究遇到瓶颈了，帮我拆出一个今天能完成的小步骤",
];

function timestamp(value: string): number {
  return Date.parse(value) || 0;
}

export function homeDate(value: string): string {
  if (!timestamp(value)) return "";
  return new Date(value).toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}

export function buildHomeModel(source: WorkbenchOverviewSource, now = Date.now()): HomeModel {
  const interestNames = new Map(source.interests.map((interest) => [interest.id, interestFolderName(interest)]));
  const context = (id?: string) => id ? interestNames.get(id) ?? "" : "";
  const recent: HomeRecord[] = [
    ...source.sessions.map((session): HomeRecord => ({
      id: `chat:${session.id}`, kind: "chat", title: session.title || "未命名对话",
      context: session.context_type === "interest" ? context(session.context_id) : "",
      updatedAt: session.updated_at || session.created_at,
      action: { label: "继续对话", to: "/chat", state: { assistantConversationId: session.id } },
    })),
    ...source.notes.map((note): HomeRecord => ({
      id: `note:${note.id}`, kind: "note", title: note.title || "无标题笔记",
      context: context(note.research_interest_id), updatedAt: note.updated_at || note.created_at,
      action: { label: "打开笔记", to: `/notes/${encodeURIComponent(note.id)}` },
    })),
    ...source.papers.filter((paper) => !["failed", "error", "parsing", "analyzing"].includes(paper.status)).map((paper): HomeRecord => ({
      id: `paper:${paper.id}`, kind: "paper", title: paper.title || "未命名论文",
      context: context(paper.research_interest_id), updatedAt: paper.updated_at || paper.created_at,
      action: { label: "打开论文", to: `/papers?paper=${encodeURIComponent(paper.id)}` },
    })),
  ].sort((a, b) => timestamp(b.updatedAt) - timestamp(a.updatedAt)).slice(0, 6);

  const attention: HomeAttention[] = [];
  if (source.submission.pendingReviews > 0) attention.push({
    id: "reviews", title: `${source.submission.pendingReviews} 条审稿意见待回复`, detail: "查看意见与回复进度",
    action: { label: "查看投稿", to: "/submission" },
  });
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  source.submission.upcomingDdls
    .filter((ddl) => timestamp(ddl.deadline) >= today.getTime() && timestamp(ddl.deadline) <= now + 7 * 86400000)
    .sort((a, b) => timestamp(a.deadline) - timestamp(b.deadline))
    .slice(0, 2).forEach((ddl) => attention.push({
      id: `deadline:${ddl.name}:${ddl.deadline}`, title: ddl.name, detail: `${homeDate(ddl.deadline)} 截止`,
      action: { label: "查看截止安排", to: "/submission" },
    }));
  const failed = source.papers.filter((paper) => ["failed", "error"].includes(paper.status));
  if (failed.length) attention.push({
    id: "failed-papers", title: `${failed.length} 篇论文处理失败`, detail: "打开论文查看原因并重试",
    action: { label: "查看论文", to: `/papers?paper=${encodeURIComponent(failed[0].id)}` },
  });
  return { recent, attention, checkpoint: buildCheckpointAgendaItem(source.checkpoints) };
}
