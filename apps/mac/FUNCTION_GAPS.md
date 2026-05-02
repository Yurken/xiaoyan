# Mac vs Desktop 功能缺口清单

> 基准：master 分支 `apps/desktop`（React + Tauri + Next.js）
> 目标：mac-dev 分支 `apps/mac`（Swift / SwiftUI 原生）
> 审计日期：2026-05-02
> 配套：`FUNCTION_MATRIX.md`（API/页面级矩阵）

本清单聚焦真实功能缺口，不计行数差异。每条含 desktop 出处、mac 现状与优先级（P1 影响主流程 / P2 体验明显劣化 / P3 细节）。

---

## 0. 数据互通风险点（最高优先级，必须先修）

跨端共用同一 SQLite 时这些差异会导致脏数据或读不到。**全部已对齐**（2026-05-02）。

| # | 字段/枚举 | desktop | mac 原状 | 修复 |
|---|---|---|---|---|
| **R1** ✅ | Submission `status` 状态机 | 5 态 `writing/submitted/reviewing/accepted/rejected` | 7 态 `draft/preparing/revision/withdrawn` 等 | `SubmissionStatus.swift:55` 收敛为 5 态；`DatabaseManager.swift:449` 迁移 `v3_submission_status_align` 自动归并旧值；本次再清理 `VersionsView` CreateVersionSheet Picker（旧 4 态 → 5 态）+ `SubmissionRepository.stats()` SQL（旧状态引用 → 新 5 态） |
| **R2** ✅ | KnowledgeClaim `status` 枚举 | `hypothesis/supported/contested/open` | 中文 `待验证/已验证/已证伪` | `KnowledgeGraph.swift:55` 改用枚举 + `KnowledgeClaimStatus.from(_:)` 兼容历史值；`DatabaseManager.swift:457` 迁移 `v4_claim_status_align` 自动归并 |
| **R3** ✅ | Experiment `config` 字段（原文档误写为 result） | `Record<string, unknown>` 任意嵌套 | `[String: String]?` — 数字/嵌套对象解码失败 | 新增 `Models/JSONValue.swift` 任意 JSON 枚举；`ExperimentRecord.config: [String: JSONValue]?`；`ExperimentView` 编辑/创建用 `JSONDecoder().decode([String: JSONValue].self, ...)`，并在解析失败时显示"JSON 格式错误"提示 |
| **R4** ✅ | Copilot `chat_mode` 字段 | 显式 `direct/task` | 不发该字段，靠 settings `multi_agent_enabled` 隐式 | `CopilotModels.ChatMode` 枚举 + `CopilotView` `@AppStorage("rc_copilot_chat_mode")`（与 desktop `useCopilotChatMode.ts` 同 key）；`ChatService.chat(..., chatMode:)` 透传决定 agentic 路径 |

---

## 1. Copilot（小妍对话）

### P1
- **A1 附件/上传文件** ✅（已对齐）：mac `CopilotAttachment.swift` + `CopilotComposerView.swift:27-28, 80-122` 与 desktop `useCopilotAttachments.ts` 等价
- **A2 chat_mode 切换 UI** ✅（已对齐）：`CopilotComposerView.swift:53-77` 顶部 ForEach(ChatMode.allCases) chip 切换 + `@AppStorage("rc_copilot_chat_mode")` 持久化（参见 R4）
- **A3 Skills 选择器与 prompt 注入** ✅（已对齐）：`CopilotComposerView.swift:204-227`（按钮）+ `SkillsPickerPopover` 252-396 行
- **A4 Interest 归属/会话分组** ✅（已对齐）：`CopilotView.swift:32-66, 86-213, 658-758`（顶部 Picker + 右键移动 + 按 interest DisclosureGroup + 二段确认删除）；1:1 desktop `Copilot.tsx:174-186, 482-486, 538-645`
- **C1 自由工作台模式 / FocusLayout（hideFolders）** ✅（已对齐）：`CopilotView.swift:22, 36-39, 294-305` 顶部 toggle 收起/展开 sessionSidebar；1:1 desktop `Copilot.tsx:83` hideFolders 语义

