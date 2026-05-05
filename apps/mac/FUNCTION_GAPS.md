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
- **A5 流式中断 Stop 按钮** ✅（已对齐）：`CopilotComposerView.swift:173-186` 根据 `isStreaming` 条件渲染红色停止按钮（`xmark.circle.fill`），点击调用 `onStop` → `ChatThreadView.cancelActiveStream()`；发送按钮在流式中替换为停止按钮；`ChatThreadView:78-85` 透传 `isStreaming` + `onStop`
- **A6 流事件驱动 UI（plan / runs / sources）** ✅（已实现）：`ChatService.runAgentic()` 实时填充 `currentPlan`/`currentRuns`/`currentSources`；`MessageBubbleView.thinkPlanSection` 以 `DisclosureGroup` 渲染 plan 与 runs；`MessageBubbleView.sourcesRow` 渲染 sources 列表；与 desktop `Copilot.tsx:387-426, 871-892` 等价
- **A7 `<think>` 思考块解析与折叠展示** ✅（已实现）：`MessageBubbleView.splitThoughtFromContent()` 正则解析 `<think>...</think>`；`thinkContentSection` 折叠展示思考过程；与 desktop `splitThoughtFromContent` 等价
- **A8 Mission Control 全屏展开** ✅（已对齐）：`CopilotView.swift:19-74` 新增 `missionControlExpanded` 状态，展开时 MissionControlView 独占全屏并支持 `onKeyPress(.escape)` 收起；`MissionControlView.swift:21-46` 头部增加展开/收起按钮（`chevron.left` / `chevron.right`）；与 desktop `CopilotOverviewSidebar.tsx:39-117` 等价
- **A9 状态图非交互** ✅（已对齐）：`AgentStateGraphView.swift` 重写为交互式画布，新增 `buildAgentGraphLayout` 布局算法 + `Path.addCurve` 三次贝塞尔连线 + `SimultaneousGesture(MagnificationGesture + DragGesture)` 缩放拖拽 + `ScrollWheelHandler` 滚轮缩放 + active 边脉冲动画 + 节点卡片状态色/阴影；与 desktop `AgentStateGraphPanel.tsx` 等价
- **A10 Artifact Markdown 渲染与外链** ✅（已对齐）：`MissionControlView.swift:241-243` 将 artifact 内容从 `Text(content).lineLimit(5)` 替换为 `MarkdownText(content: content)`，支持完整 Markdown 渲染（标题/列表/链接/代码块）与外链点击；与 desktop `CopilotOverviewSidebar.tsx:177-181` 等价
- **C2 Artifact 导出/复制 markdown 入口** ✅（已对齐）：`MissionControlView.swift:237-248` 每条 artifact 卡片右上角增加「复制」按钮（`doc.on.doc`），点击将 `artifact.content` 写入 `NSPasteboard`；与 desktop `CopilotOverviewSidebar.tsx` 复制入口等价

### P3
- **A11 删除会话二次确认 / 兴趣组级删除** ✅（已对齐）：兴趣组级二段确认（A4 已对齐）；单会话删除新增 `.confirmationDialog`（`CopilotView.swift:143-155`），确认后执行 `deleteSession`；与 desktop 二次确认交互等价
- **A12 Memory chat.query 摘要写入** ✅（已对齐）：`ChatService.swift:480` `recordMemoryEvent` 已将 `String(query.prefix(100))` 写入 `MemoryEvent.summary`；与 desktop memory 写入等价
- **A13 主题文件夹下拉、未归类分组、CollapsibleGroup** ✅（已对齐 A4）
- **A14 Composer 默认提示（仅附件无文本时）** ✅（已实现）：`ChatThreadView.swift:221` 当 `trimmed.isEmpty` 且存在附件时，自动注入 `"请阅读上传的文件并回答。"`；与 desktop `DEFAULT_ATTACHMENT_PROMPT` 等价
- **A15 Enter / Shift+Enter 行为** ✅（已对齐）：`CopilotComposerView.swift:169-180` `TextEditor` 添加 `.onKeyPress(phases: .down)`，Return 键无 Shift 时发送消息（`onSend()`），Shift+Return 时插入换行（`inputText.append("\n")`）；与 desktop Enter/Shift+Enter 行为等价
- **C3 AgentRun summary**：mac 写死"执行完成/综合完成"（`ChatService.swift:281, 317`），desktop 来自后端真实摘要

