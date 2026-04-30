# 功能对齐矩阵：apps/mac vs master:apps/desktop

> 基准：master 分支 apps/desktop（Tauri + Next.js）
> 目标：apps/mac（原生 SwiftUI）功能对等
> 日期：2026-04-30

---

## 1. API / Service 层

| 域 | Desktop API (client.ts) | Mac 状态 | 实现文件 | 缺口 |
|---|---|---|---|---|
| **settingsApi** | get / update / test / export / import / listOllamaModels | 部分 | AppSettings.swift, SettingsService.swift | 缺：test, export, import, listOllamaModels |
| **settingsApi.history** | list / save / apply / delete | 部分 | SettingsRepository.swift | 缺：apply |
| **updatesApi** | check / install | 部分 | UpdatesService.swift | check 已实现（拉取远端 JSON + 版本对比）；install 映射为 NSWorkspace.open(downloadURL) |
| **papersApi** | list/get/upload/update/delete/openFile/analyze/reproduce/listFigures/extractPdfText | 完成 | PaperRepository.swift, PaperService.swift | — |
| **ccfApi** | lookup | 有 | SourceService.swift | — |
| **journalApi** | lookup / rankFilter | 有 | SourceService.swift | — |
| **sourceApi** | lookup | 有 | SourceService.swift | — |
| **arxivApi** | search | 有 | ArxivClient.swift | — |
| **paperSearchApi** | search | 有 | PaperDiscoveryView.swift | — |
| **knowledgeApi** | listInterests/createInterest/updateInterestFolder/deleteInterestBundle/deleteInterestOnly/generateInterestHints/suggestTopics/generatePlan | 部分 | KnowledgeRepository.swift, KnowledgeService.swift | 缺：suggestTopics |
| **knowledgeApi.notes** | listNotes/createNote/updateNote/moveNote/deleteNote/search/webClip | 部分 | KnowledgeRepository.swift, KnowledgeService.swift | 缺：webClip, search(语义) |
| **knowledgeApi.graph** | snapshot/createClaim/deleteClaim/createEvidence/deleteEvidence/createCitation/deleteCitation/citationCentrality/citationShortestPath/citationSubgraph | 部分 | KnowledgeGraphCanvasView.swift, KnowledgeRepository.swift | 缺：snapshot, deleteClaim, deleteEvidence, deleteCitation, centrality/shortestPath/subgraph |
| **chatApi** | listSessions/getSession/deleteSession/updateSessionContext/listAgentRuns/stream | 完成 | ChatRepository.swift, ChatService.swift | updateSessionContext、listAgentRuns(持久化读写)、历史 run 恢复均已补齐 |
| **plannerApi** | generate | 有 | KnowledgeService.swift | — |
| **surveyApi** | generate / search | 有 | SurveyView.swift | — |
| **translateApi** | translate | 有 | ToolsView.swift | — |
| **markdownApi** | formatChunk | 有 | ToolsView.swift | — |
| **memoryApi** | add/list/listObservations/searchObservations/delete/clearAuto/buildContext | 完成 | MemoryRepository.swift | — |
| **skillsApi** | list/create/update/delete/resetBuiltins | 部分 | SkillRepository.swift, SkillService.swift | 缺：resetBuiltins |
| **submissionApi** | 见下方详细分解 | 完成 | SubmissionRepository.swift, SubmissionService.swift | 见下方 |
| **experimentApi** | list/get/create/update/delete/attachments.{list,add,updateLabel,delete} | 完成 | ExperimentRepository.swift, ExperimentView.swift | — |
| **exportApi** | toObsidian | **缺失** | — | 需新增 Obsidian 导出 |

### submissionApi 详细

| 方法 | Mac 状态 | 备注 |
|---|---|---|
| listVenues / createVenue / updateVenue / deleteVenue / toggleVenueStar | 有 | SubmissionRepository.swift |
| list / create / update / delete | 有 | — |
| listVersions / createVersion / deleteVersion | 有 | — |
| listRounds / upsertRound | 有 | — |
| listComments / createComment / updateComment / deleteComment | 有 | — |
| getChecklist / toggleChecklist | 有 | — |
| stats | 有 | — |
| aiReview | 有 | AIReviewView.swift |
| polishAbstract | 有 | CoverLetterView.swift |
| generateCoverLetter | 有 | CoverLetterView.swift |
| version diff | 有 | VersionDiffView.swift |
| review verdict stats | 有 | ReviewRoundsView.swift |

---

## 2. 数据库 Schema 对齐