### P2
- **A5 流式中断 Stop 按钮**：mac 仅切换/关闭时 abort，无手动停止 — desktop `Copilot.tsx:241-244, 342-344`；mac `CopilotView.swift:437-446`
- **A6 流事件未驱动 UI**：sources/plan/agent_runs 未渲染 — desktop `Copilot.tsx:387-426, 871-892`；mac `ChatService.swift:125-131`（`runSimple/runAgentic` 不写 sources）
- **A7 `<think>` 思考块解析与折叠展示**：mac 无 — desktop `splitThoughtFromContent` `Copilot.tsx:36-50, 778-785`
- **A8 Mission Control 全屏展开**：mac 仅固定侧栏 — desktop `CopilotOverviewSidebar.tsx:39-117`（ChevronsLeft/Right + Esc）
- **A9 状态图非交互**：mac 无连线绘制 — desktop `AgentStateGraphPanel.tsx:46-168`（贝塞尔 + 滚轮缩放 + 拖动）；mac `AgentStateGraphView.swift:78-156`
- **A10 Artifact Markdown 渲染与外链**：mac 仅 5 行截断纯文本 — desktop `CopilotOverviewSidebar.tsx:177-181`；mac `MissionControlView.swift:235-250`
- **C2 Artifact 导出/复制 markdown 入口**：mac `ExportService` 存在但 Mission Control 未挂入口

### P3
- **A11 删除会话二次确认 / 兴趣组级删除**：兴趣组级二段确认 ✅（A4 已对齐）；单会话仍是 contextMenu 直接删除，未做二次确认
- **A12 Memory chat.query 摘要写入**：mac 仅写库无 query 摘要
- **A13 主题文件夹下拉、未归类分组、CollapsibleGroup** ✅（已对齐 A4）
- **A14 Composer 默认提示（仅附件无文本时）**：mac 无 `DEFAULT_ATTACHMENT_PROMPT`
- **A15 Enter / Shift+Enter 行为**：mac TextEditor 默认 Enter 总换行，与 desktop 不一致
- **C3 AgentRun summary**：mac 写死"执行完成/综合完成"（`ChatService.swift:281, 317`），desktop 来自后端真实摘要

---

## 2. Home / Workbench

### P1
- 无（功能基本对齐）

### P2
- **B2 Risks 状态机字段映射 bug**：`WorkbenchModel.swift:427-428` 把 `.parsed` 同时算入 `failedPapers` 与 `processingPapers`；desktop `model.ts:281-282` 仅 failed/error 算失败、parsing/analyzing 算处理中
- **B3 Submission 最近截止排序**：mac `WorkbenchModel.swift:313` 直接取 `upcomingDdls.first`，未按 deadline 排序；desktop `model.ts:170` 显式排序
- **B1 三列快捷卡 Sparkles 提示行**：mac 视觉减弱（`HomeView.swift:231-264` vs `OverviewWorkspace.tsx:345-388`）

### P3
- **B4 空状态文案"暂无研究主题"占位卡**：mac 直接 ForEach 空数组无占位
- **B5 助理头像/品牌 Logo**：mac 用系统 sparkles 图标

---

## 3. Knowledge / Planner

### P1
- **TopicDiscoveryWizard** ✅（2026-05-02 已对齐）：4 步领域→目标→背景→候选话题向导 — desktop `TopicDiscoveryWizard.tsx:33-202`；mac `Features/Knowledge/TopicDiscoveryWizardView.swift` + `KnowledgeView.CreateInterestSheet` 顶部入口
- **PlannerComposer 8 字段研究画像** ✅（已对齐）：`KnowledgeView.swift:755-860` CreateInterestSheet 扩展为 8 字段（timeBudget / constraints / knownContext / preferredOutput）+ 完成度进度条；1:1 desktop `PlannerComposer.tsx:30-50, 343-727`
- **AI 实时智能提示边栏**：700ms debounce 调 `generateInterestHints` — desktop `PlannerComposer.tsx:178-248, 645-705`；mac 后端 `KnowledgeService.swift:170` 已实现但 UI 完全没用
- **ResearchWorkbench 五 Tab 工作台**：planner/papers/xiaoyan(chat)/notes/tools 集成 — desktop `ResearchWorkbench.tsx:1-520`；mac 无对应工作台