---

## 2. Home / Workbench

### P1
- 无（功能基本对齐）

### P2
- **B2 Risks 状态机字段映射 bug** ✅（已修复）：`WorkbenchModel.swift:427-428` 移除 `.parsed` 误归类；`failedPapers` 仅保留 `.failed`，`processingPapers` 仅保留 `.parsing`；与 desktop `model.ts:281-282` 一致
- **B3 Submission 最近截止排序** ✅（已修复）：`WorkbenchModel.swift:313` 增加 `.sorted(by: { $0.deadline < $1.deadline })` 显式排序后再取 `.first`；与 desktop `model.ts:170` 显式排序对齐（repository SQL 已带 `ORDER BY deadline ASC`，模型层补显式语义）
- **B1 三列快捷卡 Sparkles 提示行** ✅（已对齐）：`HomeView.swift:235-297` 在快捷卡下方新增 `sparklesPromptRow`（`CardView(variant: .inset)`），左侧 `sparkles` 图标 + 右侧三列（规划/小妍/知识）带图标标题与描述链接；与 desktop `OverviewWorkspace.tsx:345-388` 1:1 对齐

### P3
- **B4 空状态文案"暂无研究主题"占位卡** ✅（已对齐）：`HomeView.swift` 在研主题 section 在 `model.interests.isEmpty` 时显示 `emptyPlaceholder` 虚线边框占位文案（"暂无研究主题。先从一个研究问题开始，小妍会帮你搭起路线。"）；与 desktop `OverviewWorkspace.tsx:308-311` 等价
- **B5 助理头像/品牌 Logo** ✅（已对齐）：新增 `BrandLogo.swift` 组件（`Bundle.module` 加载 SVG），`ChatThreadView.swift` welcomeView 空状态从 `sparkles` 替换为 `xiaoyanv.svg`；`ResearchWorkbenchView.swift` header 新增 `app-logo.svg`；`Package.swift` 注册 `Resources/brand-logos`；4 张品牌 SVG 从 desktop `assets/` 复制到 mac

---

## 3. Knowledge / Planner

### P1
- **TopicDiscoveryWizard** ✅（2026-05-02 已对齐）：4 步领域→目标→背景→候选话题向导 — desktop `TopicDiscoveryWizard.tsx:33-202`；mac `Features/Knowledge/TopicDiscoveryWizardView.swift` + `KnowledgeView.CreateInterestSheet` 顶部入口
- **PlannerComposer 8 字段研究画像** ✅（已对齐）：`KnowledgeView.swift:755-860` CreateInterestSheet 扩展为 8 字段（timeBudget / constraints / knownContext / preferredOutput）+ 完成度进度条；1:1 desktop `PlannerComposer.tsx:30-50, 343-727`
- **AI 实时智能提示边栏** ✅（已对齐）：`CreateInterestSheet` 新增右侧智能提示边栏，`HSplitView` 分左右两栏；700ms debounce 调 `KnowledgeService.generateInterestHints` + 本地 fallback `buildPlannerSuggestions` 合并；状态 badge（小妍处理中/实时建议/本地兜底/待输入）+ 系统理解/建议下一步/已识别方向 chip/补字段说明 四卡片；fallback 时琥珀色错误提示；1:1 desktop `PlannerComposer.tsx:178-248, 645-705` + `plannerSuggestions.ts`
- **ResearchWorkbench 五 Tab 工作台** ✅（已对齐）：planner/papers/xiaoyan(chat)/notes/tools 集成 — desktop `ResearchWorkbench.tsx:1-520`；mac `ResearchWorkbenchView.swift` 五 Tab 容器 + header（返回/标题/统计徽章/SegmentedPicker）+ Planner Tab 复用 `LearningPathView` + Papers Tab `ScopedPapersView` + Xiaoyan Tab `InterestScopedCopilotView`（复用 `ChatThreadView`）+ Notes Tab `ScopedNotesView` + Tools Tab 嵌入 `ToolsView`；入口：`HomeView` interest card 点击/工作台按钮 + `KnowledgeView` interest 行内按钮；`AppRouter.workbenchInterestId` 导航状态

