# 功能对齐矩阵：apps/mac vs master:apps/desktop

> 基准：master 分支 apps/desktop（Tauri + Next.js）
> 目标：apps/mac（原生 SwiftUI）功能对等
> 日期：2026-04-30

---

## 1. API / Service 层

| 域 | Desktop API (client.ts) | Mac 状态 | 实现文件 | 真实缺口 |
|---|---|---|---|---|
| **settingsApi** | get / update / test / export / import / listOllamaModels | 完成 | AppSettings.swift, SettingsService.swift | — |
| **settingsApi.history** | list / save / apply / delete | 部分 | SettingsRepository.swift | 缺：apply（从快照恢复到当前设置） |
| **updatesApi** | check / install | 完成 | UpdatesService.swift, AboutSettingsTab.swift | check 返回 `Result<UpdateCheckOutcome, UpdateCheckError>`，区分 noUpdate / network / http / decode / missingPlatformURL；install 映射为 NSWorkspace.open；About 页已集成检查 UI |
| **papersApi** | list/get/upload/update/delete/openFile/analyze/reproduce/listFigures/extractPdfText | 完成 | PaperRepository.swift, PaperService.swift | — |
| **ccfApi** | lookup | 有 | SourceService.swift | — |
| **journalApi** | lookup / rankFilter | 有 | SourceService.swift | — |
| **sourceApi** | lookup | 有 | SourceService.swift | — |
| **arxivApi** | search | 有 | ArxivClient.swift | — |
| **paperSearchApi** | search | 有 | PaperDiscoveryView.swift | — |
| **knowledgeApi** | listInterests/createInterest/updateInterestFolder/deleteInterestBundle/deleteInterestOnly/generateInterestHints/suggestTopics/generatePlan | 部分 | KnowledgeRepository.swift, KnowledgeService.swift | 缺：suggestTopics、generateInterestHints |
| **knowledgeApi.notes** | listNotes/createNote/updateNote/moveNote/deleteNote/search/webClip | 部分 | KnowledgeRepository.swift, KnowledgeService.swift | 缺：webClip、语义搜索（仅存储 embedding，无查询接口） |
| **knowledgeApi.graph** | snapshot/createClaim/deleteClaim/createEvidence/deleteEvidence/createCitation/deleteCitation/citationCentrality/citationShortestPath/citationSubgraph | 部分 | KnowledgeGraphCanvasView.swift, KnowledgeRepository.swift | 缺：snapshot、deleteEvidence、deleteCitation、centrality/shortestPath/subgraph；已有：createClaim/updateClaim/deleteClaim/createEvidence/createCitation |
| **chatApi** | listSessions/getSession/deleteSession/updateSessionContext/listAgentRuns/stream | 完成 | ChatRepository.swift, ChatService.swift | updateSessionContext、listAgentRuns(持久化读写)、历史 run 恢复、artifact JOIN 查询均已实现 |
| **plannerApi** | generate | 有 | KnowledgeService.swift | — |
| **surveyApi** | generate / search | 有 | SurveyView.swift | — |
| **translateApi** | translate | 有 | ToolsView.swift | — |
| **markdownApi** | formatChunk | 有 | ToolsView.swift | — |
| **memoryApi** | add/list/listObservations/searchObservations/delete/clearAuto/buildContext | 完成 | MemoryRepository.swift | — |
| **skillsApi** | list/create/update/delete/resetBuiltins | 部分 | SkillRepository.swift, SkillService.swift | 缺：resetBuiltins |
| **submissionApi** | 见下方详细分解 | 完成 | SubmissionRepository.swift, SubmissionService.swift | 见下方 |
| **experimentApi** | list/get/create/update/delete/attachments.{list,add,updateLabel,delete} | 完成 | ExperimentRepository.swift, ExperimentView.swift | — |
| **exportApi** | toObsidian | 有 | ExportService.swift | 服务层 `exportPaper` + `exportToFile` 已实现；UI 触发入口待确认是否完整覆盖 |

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