### P2
- **PDF 参考文献预上传**：创建 interest 时批量挑 PDF 自动 `papers.upload(path, interest.id)` — desktop `PlannerComposer.tsx:54-95, 250-302, 593-642`；mac 无
- **Interest 状态机 (planning/planned/active)**：mac `ResearchInterest` 模型缺 `status` 字段，仅以 `learningPath != nil` 判断 — desktop `InterestsPanel.tsx:23-27, 256-322`
- **InterestProfilePanel 研究画像高亮**：goal/timeBudget/preferredOutput chip + constraints — desktop `InterestProfilePanel.tsx:23-69`；mac 无
- **多 Agent 实时工作流 UI**：mac 是本地 `simulateWorkflow()` 假模拟（`PlannerView.swift:441-475`），desktop 接 `interest:agent_start/complete/error` 事件流
- **文件夹名编辑、删除确认（保留/全删）**：mac 仅右键单一删除（`KnowledgeView.swift:388-393`）

### P3
- **重新规划 (regenerate) 入口**：mac 仅 `learningPath == nil` 才显示生成按钮（`KnowledgeView.swift:378-384`），无法重跑

---

## 4. Notes（笔记）

### P1
- **研究方向分组视图** ✅（2026-05-02 已对齐）：DisclosureGroup 按 interest 分组（folder_name||topic + 副标题 + 计数 + 删除两选项）+ "未归档笔记" 独立 Section；搜索/语义搜索时回退平铺 — `KnowledgeView.swift` `groupedNotesList` + `NotesInterestSection`，`KnowledgeService.deleteInterestBundle/Only` 暴露
- **笔记关联 interest（research_interest_id）** ✅（2026-05-02 已对齐）：CreateNoteSheet 与 NoteDetailView 编辑模式新增"关联研究方向"Picker；预览模式元数据栏展示已绑定方向 — `KnowledgeView.swift` 内

### P2
- **Markdown 实时预览编辑器**：mac 仅 TextEditor 纯文本 — desktop `NotesPanel.tsx:8-74`（双 Tab 编辑/预览）；mac `KnowledgeView.swift:478-491`
- **图谱关联计数 Badge**：mac 无 — desktop `NotesPanel.tsx:438-462, 545-549`

### P3
- **侧滑详情面板与返回动效**：mac 是 NavigationSplitView detail
- **来源类型徽标分类（manual/paper_analysis/survey/web_clip）UI 弱**：mac 仅显示原始字符串

---

## 5. KnowledgeGraph

### P1
- **KnowledgeGraphComposer 图内 CRUD（新增 Claim/Evidence/Citation 三件套）**：desktop `KnowledgeGraphComposer.tsx:1-308`；mac `KnowledgeGraphCanvasView` 仅展示
- **可缩放 SVG Canvas + 三泳道贝塞尔布局**：desktop `KnowledgeGraphCanvas.tsx:1-203`、`KnowledgeGraphWorkspace.tsx:177-215`（pointer 拖拽 + 滚轮缩放 0.6-2.2 + citation 虚线 + 节点最大化）；mac 仅三个 VStack 列表
- **KnowledgeClaimPanel 图谱页 claim+证据 bundle**：desktop `KnowledgeClaimPanel.tsx:1-145`；mac 必须切到 ClaimsView 单独看（且 sourceId 显示原始字符串无标题映射，`ClaimsView.swift:266-296`）
- **R2 Claim 状态枚举不一致**（参见 §0）