### P2
- ✅ **PDF 参考文献预上传**：`CreateInterestSheet` 新增「选择 PDF」按钮（`.fileImporter` 多选 PDF），选中文件列表展示（带移除按钮）；点击「创建并导入」后先 `knowledgeService.createInterest` 创建方向，再循环调用 `paperService.upload(fileURL:settings:researchInterestId:)` 上传并绑定到该方向；支持 `submitPhase` 状态（idle/creating/uploading）+ 上传失败提示；`PaperService.upload` 新增 `researchInterestId` 可选参数；与 desktop `PlannerComposer.tsx:54-95, 250-302, 593-642` 等价
- ✅ **Interest 状态机 (planning/planned/active)**：`KnowledgeService.createInterest` 初始 `status` 从 `"active"` 改为 `nil`（待规划）；`generateLearningPath` 在生成前设置 `status = "planning"` 并更新 DB，成功时设为 `"planned"`，失败时回滚为 `nil`；`InterestListRow` 新增 `StatusBadge` 组件（已规划/生成中/待规划三色徽章），按钮逻辑从 `learningPath != nil` 改为 `status == "planned"` / `"planning"` / `nil` 三态；与 desktop `InterestsPanel.tsx:23-27, 256-322` 等价
- **InterestProfilePanel 研究画像高亮** ✅（已对齐）：`InterestListRow` 新增 `profileSection` + `profileHighlights` 计算属性，展示 goal（"目标"）/ timeBudget（"时间"）/ preferredOutput（"输出"）三卡片 + constraints chip 列表；内联卡片样式使用 `Theme.Colors.surface` + `nmShadow`；与 desktop `InterestProfilePanel.tsx` 等价
- **多 Agent 实时工作流 UI**：mac 是本地 `simulateWorkflow()` 假模拟（`PlannerView.swift:441-475`），desktop 接 `interest:agent_start/complete/error` 事件流
- **文件夹名编辑、删除确认（保留/全删）** ✅（已对齐）：删除确认（"置为未归档"/"删除全部"）已在 `NotesInterestSection` 实现；文件夹名编辑新增 `EditFolderNameSheet` + `KnowledgeService.updateInterestFolderName` 方法；`InterestListRow` 右键菜单新增"编辑文件夹名"入口，`InterestListRow` 标题优先显示 `folderTitle`（fallback 到 `topic`）；与 desktop `InterestsPanel.tsx` 等价

### P3
- **重新规划 (regenerate) 入口** ✅（已对齐）：`InterestListRow` 在 `learningPath != nil` 时显示「重新规划」按钮（`borderless` + `.secondary`），点击触发 `.confirmationDialog` 确认后覆盖重跑；与 desktop `InterestsPanel.tsx` 重新生成入口等价

---

## 4. Notes（笔记）

### P1
- **研究方向分组视图** ✅（2026-05-02 已对齐）：DisclosureGroup 按 interest 分组（folder_name||topic + 副标题 + 计数 + 删除两选项）+ "未归档笔记" 独立 Section；搜索/语义搜索时回退平铺 — `KnowledgeView.swift` `groupedNotesList` + `NotesInterestSection`，`KnowledgeService.deleteInterestBundle/Only` 暴露
- **笔记关联 interest（research_interest_id）** ✅（2026-05-02 已对齐）：CreateNoteSheet 与 NoteDetailView 编辑模式新增"关联研究方向"Picker；预览模式元数据栏展示已绑定方向 — `KnowledgeView.swift` 内

### P2
- **Markdown 实时预览编辑器** ✅（已对齐）：`NoteDetailView.swift` 编辑模式新增 `EditorTab`（编辑/预览）Picker + `MarkdownText` 预览；`CreateNoteSheet.swift` 内容输入区替换为 `noteContentField` 双 Tab 编辑器（TextEditor / MarkdownText）；与 desktop `NotesPanel.tsx:8-74` `MarkdownEditor` 等价
- **图谱关联计数 Badge** ✅（已对齐）：`KnowledgeRepository` 新增 `listAllEvidenceLinks()`；`KnowledgeView` 新增 `noteClaimCounts` 状态 + `buildNoteClaimCounts()` 按 `sourceKind == "note"` 聚合计数；`NoteRow` 新增 `linkedClaimCount` 参数，标题旁显示蓝色"图谱 N" badge；`NotesInterestSection` header 显示"图谱关联 M/N"计数；分组/平铺/搜索模式均已接入；与 desktop `NotesPanel.tsx` 等价