| 表/字段 | Desktop (db.rs) | Mac (DatabaseManager.swift) | 缺口 |
|---|---|---|---|
| settings.updated_at | DEFAULT datetime('now') | 有 | — |
| settings_history | 有 + idx_settings_history_created_at | 有，缺索引 | 补索引 |
| papers.tags | NOT NULL DEFAULT '[]' | defaults(sql: "'[]'") | 需 NOT NULL |
| papers.importance_color | NOT NULL DEFAULT '' | 有，可为 NULL | 需 NOT NULL DEFAULT '' |
| papers.notes | TEXT | 有 | — |
| papers.updated_at | NOT NULL DEFAULT datetime('now') | 有 | — |
| paper_analyses.id | TEXT PRIMARY KEY | **缺失** | mac 端未存 id 列，用 paper_id 作逻辑主键 |
| paper_analyses.experiment_results | TEXT | **缺失** | 需新增列 |
| paper_analyses.created_at | 有 | **缺失** | 需新增 |
| reproduction_guides.code_repository | TEXT | 有 | — |
| reproduction_guides.dataset_preparation | TEXT | **缺失** | 缺：dataset_preparation, training_process, inference_process, evaluation_metrics, risks_and_notes, raw_guide |
| reproduction_guides.created_at | 有 | **缺失** | 需新增 |
| research_interests.keywords | NOT NULL DEFAULT '[]' | TEXT（可为 NULL） | 需 NOT NULL DEFAULT |
| research_interests.status | NOT NULL DEFAULT 'active' | TEXT（可为 NULL） | 需 NOT NULL DEFAULT 'active' |
| knowledge_notes.source_type | NOT NULL DEFAULT 'manual' | TEXT（可为 NULL） | 需 NOT NULL DEFAULT |
| knowledge_notes.tags | NOT NULL DEFAULT '[]' | TEXT（可为 NULL） | 需 NOT NULL DEFAULT |
| chat_sessions.title | NOT NULL DEFAULT 'New Conversation' | TEXT（可为 NULL） | 需补默认值 |
| chat_sessions.context_type | NOT NULL DEFAULT 'general' | TEXT（可为 NULL） | 需补默认值 |
| chat_sessions.updated_at | 有 | **缺失** | 需新增 |
| agent_runs.step_name | NOT NULL DEFAULT '' | TEXT（可为 NULL） | 需补 |
| agent_runs.order_index | INTEGER NOT NULL DEFAULT 0 | INTEGER（可为 NULL） | 需补 |
| agent_runs.updated_at | 有 | **缺失** | 需新增 |
| agent_artifacts.title | NOT NULL DEFAULT '' | TEXT（可为 NULL） | 需补 |
| agent_artifacts.content | NOT NULL DEFAULT '' | TEXT（可为 NULL） | 需补 |
| skills.description | NOT NULL DEFAULT '' | TEXT（可为 NULL） | 需补 |
| skills.prompt | NOT NULL DEFAULT '' | TEXT（可为 NULL） | 需补 |
| skills.tags | NOT NULL DEFAULT '[]' | TEXT（可为 NULL） | 需补 |
| skills.updated_at | 有 | **缺失** | 需新增 |
| paper_figures.file_path | NOT NULL | TEXT（可为 NULL） | 需补 |
| paper_figures.created_at | NOT NULL | **缺失** | 需补 |
| venues.full_name | NOT NULL DEFAULT '' | TEXT（可为 NULL） | 需补 |
| venues.website | NOT NULL DEFAULT '' | TEXT（可为 NULL） | 需补 |
| venues.ccf | NOT NULL DEFAULT '' | TEXT（可为 NULL） | 需补 |
| venues.area | NOT NULL DEFAULT '' | TEXT（可为 NULL） | 需补 |
| venues.sci_quartile | NOT NULL DEFAULT '' | TEXT（可为 NULL） | 需补 |
| venues.special_issue_title | NOT NULL DEFAULT '' | TEXT（可为 NULL） | 需补 |
| submissions.status | NOT NULL DEFAULT 'writing' | TEXT（可为 NULL） | 需补 |
| submissions.venue_name | NOT NULL DEFAULT '' | TEXT（可为 NULL） | 需补 |
| submissions.venue_type | NOT NULL DEFAULT 'conference' | TEXT（可为 NULL） | 需补 |
| submissions.updated_at | 有 | **缺失** | 需新增 |
| paper_versions.tag/label/stage/content/notes | NOT NULL DEFAULT '' | TEXT（可为 NULL） | 需补 |
| review_rounds.verdict | NOT NULL DEFAULT 'pending' | TEXT（可为 NULL） | 需补 |
| review_comments.reviewer/content/response/tags | NOT NULL DEFAULT '' / '[]' | TEXT（可为 NULL） | 需补 |
| review_comments.resolved | INTEGER NOT NULL DEFAULT 0 | BOOLEAN（可为 NULL） | 需补 |
| submission_checklist.label/category | NOT NULL DEFAULT '' | TEXT（可为 NULL） | 需补 |
| experiment_records.config/result/notes | NOT NULL DEFAULT '{}' / '' | TEXT（可为 NULL） | 需补 |
| experiment_records.updated_at | 有 | **缺失** | 需新增 |
| experiment_attachments.label | NOT NULL DEFAULT '' | TEXT（可为 NULL） | 需补 |
| knowledge_graph_claims.statement | NOT NULL DEFAULT '' | TEXT（可为 NULL） | 需补 |
| knowledge_graph_claims.status | NOT NULL DEFAULT 'supported' | TEXT（可为 NULL） | 需补 |
| knowledge_graph_claims.updated_at | 有 | **缺失** | 需新增 |
| knowledge_graph_evidence_links.evidence_summary | NOT NULL DEFAULT '' | TEXT（可为 NULL） | 需补 |
| knowledge_paper_citations.created_at | 有 | **缺失** | 需新增 |