### P2
- **KnowledgeGraphInspector 多类型节点详情**：desktop 按节点类型展示 claim provenance / interest 关键词 chip / paper venue+keyConclusions / experiment / note — desktop `KnowledgeGraphInspector.tsx:1-152`；mac `KnowledgeGraphCanvasView.swift:181-235` 仅 sourceKind+summary+边数
- **KnowledgeTimelinePanel 按年聚合时间线**：desktop `KnowledgeTimelinePanel.tsx:1-91`；mac 无
- **聚焦研究方向过滤器**：desktop 顶部 Select 过滤整图 — `graphView.ts:60-99`；mac 无

### P3
- **MetricTile 概览（4 大指标卡 vs mac 7 个内联小数字）**：`KnowledgeGraphCanvasView.swift:36-46` vs `KnowledgeGraphWorkspace.tsx:12-32`

### Mac 反向超出 desktop（保留）
- **GraphAnalysisPanel**：中心性 / 最短路径 / 子图算法面板（`GraphAnalysisPanel.swift:1-301`），desktop 无对应

---

## 6. Survey（综述）

### P1
- **结构化 schema 大幅缩水**：desktop 14 项（含 timeline/schools_of_thought/controversies/recommended_topics/challenges/frontier 等）— `SurveyPanel.tsx:31-92`；mac `SurveyView.swift:540-578` 仅 7 项
- **多 Agent 真实流式**：mac 用 `simulateWorkflow()` 假模拟（`SurveyView.swift:435-451`）；desktop 监听 `survey:delta|done|error|structured|agent_start|agent_complete|agent_error`
- **高级参数面板** ✅（已对齐）：`SurveyView.swift:67-80` + `SurveyParameterPanel.swift`（5 类 Picker：时间范围/文献类型/数据库/引用格式/语言），prompt 已注入参数约束；1:1 desktop `SurveyPanel.tsx:94-117, 532-647`

### P2
- **研究方向→论文勾选**：desktop 选 interest 后加载 papers 可勾选喂给 survey — `SurveyPanel.tsx:148-230, 410-480`；mac 完全无关联
- **formatted_citations / citation_format 输出与导出**：mac 无

### P3
- **历史记录持久化**：mac 仅 `@State surveyHistory` 进程内数组（`SurveyView.swift:12, 415`）
- **CCF 标识与 venue 链接**：mac papersView 仅展示纯文本（`SurveyView.swift:308-352`）

---

## 7. Settings

### P1
- **S2 加密导入/导出 UI 退化** ✅（已对齐）：`CryptoConfigModal.swift`（双输入确认 + hint + 错误分离）+ `ImportExportSettingsTab.swift` 按钮入口；1:1 desktop `CryptoConfigModal.tsx`
- **S11 Skills 编辑/新建/导入**：mac 仅 toggle + 重置内置（`SkillsSettingsTab.swift:102-104`）；desktop `SkillsSection.tsx` 含 SkillEditModal（新建/修改 prompt/tags 编辑）

### P2
- **S1 标签分组结构错位**：mac 13 个左侧栏标签 vs desktop 单页+分区滚动；mac 缺"快速开始"引导分区 — `pageConfig.tsx:24-87` + `TaskSetupSection.tsx`
- **S5 配置历史快照粗糙**：mac 仅列名称+时间+应用/删除 — desktop `SettingsHistorySection.tsx:1-298`（命名输入 + Select 切换 + 确认对话 + 元信息 chip + 三态 loading）
- **S6 TaskSetup 内容职能错位**：desktop 是连接→角色→多 Agent 三步引导；mac 实际放的是 default_temperature 等运行参数
- **S7 内存清理策略不全**：mac 仅显示前 20 条，无来源 chip/importance — desktop `MemorySection.tsx:113-132`
- **S8 关于页 in-app 安装**：mac 只能"打开下载链接"手动装 — desktop `AboutSection.tsx:38-130`（`onInstallUpdate` 自动下载安装 + updateState 五态）
- **S9 布局/主题对齐度**：mac 缺 focus/landscape 切换 + ThemeSwatch/StylePreview 视觉 — desktop `LayoutSettingsSection.tsx`