### P3
- **侧滑详情面板与返回动效**：mac 是 NavigationSplitView detail
- ✅ **来源类型徽标分类（manual/paper_analysis/survey/web_clip）UI 弱**：新增 `noteSourceLabel` + `noteSourceIcon` 全局辅助函数（`Knowledge.swift`），映射 manual→手动/论文分析→论文分析/survey→综述/web_clip→网页摘录；`NoteRow` 头部显示来源类型灰色 badge + 非 manual 时显示"小妍"紫色 badge；`NoteDetailView` 元数据栏使用本地化标签与对应图标；`KnowledgeGraphCanvasView.noteInspector` 同步替换为图标+标签组合；与 desktop `NotesPanel.tsx:sourceLabel` 等价（2026-05-02）

---

## 5. KnowledgeGraph

### P1
- ✅ **KnowledgeGraphComposer 图内 CRUD（新增 Claim/Evidence/Citation 三件套）**：`KnowledgeGraphComposer.swift` 常驻内联面板，三卡片表单（claim/evidence/citation），dropdown 从 snapshot 拉取；toolbar「+ 论断」展开 composer 而非弹 sheet
- ✅ **可缩放 Canvas + 三泳道贝塞尔布局**：`GraphEdgeOverlay.swift` 使用 AnchorPreferenceKey + Path 绘制 quadratic bezier 边线（evidence 实线绿、citation 虚线紫）；`KnowledgeGraphCanvasView` 移除 ScrollView，改用 `simultaneousGesture(magnification + drag)` 驱动 `scaleEffect`（0.6–2.2）+ `offset` 平移
- ✅ **KnowledgeClaimPanel 图谱页 claim+证据 bundle**：`KnowledgeClaimPanel.swift` 常驻 inspector，按 claim 分组展示 provenance items（来源标题映射、relation badge、summary），支持展开/折叠、删除 claim、解绑 evidence
- **R2 Claim 状态枚举不一致**（参见 §0）

### P2
- ✅ **KnowledgeGraphInspector 多类型节点详情**：`KnowledgeGraphCanvasView.nodeInspector` 重写为按节点类型分分支展示：claim（statement + 证据计数 badge + provenance 列表）、interest（关键词 chip + 目标/时间画像）、paper（年份/venue/作者 + keyConclusions/notes）、experiment（notes）、note（来源类型 + content）；与 desktop `KnowledgeGraphInspector.tsx:1-152` 等价
- ✅ **KnowledgeTimelinePanel 按年聚合时间线**：`KnowledgeGraphCanvasView` 新增 `timelinePanel`（横向滚动时间线），`KnowledgeGraphTimelineEntry` 支持 interest/paper/claim/experiment 四种事件类型；按年分组聚合，每年一列卡片列表，每条含图标 + 标题 + 类型标签 + 详情 + 日期；过滤方向时自动同步过滤时间线事件；最多展示最近 24 条；与 desktop `KnowledgeTimelinePanel.tsx:1-91` 等价
- ✅ **聚焦研究方向过滤器**：`KnowledgeGraphCanvasView` 顶部 Picker 过滤整图（从 snapshot.interests 构建），过滤后仅显示该 interest 下的节点和边线

### P3
- ✅ **MetricTile 概览（4 大指标卡 vs mac 7 个内联小数字）**：`KnowledgeGraphCanvasView` 顶部指标从 7 个内联小数字替换为 4 张卡片（研究方向 / 结论节点 / 证据关系 / 引用边），样式参考 `KnowledgeGraphWorkspace.tsx:12-32`（大字号数值 + 小写标签 + surface 背景 + 圆角阴影）

### Mac 反向超出 desktop（保留）
- **GraphAnalysisPanel**：中心性 / 最短路径 / 子图算法面板（`GraphAnalysisPanel.swift:1-301`），desktop 无对应

---

## 6. Survey（综述）

