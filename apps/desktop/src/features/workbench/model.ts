import type { KnowledgeNote, Paper, ResearchInterest } from "@research-copilot/types";
import {
  buildCheckpointAgendaItem,
  buildCheckpointHandoffItem,
  summarizeInterestCheckpoints,
} from "./checkpointOverview";
import { buildLayout } from "./layout";
import { paperAction, paperActionLabel, paperTitlePreview } from "./shared";
import type {
  WorkbenchAgendaItem,
  WorkbenchAssetItem,
  WorkbenchHandoffItem,
  WorkbenchLinkAction,
  WorkbenchOverviewModel,
  WorkbenchOverviewSource,
  WorkbenchRiskItem,
  WorkbenchTone,
} from "./shared";

interface InterestSnapshot {
  interest: ResearchInterest;
  title: string;
  notes: KnowledgeNote[];
  analyzedCount: number;
  recentAt: number;
  score: number;
  stage: string;
  stageTone: WorkbenchTone;
  summary: string;
  nextStep: string;
  action: WorkbenchLinkAction;
  stats: string[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

function toTimestamp(value?: string | null): number {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function formatDateTime(value?: string | null): string {
  const timestamp = toTimestamp(value);
  if (!timestamp) return "时间待确认";
  return new Date(timestamp).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatDate(value?: string | null): string {
  const timestamp = toTimestamp(value);
  if (!timestamp) return "时间待确认";
  return new Date(timestamp).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
  });
}

function interestTitle(interest: ResearchInterest): string {
  return interest.folder_name?.trim() || interest.topic;
}

function latestPaperByUpdate(papers: Paper[]): Paper | undefined {
  return [...papers].sort(
    (left, right) => toTimestamp(right.updated_at || right.created_at) - toTimestamp(left.updated_at || left.created_at),
  )[0];
}

function latestTimestamp(values: Array<string | null | undefined>): number {
  return values.reduce((max, value) => Math.max(max, toTimestamp(value)), 0);
}

function buildInterestSnapshots(source: WorkbenchOverviewSource): InterestSnapshot[] {
  const now = Date.now();

  return source.interests
    .map((interest) => {
      const papers = source.papers.filter((paper) => paper.research_interest_id === interest.id);
      const notes = source.notes.filter((note) => note.research_interest_id === interest.id);
      const sessions = source.sessions.filter((session) => session.context_type === "interest" && session.context_id === interest.id);
      const checkpointSummary = summarizeInterestCheckpoints(source.checkpoints, interest.id);
      const analyzedCount = papers.filter((paper) => Boolean(paper.analysis)).length;
      const latestPaper = latestPaperByUpdate(papers);
      const recentAt = latestTimestamp([
        interest.created_at,
        ...papers.map((paper) => paper.updated_at || paper.created_at),
        ...notes.map((note) => note.updated_at || note.created_at),
        ...sessions.map((session) => session.updated_at || session.created_at),
        checkpointSummary.latestUpdatedAt,
      ]);

      let stage = "等待规划";
      let stageTone: WorkbenchTone = "amber";
      let summary = "这个主题还没有形成稳定路线。";
      let nextStep = "先把研究目标、关键词和预期产出整理清楚。";
      let action: WorkbenchLinkAction = { label: "去规划", to: "/planner" };

      if (interest.status === "planning") {
        stage = "路线生成中";
        stageTone = "blue";
        summary = "小妍正在整理研究路线、核心问题和切入方向。";
        nextStep = "先等路线生成完成，再决定优先补哪篇论文。";
      } else if (interest.status === "planned" && papers.length === 0) {
        stage = "补核心论文";
        stageTone = "amber";
        summary = "路线已经成形，但还没有和这个主题关联的核心论文。";
        nextStep = "先导入 1 篇最能代表问题边界的论文。";
        action = { label: "导入论文", to: "/papers" };
      } else if (interest.status === "planned" && analyzedCount === 0) {
        stage = "论文精读";
        stageTone = "blue";
        summary = `已经关联 ${papers.length} 篇论文，下一步先完成首篇解读。`;
        nextStep = latestPaper
          ? `先让小妍解读《${paperTitlePreview(latestPaper)}》。`
          : "先让小妍把一篇核心论文解读清楚。";
        action = latestPaper
          ? paperAction(paperActionLabel("解读", latestPaper), latestPaper)
          : { label: "打开论文库", to: "/papers" };
      } else if (interest.status === "planned" && papers.length > 1 && analyzedCount < papers.length) {
        stage = "继续精读";
        stageTone = "blue";
        summary = `已经关联 ${papers.length} 篇论文，完成 ${analyzedCount} 篇解读，建议继续分析剩余论文。`;
        const latestUnanalyzedPaper = [...papers]
          .filter((paper) => !paper.analysis)
          .sort((left, right) => toTimestamp(right.updated_at || right.created_at) - toTimestamp(left.updated_at || left.created_at))[0];
        nextStep = latestUnanalyzedPaper
          ? `继续让小妍解读《${paperTitlePreview(latestUnanalyzedPaper)}》。`
          : "继续让小妍把下一篇核心论文解读清楚。";
        action = latestUnanalyzedPaper
          ? paperAction(paperActionLabel("解读", latestUnanalyzedPaper), latestUnanalyzedPaper)
          : { label: "打开论文库", to: "/papers" };
      } else if (interest.status === "planned" && notes.length === 0) {
        stage = "沉淀知识";
        stageTone = "green";
        summary = `已有 ${analyzedCount} 篇论文完成解读，但还没有对应的知识卡片。`;
        nextStep = "把关键结论和证据先沉淀成第一条知识卡片。";
        action = { label: "去知识", to: "/knowledge" };
      } else if (interest.status === "planned" && sessions.length === 0) {
        stage = "继续追问";
        stageTone = "green";
        summary = "这个主题已经有论文和知识沉淀，可以开始围绕问题继续追问。";
        nextStep = "带着现有材料继续和小妍讨论下一步。";
        action = { label: "问小妍", to: "/xiaoyan" };
      } else if (interest.status === "planned") {
        stage = "持续推进";
        stageTone = "blue";
        summary = `已有 ${papers.length} 篇论文、${notes.length} 条笔记和 ${sessions.length} 次对话沉淀。`;
        nextStep = "继续收敛问题、补证据，并安排下一步实验或写作。";
        action = { label: "打开总览", to: `/workbench/${interest.id}/overview` };
      }

      if (checkpointSummary.nextStep) {
        nextStep = checkpointSummary.nextStep;
        if (interest.status === "planned" && sessions.length > 0) {
          stage = checkpointSummary.hasOpenQuestions ? "问题待确认" : "接续追问";
          stageTone = checkpointSummary.hasFailed ? "rust" : checkpointSummary.hasOpenQuestions ? "amber" : "blue";
          summary = checkpointSummary.summary || summary;
          action = { label: "接着问", to: "/xiaoyan" };
        }
      }

      let score = interest.status === "planned" ? 6 : interest.status === "planning" ? 3 : 1;
      score += Math.min(papers.length, 3) * 2;
      score += Math.min(analyzedCount, 2) * 2;
      score += Math.min(notes.length, 3) * 2;
      score += Math.min(sessions.length, 3);
      if (recentAt && now - recentAt <= 3 * DAY_MS) score += 3;
      else if (recentAt && now - recentAt <= 7 * DAY_MS) score += 1;

      return {
        interest,
        title: interestTitle(interest),
        notes,
        analyzedCount,
        recentAt,
        score,
        stage,
        stageTone,
        summary,
        nextStep,
        action,
        stats: [
          `${papers.length} 篇论文`,
          `${notes.length} 条笔记`,
          `${sessions.length} 次对话`,
          ...(checkpointSummary.count > 0 ? [`${checkpointSummary.count} 个续接点`] : []),
        ],
      };
    })
    .sort((left, right) => right.score - left.score || right.recentAt - left.recentAt);
}

function buildAgenda(source: WorkbenchOverviewSource, snapshots: InterestSnapshot[]): WorkbenchAgendaItem[] {
  const items: WorkbenchAgendaItem[] = [];

  if (source.submission.pendingReviews > 0) {
    items.push({
      id: "submission-pending-reviews",
      label: "先处理时效任务",
      title: `${source.submission.pendingReviews} 条审稿意见待回复`,
      description: "这类任务最容易影响节奏，建议先在投稿页确认当前轮次和回复计划。",
      tone: "rust",
      action: { label: "去投稿", to: "/submission" },
    });
  }

  const nearestDdl = [...source.submission.upcomingDdls]
    .sort((left, right) => toTimestamp(left.deadline) - toTimestamp(right.deadline))[0];
  if (nearestDdl) {
    items.push({
      id: `submission-ddl-${nearestDdl.name}`,
      label: "最近截止",
      title: `确认 ${nearestDdl.name} 的截止安排`,
      description: `${formatDate(nearestDdl.deadline)} 有一个临近节点，建议提前把版本和材料整理好。`,
      tone: "amber",
      action: { label: "看截止", to: "/submission" },
    });
  }

  const checkpointAgenda = buildCheckpointAgendaItem(source.checkpoints);
  if (checkpointAgenda) {
    items.push(checkpointAgenda);
  }

  const topInterest = snapshots[0];
  if (topInterest) {
    items.push({
      id: `interest-next-${topInterest.interest.id}`,
      label: topInterest.stage,
      title: `继续推进「${topInterest.title}」`,
      description: topInterest.nextStep,
      tone: topInterest.stageTone,
      action: topInterest.action,
    });
  }

  const knowledgeGap = snapshots.find(
    (snapshot) => snapshot.interest.status === "planned" && snapshot.analyzedCount > 0 && snapshot.notes.length === 0
  );
  if (knowledgeGap && knowledgeGap.interest.id !== topInterest?.interest.id) {
    items.push({
      id: `knowledge-gap-${knowledgeGap.interest.id}`,
      label: "补知识沉淀",
      title: `给「${knowledgeGap.title}」补第一条知识卡片`,
      description: "有论文解读但没有知识沉淀时，后续追问和写作都会变散。",
      tone: "green",
      action: { label: "去知识", to: "/knowledge" },
    });
  }

  if (items.length === 0) {
    items.push({
      id: "empty-start",
      label: "先开始",
      title: "先建立第一个研究主题",
      description: "从研究问题、关键词和目标开始，小妍会先帮你把路线搭起来。",
      tone: "blue",
      action: { label: "开始规划", to: "/planner" },
    });
  }

  return items.slice(0, 3);
}

function buildHandoffs(source: WorkbenchOverviewSource): WorkbenchHandoffItem[] {
  const latestAnalyzedPaper = [...source.papers]
    .filter((paper) => Boolean(paper.analysis))
    .sort((left, right) => toTimestamp(right.updated_at || right.created_at) - toTimestamp(left.updated_at || left.created_at))[0];
  const latestNote = [...source.notes]
    .sort((left, right) => toTimestamp(right.updated_at || right.created_at) - toTimestamp(left.updated_at || left.created_at))[0];
  const latestSession = [...source.sessions]
    .sort((left, right) => toTimestamp(right.updated_at || right.created_at) - toTimestamp(left.updated_at || left.created_at))[0];

  const items: WorkbenchHandoffItem[] = [];

  const checkpointHandoff = buildCheckpointHandoffItem(source.checkpoints);
  if (checkpointHandoff) {
    items.push(checkpointHandoff);
  }

  if (latestAnalyzedPaper) {
    items.push({
      id: `handoff-paper-${latestAnalyzedPaper.id}`,
      label: "论文解读",
      title: `小妍刚整理完《${latestAnalyzedPaper.title}》`,
      description: `最近更新于 ${formatDateTime(latestAnalyzedPaper.updated_at || latestAnalyzedPaper.created_at)}，可以继续查看方法、结论和复现提示。`,
      tone: "blue",
      action: paperAction("打开这篇", latestAnalyzedPaper),
    });
  }

  if (latestNote) {
    items.push({
      id: `handoff-note-${latestNote.id}`,
      label: "知识沉淀",
      title: `最近沉淀了《${latestNote.title}》`,
      description: `${formatDateTime(latestNote.updated_at || latestNote.created_at)} 更新，可以继续补证据或整理结构。`,
      tone: "green",
      action: { label: "查看知识", to: "/knowledge" },
    });
  }

  if (latestSession) {
    items.push({
      id: `handoff-session-${latestSession.id}`,
      label: "继续对话",
      title: latestSession.title || "继续刚才那次对话",
      description: `${formatDateTime(latestSession.updated_at || latestSession.created_at)} 有过更新，适合直接接着追问。`,
      tone: "amber",
      action: { label: "打开小妍", to: "/xiaoyan" },
    });
  }

  if (items.length === 0) {
    items.push({
      id: "handoff-empty",
      label: "还没有交接",
      title: "先把第一个研究问题交给小妍",
      description: "导入论文、创建主题或开始一段对话后，工作台会逐步把结果交回这里。",
      tone: "blue",
      action: { label: "开始规划", to: "/planner" },
    });
  }

  return items.slice(0, 3);
}

function buildRisks(source: WorkbenchOverviewSource): WorkbenchRiskItem[] {
  const failedPapers = source.papers.filter((paper) => paper.status === "failed" || paper.status === "error");
  const processingPapers = source.papers.filter((paper) => paper.status === "parsing" || paper.status === "analyzing");
  const planningInterests = source.interests.filter((interest) => interest.status === "planning");
  const items: WorkbenchRiskItem[] = [];

  if (source.submission.pendingReviews > 0) {
    items.push({
      id: "risk-pending-reviews",
      label: "待回复",
      title: `${source.submission.pendingReviews} 条审稿意见待处理`,
      description: "如果不尽早整理回复逻辑，后面的补实验和改稿会一起堆起来。",
      tone: "rust",
      action: { label: "去投稿", to: "/submission" },
    });
  }

  source.submission.upcomingDdls
    .slice()
    .sort((left, right) => toTimestamp(left.deadline) - toTimestamp(right.deadline))
    .slice(0, 2)
    .forEach((item, index) => {
      items.push({
        id: `risk-ddl-${index}-${item.name}`,
        label: "临近截止",
        title: `${item.name} 即将到期`,
        description: `${formatDate(item.deadline)} 前建议确认版本、材料和回复节奏。`,
        tone: "amber",
        action: { label: "查看截止", to: "/submission" },
      });
    });

  if (failedPapers.length > 0) {
    const firstFailedPaper = latestPaperByUpdate(failedPapers);
    items.push({
      id: "risk-failed-papers",
      label: "处理中断",
      title: `${failedPapers.length} 篇论文处理失败`,
      description: firstFailedPaper
        ? `先检查《${paperTitlePreview(firstFailedPaper)}》，避免后续知识沉淀和追问中断。`
        : "解析或解读失败会直接中断后面的知识沉淀和追问，建议尽快处理。",
      tone: "rust",
      action: firstFailedPaper
        ? paperAction(paperActionLabel("处理", firstFailedPaper), firstFailedPaper)
        : { label: "打开论文库", to: "/papers" },
    });
  }

  if (processingPapers.length > 0) {
    const firstProcessingPaper = latestPaperByUpdate(processingPapers);
    items.push({
      id: "risk-processing-papers",
      label: "正在处理中",
      title: `${processingPapers.length} 篇论文仍在处理中`,
      description: firstProcessingPaper
        ? `《${paperTitlePreview(firstProcessingPaper)}》还在处理中，可以先查看其他已完成材料。`
        : "可以先去看其他已完成的材料，等处理结束后再继续补知识或追问。",
      tone: "blue",
      action: firstProcessingPaper
        ? paperAction(paperActionLabel("查看", firstProcessingPaper), firstProcessingPaper)
        : { label: "打开论文库", to: "/papers" },
    });
  }

  if (planningInterests.length > 0) {
    items.push({
      id: "risk-planning-interests",
      label: "路线待完成",
      title: `${planningInterests.length} 个主题仍在生成路线`,
      description: "路线没成形之前，很容易过早导入不相关论文或把问题边界拉得太散。",
      tone: "amber",
      action: { label: "去规划", to: "/planner" },
    });
  }

  if (items.length === 0) {
    items.push({
      id: "risk-empty",
      label: "当前平稳",
      title: "暂时没有明显阻塞",
      description: "可以优先跟着今日推进继续往前做，不用先回头处理异常。",
      tone: "green",
      action: { label: "看今日推进", to: "/" },
    });
  }

  return items.slice(0, 4);
}

function buildAssets(source: WorkbenchOverviewSource, snapshots: InterestSnapshot[]): WorkbenchAssetItem[] {
  const latestInterest = snapshots[0];
  const latestNote = [...source.notes]
    .sort((left, right) => toTimestamp(right.updated_at || right.created_at) - toTimestamp(left.updated_at || left.created_at))[0];
  const latestPaper = latestPaperByUpdate(source.papers);

  const items: WorkbenchAssetItem[] = [];

  if (latestInterest) {
    items.push({
      id: `asset-interest-${latestInterest.interest.id}`,
      label: "在研主题",
      title: latestInterest.title,
      description: latestInterest.summary,
      action: latestInterest.action,
    });
  }

  if (latestNote) {
    items.push({
      id: `asset-note-${latestNote.id}`,
      label: "知识卡片",
      title: latestNote.title,
      description: latestNote.content,
      action: { label: "去知识", to: "/knowledge" },
    });
  }

  if (latestPaper) {
    items.push({
      id: `asset-paper-${latestPaper.id}`,
      label: "最近论文",
      title: latestPaper.title,
      description: `最近更新于 ${formatDateTime(latestPaper.updated_at || latestPaper.created_at)}。`,
      action: paperAction("打开这篇", latestPaper),
    });
  }

  if (items.length === 0) {
    items.push({
      id: "asset-empty",
      label: "暂无沉淀",
      title: "还没有可继续接手的研究资产",
      description: "创建研究主题、导入论文或开始一段对话后，这里会逐步积累起研究脉络。",
      action: { label: "开始规划", to: "/planner" },
    });
  }

  return items.slice(0, 3);
}

export function buildWorkbenchOverviewModel(source: WorkbenchOverviewSource): WorkbenchOverviewModel {
  const snapshots = buildInterestSnapshots(source);
  const analyzedCount = source.papers.filter((paper) => Boolean(paper.analysis)).length;
  const primaryAction = snapshots[0]?.action ?? { label: "开始研究规划", to: "/planner" };
  const latestCheckpoint = source.checkpoints[0];
  const checkpointSummary =
    latestCheckpoint?.nextSteps[0] ||
    latestCheckpoint?.openQuestions[0] ||
    "最近一次对话已经记录 checkpoint，可以从交接入口继续追问。";

  return {
    heroTitle:
      snapshots.length > 0 ? "今天先把最关键的研究接上。" : "先把第一个研究主题建立起来。",
    heroDescription:
      snapshots.length > 0
        ? "小妍先把值得继续的主题、刚交回来的结果和容易拖慢进展的事项整理到一起，让你回到首页就知道下一步。"
        : "从研究问题、关键词和目标开始，小妍会先帮你搭起路线，再把论文、知识和对话逐步接回来。",
    primaryAction,
    secondaryAction: { label: "打开小妍", to: "/xiaoyan" },
    metrics: [
      {
        label: "在研主题",
        value: String(source.interests.length),
        note: `${snapshots.filter((item) => item.interest.status === "planned").length} 个已成路线`,
      },
      { label: "已解读论文", value: String(analyzedCount), note: `${source.papers.length} 篇论文已入库` },
      { label: "知识卡片", value: String(source.notes.length), note: "可继续补证据和结构" },
      {
        label: "最近对话",
        value: String(source.sessions.length),
        note:
          source.checkpoints.length > 0
            ? `${source.checkpoints.length} 个小妍续接点`
            : "可以直接接着追问",
      },
    ],
    summaryItems: [
      {
        title: source.submission.pendingReviews > 0 ? "投稿链里有待处理事项" : "投稿链当前相对平稳",
        description:
          source.submission.pendingReviews > 0
            ? `${source.submission.pendingReviews} 条审稿意见待回复，建议优先确认时效任务。`
            : source.submission.upcomingDdls.length > 0
              ? `${source.submission.upcomingDdls.length} 个截止节点待关注，记得提前整理版本。`
              : "当前没有明显的投稿阻塞，可以把精力放回研究推进本身。",
      },
      {
        title: snapshots[0] ? `优先继续「${snapshots[0].title}」` : "先从研究规划开始",
        description: snapshots[0]?.nextStep ?? "先把研究问题、关键词和预期产出整理清楚。",
      },
      {
        title: source.checkpoints.length > 0
          ? "小妍已经留下续接线索"
          : source.notes.length > 0
            ? "已有可继续接手的知识沉淀"
            : "还需要把研究结论沉淀下来",
        description:
          source.checkpoints.length > 0
            ? checkpointSummary
            : source.notes.length > 0
              ? "已经有知识卡片可继续补证据、改结构，不用每次都从对话历史里回找。"
              : "等论文解读后，建议尽快把关键结论沉淀成知识卡片，后续追问会更稳。",
      },
    ],
    agenda: buildAgenda(source, snapshots),
    interests: snapshots.slice(0, 4).map((snapshot) => ({
      id: snapshot.interest.id,
      title: snapshot.title,
      stage: snapshot.stage,
      stageTone: snapshot.stageTone,
      summary: snapshot.summary,
      nextStep: snapshot.nextStep,
      stats: snapshot.stats,
      action: snapshot.action,
    })),
    handoffs: buildHandoffs(source),
    risks: buildRisks(source),
    assets: buildAssets(source, snapshots),
    layout: buildLayout(source, snapshots.length > 0),
    aiGenerated: false,
  };
}