### P3
- **S10 paper_visible_venue_tags 可视化标签管理**（`pageConfig.tsx:294`）
- **S12 ChangelogCard 静态硬编码**：mac 仅两条硬编码版本（`ChangelogSettingsTab.swift:4-24`）

---

## 8. Tools

### P1
- **T1 Arxiv 字段检索**：desktop `ArxivFieldSearchPanel.tsx:114-253` 11 字段（通用/标题/摘要/作者/分类 chip 多选/备注/期刊/排除词/最近天数/返回篇数/排序模式）+ ARXIV_CATEGORIES 分组面板；mac `ArxivSearchView.swift:6-82` 仅 4 字段
- **T4 SourceLookup 学术信号** ✅（已对齐）：`SourceLookupView.swift` journalCard 新增索引徽章行（indexes + JCR/CAS/Top/OA 彩色标签）+ eISSN/JIF 排名/JCR 分类字段 + WOS 分类 chip 列表；ccfCard 标题改为 Link + CCF 等级徽章样式 + 出版商字段；1:1 desktop `SourceLookupPanel.tsx:75-137`
- **T5 Translation 多语言** ✅（已对齐）：`TranslationView.swift` 源/目标语言 Picker（zh/en/ja/de/fr + auto），prompt 动态注入语言名；1:1 desktop `TranslationPanel.tsx:20-35`
- **T8 FriendLinks 数据完整度**：desktop `yanweb-links.ts` 1055 行（数百条 + 多分组 + favicon）；mac `FriendLinksView.swift:13-51` 仅 5 类约 27 条硬编码无图标

### P2
- **T2 PaperDiscovery 排序模式**：mac `PaperDiscoveryView.swift:22-25` 仅 relevance/quality 两档，且 quality 实际是 sortBy=submittedDate（`:408`）
- **T3 PaperDiscovery 动态期刊列表**：mac 仅静态 `computeStaticVenues`（`PaperDiscoveryView.swift:31-37`）；desktop `usePaperDiscoverySearch.ts` + `PaperDiscoveryPanel.tsx:64-89` 含 `dynamicJournalTerms` 异步合并
- **T6 MarkdownFormatter 分块进度**：mac 一次性提交超长会失败（`MarkdownFormatterView.swift:120-160`）；desktop `MarkdownFormatterPanel.tsx:98-114` 自动分块 + 进度条

### P3
- **T9 ArxivSearchResults 排版退化**：mac `ArxivEntryRow` 简单 List 行
- **T10 Tools 入口页**：mac `ToolsView.swift` 38 行极简

### Mac 接近对等
- **T7 PPT Workspace**：三模式齐备 + Swift 端原生 .pptx 生成（`PptxBuilder.swift:403`）；功能等价

---

## 9. Papers

### P1
- **批量上传 + 拖拽** ✅（已对齐）：`PapersView.swift` `fileImporter` 加 `allowsMultipleSelection: true`，循环上传多份 PDF
- **研究方向分组 + 分组级搜索/排序/tag 筛选** ✅（已对齐）：`PapersView.swift` 顶部排序/研究方向/标签三 Picker + List Section 按 interest 分组（含未归类）；1:1 desktop `Papers.tsx:69-79, 187-222, 523-582`

### P2
- **元数据可见徽章（CCF/SCI/JCR/CAS/WoS）**：mac 卡片仅显示年份+venue+status — desktop `Papers.tsx:633-651`
- **导入时元数据自动识别开关**：desktop `Papers.tsx:951-1005`
- **删除主题文件夹（保留/全删）**：desktop `Papers.tsx:455-472, 1090-1116`
- **Reproduction sections 字段对齐**：mac 仅 6 段（`PaperDetailView.swift:216-238`），缺 training_process/inference_process/evaluation_metrics 拆分；desktop 8 段（`PaperDetailModal.tsx:22-31`）
- **图片缩放/Lightbox + caption-figure 关联**：mac 仅静态 Image（`PaperFiguresView.swift:20-58`）