### P1
- **结构化 schema 大幅缩水** ✅（已对齐）：desktop 14 项；mac `SurveyService.swift` 14 项 Codable 数据模型 + `SurveyView.swift` 独立 view builder 展示全部 section（背景/发展脉络/方法/学派/方法总结/趋势/争议/挑战/缺口/未来方向/建议主题/总结/参考文献）
- **多 Agent 真实流式** ✅（已对齐）：`SurveyService.swift` 5-Agent 真实流水线（Planner→Retriever→Timeline→Writer→Formatter），`SurveyView.swift` agentFlowSection 实时展示 agent_start/complete/fail 状态
- **高级参数面板** ✅（已对齐）：`SurveyView.swift` + `SurveyParameterPanel.swift`（5 类 Picker：时间范围/文献类型/数据库/引用格式/语言），prompt 已注入参数约束；1:1 desktop `SurveyPanel.tsx:94-117, 532-647`

### P2
- ✅ **研究方向→论文勾选**：`SurveyView.swift` 左侧边栏新增研究方向列表（自由检索 + 各方向文件夹），选中后自动加载该方向下论文并展示可勾选列表（全选/取消全选），勾选状态实时显示计数（已选/总数），生成综述时通过 `selectedPaperIds` 传给 `SurveyService.generate`；`SurveyService.runPipeline` 优先 `paperRepo.fetchByIds` 加载用户选定论文，不足时再用本地/外部检索补充；与 desktop `SurveyPanel.tsx:148-230, 410-480` 等价（2026-05-02）
- **formatted_citations / citation_format 输出与导出** ✅（已对齐）：`SurveyService.swift:672-718` 实现 APA/MLA/IEEE/GB-T-7714 四种引用格式；`StructuredSurveyResult` 携带 `formattedCitations` + `citationFormat`；`SurveyView.swift` `citationsSection` 展示格式化参考文献并支持一键复制；新增「导出 Markdown」按钮将完整综述写入文件（`NSSavePanel`）

### P3
- **历史记录持久化** ✅（已对齐）：`SurveyRecord` 改为 `Codable`，`UserDefaults` 存储 JSON 数据；`onAppear` 加载、`didProduceStructured` 保存；最多保留 50 条
- **CCF 标识与 venue 链接** ✅（部分对齐）：SurveyView `papersView` 标题改为 `Link`（`paper.paperUrl`）+ DOI 改为 `Link`（`https://doi.org/...`）；CCF 等级/类型 badge 仍缺本地数据源（`match_venue` 索引），后续可引入 `ccf_catalog.json`

---

## 7. Settings

### P1
- **S2 加密导入/导出 UI 退化** ✅（已对齐）：`CryptoConfigModal.swift`（双输入确认 + hint + 错误分离）+ `ImportExportSettingsTab.swift` 按钮入口；1:1 desktop `CryptoConfigModal.tsx`
- **S11 Skills 编辑/新建/导入** ✅（已对齐）：`SkillsSettingsTab.swift` 自定义技能卡片增加编辑/删除图标 + "新建技能"按钮；`SkillEditSheet` 新建/编辑技能表单（name/title/description/prompt/tags），内置技能支持"恢复默认"；`SkillRepository` insert/update/delete 已就绪；1:1 desktop `SkillsSection.tsx` SkillEditModal

### P2
- **S1 标签分组结构错位** ✅（已对齐）：`SettingsView.swift:18` `taskSetup` Tab 显示名改为"快速开始"；新增 `TaskSetupSettingsTab.swift` 三步引导卡片（接通小妍 / 补任务分工 / 启用多 Agent）+ 状态点 + 底部建议卡片；与 desktop `pageConfig.tsx:24-87` + `TaskSetupSection.tsx` 等价
- **S5 配置历史快照粗糙** ✅（已对齐）：`ImportExportSettingsTab.swift` 快照区重写，新增命名输入框 + `Picker` 快速切换 + 应用/删除前 `confirmationDialog` + 元信息 chip（provider / chat model / search engine / 多 Agent）+ 三态 loading（`applyingId` / `deletingId` / `historyBusy`）；与 desktop `SettingsHistorySection.tsx:1-298` 等价
- **S6 TaskSetup 内容职能错位** ✅（已对齐）：`TaskSetupSettingsTab.swift` 重写为"快速开始"三步引导（`connectionReady` / `rolesReady` / `multiAgentReady`）+ 状态点 + 论文库建议卡片；原 default_temperature / chunk_size / auto_analyze 等运行参数迁入 `GeneralSettingsTab.swift`；与 desktop `TaskSetupSection.tsx` 等价
- **S7 内存清理策略不全** ✅（已对齐）：`MemorySettingsTab.swift` 自动操作记录显示来源 chip（聊天/能力域模型/知识笔记）；长期记忆观察显示 `importance` badge（高相关/常规/记录）+ 来源 chip + 完整列表（取消 20 条限制）；新增 `isLoading` 状态与空状态文案；与 desktop `MemorySection.tsx:113-132` 等价
- **S8 关于页 in-app 安装** ✅（已对齐）：`AboutSettingsTab.swift` 新增"下载并安装"按钮（调用 `UpdatesService.downloadAndInstall(url:)` → `URLSession.download` + `NSWorkspace.open`）；版本信息网格化（当前版本/最新版本/发布日期）；`UpdatesService.swift` 新增 `downloadAndInstall` 方法；与 desktop `AboutSection.tsx:38-130` 等价
- **S9 布局/主题对齐度** ✅（已对齐）：`LayoutSettingsTab.swift` 新增布局模式 Picker（landscape/focus）+ `DefaultSettings` 新增 `layout_mode`；`GeneralSettingsTab.swift` 与 `LayoutSettingsTab.swift` 新增 `ThemeSwatchCard`（auto/light/dark 颜色块预览）与 `StylePreviewCard`（minimal/neumorphic 迷你卡片预览）；与 desktop `LayoutSettingsSection.tsx` 等价