---

## 3. UI / 页面功能对齐

| Desktop 页面 | Desktop Feature 目录 | Mac 对应文件 | 状态 | 缺口 |
|---|---|---|---|---|
| Home.tsx | workbench/* | HomeView.swift + WorkbenchModel/Cards | 完成 | 本次已增强 |
| Copilot.tsx | copilot/* | CopilotView.swift + MissionControlView + AgentStateGraphView | 完成 | 已集成状态图；历史 run 恢复已补齐 |
| Papers.tsx | papers/* | PapersView.swift + PaperDetailView + PaperFiguresView + PaperMetadataEditor | 完成 | PDF 打开、图片展示、元数据编辑、标签已补齐 |
| Planner.tsx | planner/* | PlannerView.swift | 完成 | — |
| Survey.tsx | survey/* | SurveyView.swift | 完成 | — |
| Knowledge.tsx | knowledge/* | KnowledgeView.swift + KnowledgeGraphCanvasView + ClaimsView | 部分 | 缺：graph snapshot、claim/evidence/citation CRUD、语义搜索 |
| Submission.tsx | submission/* | SubmissionView.swift + KanbanView + CoverLetterView + VenueRecommendationsView | 完成 | 版本 diff、review verdict 统计、checklist toggle/delete 已补齐 |
| Experiment.tsx | experiment/* | ExperimentView.swift | 部分 | 附件管理 service 已补齐，UI 待集成 |
| Tools.tsx | tools/* | ToolsView.swift + PaperDiscoveryView + PptWorkspaceView | 部分 | 已支持 .md 导出 + 结构预览；PDF 文本提取已用 PDFKit；PPTX 原生生成需后端支持 |
| Settings.tsx | settings/* | SettingsView.swift + AgentConfigPanel + SettingComponents | 完成 | about、changelog、layout、task setup 已补齐；history apply 为 service 层缺口 |

---

## 4. 实施优先级建议

### P0：结构拆分（先拆后改）
- [x] SubmissionView.swift → SubmissionsListView/VenuesListView/VersionsView/ReviewRoundsView/AIReviewView/ChecklistView 独立文件
- [x] CopilotView.swift → SessionSidebar/MissionControl/Composer 独立文件
- [x] ToolsView.swift → 每个 tool 一个独立文件
- [x] SettingsView.swift → 每个 tab 独立文件

### P1：Schema 对齐（可重复迁移）
- [x] 新增 v2_schema_align 迁移：补列（NOT NULL DEFAULT）、补索引、补 created_at/updated_at
- [ ] 新增 v3_reproduction_expanded 迁移：补 reproduction_guides 缺失列
- [ ] 新增 v4_chat_session_updated_at 迁移：补 chat_sessions/agent_runs/skills updated_at

### P2：Service 补齐
- [x] papersApi：openFile (NSWorkspace), listFigures (PaperRepository), extractPdfText (PDFKit)
- [x] knowledgeApi：updateInterestFolder, deleteInterestBundle/Only, moveNote
- [ ] knowledgeApi：suggestTopics, webClip
- [ ] knowledgeGraph：claim/evidence/citation CRUD, snapshot, centrality/shortestPath/subgraph
- [x] chatApi：updateSessionContext, listAgentRuns 持久化查询 + 历史恢复
- [x] memoryApi：searchObservations, clearAuto, buildContext
- [x] experimentApi：attachments CRUD
- [ ] exportApi：Obsidian 导出
- [x] updatesApi：远端 JSON 检查 + 版本对比 + 下载链接打开
- [ ] settingsApi：test, export, import, listOllamaModels
- [ ] skillsApi：resetBuiltins

### P3：UI 精修
- [x] Settings：补全 tabs（about, layout, task setup, changelog）
- [x] Papers：补 PDF 打开按钮、图片展示、元数据编辑面板
- [x] MarkdownView：基于 AttributedString 的 Markdown 渲染（LaTeX 需 WebView 支持，暂不实现）
- [x] Submission：版本 diff、review verdict 统计、checklist 交互完善
- [x] Tools：.md 导出 + 结构预览；PDF 文本提取已用 PDFKit

### P4：验收
- [x] 每域修改后 `swift build`
- [x] 最终输出完整功能矩阵定位文件