### P3
- **重新解读确认**：mac 已 analyzed 后无重新解读入口
- **重要性颜色色环/色条**：mac 仅 Picker
- **Memory 自动事件**：mac 上传/分析/查看无 memory 钩子

---

## 10. Submission

### P1
- **DDL 日历视图（venue tracker）** ✅（已对齐）：`VenuesListView.swift` deadline 排序切换 + 倒计天数标签（红/橙/绿）+ 通知日期 + 特刊标题；CreateVenueSheet 增加 DatePicker 录入 deadline/notification/special issue；1:1 desktop `Submission.tsx:285-306, 830-849`、`VenueTrackerWorkspace.tsx:92-208`
- **版本快照 content 编辑 + AI 润色 + AI 审稿入口** ✅（已对齐）：`VersionsView.swift:76, 114-122` + `VersionDetailSheet.swift`（content TextEditor + AI 润色 + AI 审稿 sheet）；`SubmissionRepository.swift` / `SubmissionService.swift` 补 `updateVersion`；1:1 desktop `VersionWorkspace.tsx:212-270`
- **行级 LCS Diff** ✅（已对齐）：`VersionDiffView.swift` 行级 LCS 算法 + add/remove/same 着色 + 顶部 +/- 行计数；1:1 desktop `shared.ts:134-180`、`VersionWorkspace.tsx:277-316`
- **Mock Review 多 reviewer + 严格度 + 一键导入轮次** ✅（已对齐）：`MockReviewSheet.swift:1-314`（reviewerCount 2-4 + lenient/balanced/strict + 流式接收 + verdict 分布 + 导入新一轮）；mac `AIReviewView.swift` 已移除并由 `MockReviewSheet` 完全替代
- **Review 评论 tags / verdict / 已处理 / 作者回复编辑** ✅（已对齐）：`ReviewRoundsView.swift` CommentRow 显示 tags chips + resolved 切换按钮 + 行内 response 编辑（TextField + 保存/取消）；`AddCommentSheet` 增加 tags 输入（逗号分隔）；`SubmissionRepository.swift` / `SubmissionService.swift` 补 `updateReviewComment`；1:1 desktop `ReviewWorkspace.tsx:179-249` + `ReviewEntryModal.tsx`
- **R1 Submission status 状态机不一致**（参见 §0）

### P2
- **Venue 模板库 + 区域/类型筛选 + 已追踪标记**：desktop `AddVenueModal.tsx:1-230`（POPULAR_VENUES 模板）；mac `VenuesListView.swift:120-178` 仅手动输入
- **Review 轮 verdict 自动派生**：mac 必须手填 verdict 字符串（`ReviewRoundsView.swift:148-162, 232-269`）；desktop `getDominantVerdict` 自动 upsert
- **Polish 结果回写到版本**：mac 结果只能复制（`CoverLetterView.swift:127-150`）

### P3
- **看板拖拽/方向移动**：mac KanbanCard 仅 Menu 选目标列（`KanbanView.swift:113-127, 135-143`）；desktop 含 prev/next + writing→submitted 自动写 submittedAt
- **Cover Letter 后端流式**：mac 自拼 prompt 走 LLMClient（`CoverLetterView.swift:163-222`）；desktop 走 `submissionApi.generateCoverLetter`
- **Checklist 全局共享 vs 按 submission 独立**：语义差异

---

## 11. Experiment