### P3
- **S10 paper_visible_venue_tags 可视化标签管理** ✅（已对齐）：`PaperSettingsTab.swift` 新增"论文标签显示" card，6 项 Toggle 开关（CCF/期刊会议/WoS/JCR/中科院/Top）；`DefaultSettings` 新增 `paper_visible_venue_tags` 默认值；序列化/反序列化逻辑与 desktop `lib/paperTags.ts` 等价
- **S12 ChangelogCard 静态硬编码** ✅（已对齐）：新建 `ChangelogParser.swift` 运行时解析 `CHANGELOG.md`（`## [x.y.z] - YYYY-MM-DD` + `### 分类` + `- 条目`）；`ChangelogSettingsTab.swift` 改为动态加载 + 版本选择 `Picker`；找不到文件时 fallback 到硬编码；与 desktop `SettingsChangelogCard.tsx` 等价

---

## 8. Tools

### P1
- **T1 Arxiv 字段检索** ✅（已对齐）：`ArxivSearchView.swift` 11 字段表单（通用/标题/摘要/作者/备注/期刊/排除词 + 分类多选面板 + 最近天数/返回篇数/排序模式）；`ArxivClient.swift` `SearchRequest` + `buildQuery` 多字段拼接（all/ti/abs/au/cat/co/jr + submittedDate + ANDNOT 排除）+ `filterRecent`；分类面板 4 大领域 32 标签；1:1 desktop `ArxivFieldSearchPanel.tsx:114-253` + `useArxivFieldSearch.ts`
- **T4 SourceLookup 学术信号** ✅（已对齐）：`SourceLookupView.swift` journalCard 新增索引徽章行（indexes + JCR/CAS/Top/OA 彩色标签）+ eISSN/JIF 排名/JCR 分类字段 + WOS 分类 chip 列表；ccfCard 标题改为 Link + CCF 等级徽章样式 + 出版商字段；1:1 desktop `SourceLookupPanel.tsx:75-137`
- **T5 Translation 多语言** ✅（已对齐）：`TranslationView.swift` 源/目标语言 Picker（zh/en/ja/de/fr + auto），prompt 动态注入语言名；1:1 desktop `TranslationPanel.tsx:20-35`
- **T8 FriendLinks 数据完整度** ✅（已对齐）：desktop `yanweb-links.ts` 21 分类 187 条 + icon 字段完整迁移至 mac；`FriendLinksView.swift` 替换为完整数据集，`FriendLinkItem` 新增 `icon: String?`；181 个图标文件从 `desktop/public/friend-link-icons` 复制到 `mac/Resources/friend-link-icons` 并在 `Package.swift` 注册；视图使用 `Bundle.module.url(forResource:withExtension:subdirectory:)` + `NSImage(contentsOf:)` 加载本地图标，失败回退 `link.circle` 系统图标