v1_initial 迁移已包含绝大多数 NOT NULL DEFAULT 约束和索引。v2_schema_align 为早期安装补足了以下增量：

- 补列：`chat_sessions.updated_at`、`agent_runs.updated_at`、`skills.updated_at`、`submissions.updated_at`、`experiment_records.updated_at`、`knowledge_graph_claims.updated_at`、`knowledge_paper_citations.created_at`、`paper_chunks.created_at`
- 补列：`reproduction_guides.dataset_preparation/training_process/inference_process/evaluation_metrics/risks_and_notes/raw_guide/created_at`
- 补列：`paper_analyses.experiment_results`、`paper_analyses.created_at`
- 重建 `paper_analyses` 表（为早期未含 `id` 列的安装迁移到标准主键结构）
- 补索引：`idx_settings_history_created_at` 等 12 个索引

**当前无结构性 schema 缺口**。新安装通过 v1_initial 即获得完整结构；旧安装通过 v2_schema_align 自动补齐。

---

## 3. UI / 页面功能对齐

| Desktop 页面 | Desktop Feature 目录 | Mac 对应文件 | 状态 | 真实缺口 |
|---|---|---|---|---|
| Home.tsx | workbench/* | HomeView.swift + WorkbenchModel/Cards | 完成 | — |
| Copilot.tsx | copilot/* | CopilotView.swift + MissionControlView + AgentStateGraphView | 完成 | 已集成状态图；历史 run 恢复 + artifact JOIN 查询已补齐 |
| Papers.tsx | papers/* | PapersView.swift + PaperDetailView + PaperFiguresView + PaperMetadataEditor | 完成 | PDF 打开、图片展示、元数据编辑、标签已补齐 |
| Planner.tsx | planner/* | PlannerView.swift | 完成 | — |
| Survey.tsx | survey/* | SurveyView.swift | 完成 | — |
| Knowledge.tsx | knowledge/* | KnowledgeView.swift + KnowledgeGraphCanvasView + ClaimsView | 部分 | 缺：graph snapshot、deleteEvidence/deleteCitation UI、语义搜索、webClip；已有 claim CRUD |
| Submission.tsx | submission/* | SubmissionView.swift + KanbanView + CoverLetterView + VenueRecommendationsView | 完成 | 版本 diff、review verdict 统计、checklist 交互已完善 |
| Experiment.tsx | experiment/* | ExperimentView.swift | 完成 | 附件管理 CRUD 已集成 |
| Tools.tsx | tools/* | ToolsView.swift + PaperDiscoveryView + PptWorkspaceView | 部分 | 已支持 .md 导出 + 结构预览；PDF 文本提取已用 PDFKit；PPTX 原生生成需后端配合 |
| Settings.tsx | settings/* | SettingsView.swift + AgentConfigPanel + SettingComponents | 完成 | about（Tauri manifest 更新检查 UI）、changelog、layout、task setup 已补齐；history apply 为 service 层缺口 |

---

## 4. 真实剩余缺口清单

### Service 层
- [ ] **settingsApi.history.apply**：从快照恢复到当前设置
- [ ] **knowledgeApi.suggestTopics / generateInterestHints**
- [ ] **knowledgeApi.notes.webClip**
- [ ] **knowledgeApi.notes.search(语义)**：已有 embedding 存储，缺向量查询接口
- [ ] **knowledgeGraph.deleteEvidence / deleteCitation**
- [ ] **knowledgeGraph.snapshot**
- [ ] **knowledgeGraph.centrality / shortestPath / subgraph**
- [ ] **skillsApi.resetBuiltins**

### UI 层
- [ ] **Knowledge**：语义搜索入口、webClip 入口、graph snapshot、evidence/citation 删除交互
- [ ] **Tools**：PPTX 原生生成（需后端配合）

### 迁移
- [x] v1_initial：完整 schema
- [x] v2_schema_align：补列/补索引/重建 paper_analyses
- 无需新增 v3/v4（v2 已覆盖所有已知缺口）