### P1
- **附件管理 UI** ✅（已对齐）：`ExperimentAttachmentPanel.swift`（fileImporter 多选上传 + 列表 + 行内 label 编辑 + 删除）+ `ExperimentView.swift:229` 接入；1:1 desktop `Experiment.tsx:81-215, 496-498`
- **关联投稿下拉** ✅（已对齐）：`ExperimentView.swift` CreateExperimentSheet + ExperimentDetailView 编辑模式均新增"关联投稿"Picker；ExperimentRow / DetailView 只读模式显示投稿标题而非 ID 前缀；1:1 desktop `Experiment.tsx:457-466`
- **R3 Result 字段类型不一致**（参见 §0）

### P2
- **Config 自由 JSON**：mac 解码 `[String:String]`（`ExperimentView.swift:254-261`），嵌套或数字会失败回落空 dict — desktop `Record<string, unknown>`（`Experiment.tsx:289-298, 469-482`）

### P3
- **新增即编辑流程**：desktop 创建后自动选中并聚焦标题（`Experiment.tsx:270-287`）；mac CreateExperimentSheet 是独立弹窗

---

## 已确认对齐（避免重复）

下列项 FUNCTION_MATRIX.md 已标记完成且本次审计无新缺口：

- 数据库 schema 与 v1_initial / v2_schema_align 迁移
- settingsApi.history apply（解析快照 → 过滤 keys → 批量 upsert）
- updatesApi check（Result 区分 noUpdate/network/http/decode/missingPlatformURL）
- knowledgeApi.notes.webClip / 语义搜索
- knowledgeApi.suggestTopics / generateInterestHints（后端层）
- knowledgeGraph.deleteEvidence / deleteCitation / snapshot / centrality / shortestPath / subgraph
- skillsApi.resetBuiltins
- chatApi.updateSessionContext / listAgentRuns / artifact JOIN
- PPT 工作区原生 .pptx 生成
- 投稿 Mock Review 多 reviewer + 严格度 + 一键导入轮次（`MockReviewSheet.swift` + `SubmissionService.runMockReview`，2026-05-01）
- Settings Provider 预设 9 卡片 + Ollama `/api/tags` 拉模型（`ProviderPresets.swift` + `ProviderSettingsTab.swift`，2026-05-02）
- Settings 角色任务卡 10 张（流光/谋策/小妍/溯源/探知/洞见/翰章/构域/视界/译衡）含多 key 联动 + 折叠独立接口配置 + 副字段（rag_top_k）；TranslationView/AgentNodesService/SurveyView 已接入 translation_*/survey_writer_*/survey_planner_* 优先链；DefaultSettings 补齐 22 个键（`RoleCardPresets.swift` + `RoleCardView.swift` + `MultiKeyBindings.swift`，2026-05-02）
- Review 评论 tags / 已处理切换 / 行内回复编辑（`ReviewRoundsView.swift` CommentRow tags chips + resolved 切换 + response 行内编辑；`AddCommentSheet` tags 输入；`SubmissionRepository.swift` / `SubmissionService.swift` 补 `updateReviewComment`，2026-05-02）
- Experiment 关联投稿下拉选择（`ExperimentView.swift` CreateExperimentSheet + DetailView 编辑模式新增 submission Picker；列表/详情显示投稿标题，2026-05-02）
- SourceLookup 补充 WoS 索引 / OA / JIF 排名 / WOS 分类 chip / CCF 链接（`SourceLookupView.swift` journalCard + ccfCard 字段补全，2026-05-02）

---

## 后续执行建议

1. **第 0 阶段（数据安全）**：先修 R1-R4 四个互通风险点
2. **第 1 阶段（影响面最大的 P1）**：Copilot 附件/Skills（A1+A3）、ResearchWorkbench 五 Tab、KnowledgeGraphComposer、Submission 版本快照 content+AI 审稿、Experiment 附件 UI
3. **第 2 阶段（其余 P1）**：Settings Provider 预设/角色卡片、Tools Arxiv/SourceLookup/Translation、Survey 高级参数+多 Agent 流式
4. **第 3 阶段**：P2 体验优化
5. **第 4 阶段**：P3 细节打磨