### P2
- **T2 PaperDiscovery 排序模式** ✅（已对齐）：`PaperDiscoveryView.swift` modeOptions 将 "quality" 重命名为 "submittedDate"，描述改为"按 arXiv 提交时间排序"，消除误导；sortBy 直接透传 mode，与 arXiv API 原生排序语义一致；与 desktop 两档选项结构等价（mac 端因无后端 quality 预测能力，采用时间排序作为第二档）
- **T3 PaperDiscovery 动态期刊列表**：mac 仅静态 `computeStaticVenues`（`PaperDiscoveryView.swift:31-37`）；desktop `usePaperDiscoverySearch.ts` + `PaperDiscoveryPanel.tsx:64-89` 含 `dynamicJournalTerms` 异步合并
- **T6 MarkdownFormatter 分块进度** ✅（已对齐）：`MarkdownFormatterView.swift` 重写为分块处理：按段落分割（`\n\n`）+ 1500 字上限分块 + 逐块调用 LLM + 第一块后生成 `styleSummary` 并注入后续块 system prompt + 进度条显示（`MarkdownProgress` + `ProgressView`）+ 上传文件按钮；与 desktop `useMarkdownFormatter.ts` 等价

### P3
- ✅ **T9 ArxivSearchResults 排版退化**：`ArxivEntryRow` 从简单 List 行重写为卡片布局：顶部 category + published 徽章、标题链接（`Link` 到 arXiv 摘要页）、作者、280 字摘要片段、摘要页/PDF 操作按钮；结果区新增 meta 卡片（共 N 篇 + 检索式）；使用 `Theme.Colors.surface` + `nmShadow` 卡片样式；与 desktop `ArxivSearchResults.tsx` 卡片排版等价（2026-05-02）
- ✅ **T10 Tools 入口页**：`ToolsView.swift` 重写为带标题头（"实用工具" + 副标题）+ 自定义图标标签栏（7 个工具 tab，每个含 SF Symbol 图标 + 文字），标签栏容器使用 `Theme.Colors.surface` + `nmShadow(inner)` 凹陷风格，选中项使用 `nmShadow(soft)` 凸起风格；与 desktop `Tools.tsx` 分段标签栏 + 图标排版等价（2026-05-02）

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
- **删除主题文件夹（保留/全删）** ✅（已对齐）：`PapersView.swift` 分组列表 Section header 新增删除按钮（trash 图标），点击后展开内联确认栏（"保留论文" / "删除全部" / 取消）；调用 `KnowledgeService.deleteInterestOnly/Bundle`；与 desktop `Papers.tsx` 等价
- **Reproduction sections 字段对齐** ✅（已对齐）：`ReproductionGuide` 模型扩展为 14 字段（新增 dataset_preparation/training_process/inference_process/evaluation_metrics/risks_and_notes/raw_guide）；`PaperRepository` 读写 SQL 同步扩展；`PaperDetailView.reproductionView` 按 desktop 顺序（代码仓库→环境→依赖→数据→训练→推理→评估→步骤→预期→风险→备注→原始）展示全部非空 section；`AnalysisSection` 自动隐藏空内容
- **图片缩放/Lightbox + caption-figure 关联** ✅（已对齐）：`PaperFiguresView.swift` 重写为 `ZStack`，`FigureCard` 新增 `onTap` 回调；点击后弹出全屏 Lightbox overlay（黑色背景 + 大图 + 图号/caption + 点击/Escape 关闭）；与 desktop `PaperDetailModal.tsx` 图片点击放大交互等价

### P3
- ✅ **重新解读确认**：`PaperDetailView` 在 `hasAnalysis` 时显示「重新解读」按钮（`arrow.clockwise` 图标），点击弹出 `.confirmationDialog` 确认「重新解读会覆盖现有分析结果，确认继续？」，确认后调用 `analyzePaper` 复用原有分析逻辑覆盖更新；与 desktop `Papers.tsx:800-816` 等价（2026-05-02）
- ✅ **重要性颜色色环/色条**：`PaperRow` 新增顶部 importance color 色条（3px `Rectangle` + `.overlay(alignment: .top)`），有重要性标记的论文卡片顶部显示对应颜色条；`PaperMetadataEditor` 将重要性颜色 `Picker` 替换为横向颜色 swatch 按钮行（`ColorSwatchButton`），每个色块为 28px 圆形，选中时显示 `checkmark` 图标，空选项显示空心圆；与 desktop `Papers.tsx:585` 顶部色条 + `Papers.tsx:866-890` 色块选择器等价（2026-05-02）
- ✅ **Memory 自动事件**：`PaperService` 新增 `recordPaperMemory` 双写 helper（`MemoryEvent` + `MemoryObservation`，解决 mac 只写 event 不写 observation 导致 memory 无法被读取的问题）；在 `upload()` 成功后记录 `paper.uploaded`、分析成功后记录 `paper.analyzed`、`PaperDetailView.onAppear` 记录 `paper.viewed`；与 desktop 自动事件语义等价（2026-05-02）

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
- ✅ **Venue 模板库 + 区域/类型筛选 + 已追踪标记**：新增 `VenueTemplateLoader.swift` 运行时解析 `venue_templates.json`（151 条 CCF 推荐会议/期刊）；`VenuesListView` 新增「从模板添加」按钮打开 `AddVenueTemplateSheet`（搜索框 + 领域 Picker + 会议/期刊/全部类型筛选 + 网格卡片列表）；每张卡片展示 venue 名称（Link）、全称、CCF 等级徽章、类型标签、SCI/EI 徽章、领域、添加按钮；已追踪 venue 显示绿色 checkmark 并置灰；`Package.swift` 注册 JSON 资源；与 desktop `AddVenueModal.tsx:1-230` 等价
- ✅ **Review 轮 verdict 自动派生**：`ReviewRoundsView.swift` 新增 `dominantVerdict(for:)` 按评论 verdict 多数决自动推导；round header 显示 `round.verdict ?? dominantVerdict(for: round)`；`AddCommentSheet` 增加 verdict Picker（accept/minor_revision/major_revision/reject）；`CommentRow` 头部显示 verdict badge；`DatabaseManager.swift` 迁移 `v5_review_comment_verdict` 新增 verdict 字段；`Submission.swift` / `SubmissionRepository.swift` 模型与存储层同步扩展；与 desktop `getDominantVerdict` + `ReviewEntryModal.tsx` verdict 选择等价（2026-05-02）
- **Polish 结果回写到版本** ✅（已对齐）：`CoverLetterView.swift` 新增版本选择 `Picker`（加载选中投稿的版本列表，选择后自动填充版本 content 到输入区）；润色结果区新增「应用到版本」按钮（仅 polish 模式且选择了版本时显示），点击后调用 `service.updateVersion` 回写 content；与 desktop `PolishPanel.tsx`「应用到版本」等价

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
- **Config 自由 JSON** ✅（已对齐）：`ExperimentRecord.config` 已使用 `[String: JSONValue]`，`JSONValue` 枚举支持 null/bool/number/string/array/object 六种类型；`ExperimentView.swift` `configView` / `startEditing` / `saveChanges` / `CreateExperimentSheet` 均已接入 `JSONValue` 编码解码；与 desktop `Record<string, unknown>` 等价

### P3
- ✅ **新增即编辑流程**：`ExperimentView` 移除 `CreateExperimentSheet` 弹窗，改为 `createAndEditExperiment()` 直接创建默认标题为"新实验"的记录并立即选中；`ExperimentDetailView` 新增 `@Binding var autoEditId` + `@FocusState var titleFocused`，在 `.onAppear` 中检测到新建记录时自动进入编辑模式并聚焦标题输入框；与 desktop `Experiment.tsx:270-287` 等价（2026-05-02）

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
- Arxiv 字段检索从 4 字段扩展到 11 字段 + 分类多选面板（`ArxivSearchView.swift` + `ArxivClient.swift` SearchRequest + buildQuery，2026-05-02）
- Skills 编辑/新建/导入（`SkillsSettingsTab.swift` SkillEditSheet + 自定义技能行内编辑删除；内置技能恢复默认，2026-05-02）

---

## 后续执行建议

1. **第 0 阶段（数据安全）**：先修 R1-R4 四个互通风险点
2. **第 1 阶段（影响面最大的 P1）**：Copilot 附件/Skills（A1+A3）、ResearchWorkbench 五 Tab、KnowledgeGraphComposer、Submission 版本快照 content+AI 审稿、Experiment 附件 UI
3. **第 2 阶段（其余 P1）**：Settings Provider 预设/角色卡片、Tools Arxiv/SourceLookup/Translation
4. **第 3 阶段**：P2 体验优化
5. **第 4 阶段**：P3 细节打磨
