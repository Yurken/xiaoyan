# 小妍 0.4.0 版本规划

## 版本定位

0.4.0 的目标不是继续横向堆新入口，而是把 0.3.x 已经具备的论文、知识、实验、投稿、小妍协同与长期记忆能力收束成一个可持续推进科研任务的闭环版本，并借鉴 Hermes Agent 的 runtime / tool / event / memory 设计重构小妍自己的 Agent 内核。

版本主题：**研究闭环稳定版 + 小妍内核收束**。

建议周期：2026-05-12 至 2026-06-09。实际发布时间以核心验收项完成和桌面端发布质量达标为准。

## 背景

0.3.0 到 0.3.3 已完成大量能力铺底：

- 投稿管理、实验记录、AI 模拟审稿、版本快照与拒稿转投恢复已经形成作者侧工作流基础。
- 论文导入、正文抽取、图表提取、论文精读、复现建议与 Graph RAG 已经支撑研究材料处理。
- 长期记忆、记忆隐私分层、应用锁、设置快照与桌面伴侣已经增强了持续使用体验。
- 后端已开始按 commands / services 拆分，前端也开始沉淀 features，但仍需要避免继续把复杂逻辑塞回大页面。
- 当前小妍协同仍以固定 Agent 图和关键词规则选路为主，能跑通基础科研流程，但后续继续扩展主题、记忆、工具、投稿与实验链路时，需要更清晰的 runtime、工具层和事件协议。

因此 0.4.0 应重点解决“能力已经有了，但流程仍不够连贯、结果不够可追溯、解析质量不够稳定、工程结构还需继续收束”的问题。

## 产品目标

1. 让用户能从一个研究主题出发，连续推进“规划 -> 调研 -> 阅读 -> 笔记 / 图谱 -> 实验 -> 投稿”的完整链路。
2. 让论文解析结果更稳定、可回退、可比较，并为后续 MinerU 或多解析器接入打好能力层。
3. 让小妍长期记忆从“近期片段召回”升级为“会话 checkpoint + 实体关联 + 可控注入”。
4. 让投稿与实验模块形成证据链，减少投稿前自检、修改计划和审稿回复之间的断裂。
5. 让小妍从固定多 Agent 节点逐步升级为工具驱动的唯一助手内核：用户始终只面对小妍，背后由 runtime、context builder、tool registry 和统一事件流支撑。
6. 提升桌面端发布质量，保证结构性修改后能通过相关 type-check 和 lint。

## 当前实现进展

- 2026-05-15：已创建 `codex/xiaoyan-agent-runtime-0.4` 实现分支。
- 2026-05-15：已将 `chat.rs` 中的小妍多步骤运行入口拆为 `agent_runtime_service.rs`、`agent_routing_service.rs` 和 `agent_event_service.rs`，默认运行路径仍为 `XiaoyanNative`。
- 2026-05-15：已新增小妍 `AgentContext` builder 和领域 `AgentTool` registry 骨架，将小妍身份、任务边界、研究上下文与可用能力集中注入运行时。
- 2026-05-15：已把 `agent_graph` 的计划、步骤开始、步骤完成和文本增量收敛到统一 `AgentEvent`，同时保留现有 `chat:*` 事件映射以兼容前端。
- 2026-05-15：已将内部 prompt 文案从“外部/子 Agent”收束为“小妍内部步骤 / 专项能力”，避免生成内容中出现第二助手身份。
- 2026-05-15：已新增 `memory_session_summaries` 与 `memory_links`，小妍完成或失败一次会话后会写入轻量 checkpoint，并在长期记忆上下文中召回最近 checkpoint。
- 2026-05-15：已新增 `paper_parse_runs` 与 `paper_parser_service.rs`，现有 PDF 解析路径被包成默认 adapter，并记录解析状态、耗时、正文长度、预览长度、回退路径和错误。
- 2026-05-15：已将前端用户可见的协同文案从 Agent / 能力域模型收束为“小妍步骤 / 小妍能力”，保留内部协议字段不变。
- 2026-05-15：已新增 `research_context_service.rs` 聚合研究主题、路线阶段、关联论文、笔记、知识图谱主张和最近 checkpoint，并接入小妍对话上下文。
- 2026-05-15：已新增 `submission_diagnosis_reports` 与 `submission_diagnosis_service.rs`，现有 AI 模拟审稿完成后会保存投稿前诊断报告、风险等级和原始评审证据。
- 2026-05-15：已新增投稿诊断报告列表与“转清单”链路，清单页可查看最近诊断报告并将风险问题导入 `submission_checklist` 的“诊断”分类。
- 2026-05-15：已新增论文解析运行列表 API 与详情页解析质量摘要，展示最新解析器、耗时、正文/预览长度、章节/图表估算、回退路径和错误信息。
- 2026-05-15：已新增论文重解析命令与详情页入口，重解析会刷新正文、关键词和 chunks，但保留已有解读、复现指南和历史解析记录。
- 2026-05-15：已新增 `submission_revision_tasks`、诊断报告“转任务”与修改任务证据链，任务可关联论文版本和实验记录。
- 2026-05-15：已新增 checkpoint 列表 API，并在工作台把最近 checkpoint 转成“小妍续接 / 待继续事项”入口。
- 2026-05-15：已新增研究主题“总览”页，聚合路线、论文、笔记、小妍会话、checkpoint、知识主张、实验和关联投稿。
- 2026-05-15：P0 收口验证已通过 `cargo test`、desktop `type-check` / `lint` / `build`，以及仓库级 `pnpm type-check` / `pnpm lint`。
- 2026-05-16：已补充 0.4.0 更新日志，并通过 `node scripts/sync-version.mjs --tag v0.4.0` 同步桌面端、Web、Mobile 和共享包版本号。
- 2026-05-16：已修复桌面端 release 构建中的 Tauri API 兼容问题，并通过本机 `pnpm --dir apps/desktop exec tauri build --bundles dmg --ci --verbose --config '{"bundle":{"createUpdaterArtifacts":false}}'` 生成 `小妍_0.4.0_aarch64.dmg`。
- 2026-05-16：已补齐 macOS updater 发布脚本的签名私钥预检，缺少既有 release key 时会提前停止并给出配置说明。

## 非目标

- 不做云端多用户协作平台，不引入账号体系或远程团队空间。
- 不做审稿人端、编辑端或公开审稿社区。
- 不在 0.4.0 强制用 MinerU 替换现有 PDF 解析链路；只做可选能力层和样本验证。
- 不追求 Web / Mobile 与 Desktop 功能完全对齐；Desktop 仍是唯一开发优先级。
- 不新增大而全页面，不把远程调用、Tauri、副作用、节流、防抖或状态机逻辑继续留在页面 JSX 中。
- 不把 Hermes Agent 作为前端可见助手、不新增“切换到 Hermes”的用户模式、不让 Hermes 身份写入小妍记忆；Hermes 只作为架构参考或后续可选底层适配。
- 不在 0.4.0 直接复制或内嵌 Hermes Agent 的 Python runtime 到桌面端发布包；若做验证，只允许以开发期 sidecar / adapter 方式隔离评估。

## 必做能力

### 1. 研究主题闭环

目标：让研究主题成为串联规划、论文、笔记、图谱、实验和投稿的主对象。

交付项：

- [x] 统一研究主题详情视图，展示该主题下的规划结果、候选论文、知识笔记、实验记录、投稿条目和最近小妍会话。
- [x] 在工作台增加“继续当前研究”的入口，按最近活动和下一步建议排序。
- [ ] 论文、笔记、实验、投稿都能显式关联研究主题。
- [ ] 小妍对话在有研究主题上下文时，优先注入该主题的规划边界、关键论文和近期决策。
- [ ] 主题页只负责组合，数据聚合进入 `features/<domain>/` hook 或后端 service。

验收标准：

- 用户能从工作台进入一个研究主题，并看到下一步建议。
- 用户能从论文或实验回到所属主题，不需要手动跨页面寻找上下文。
- 主题上下文能被小妍引用，但不会把全文材料无控制塞进 prompt。

### 2. 论文解析与证据质量 2.0

目标：建立可切换、可回退、可比较的文档解析能力层。

交付项：

- [ ] 抽象论文解析 adapter，隔离 `pdf_extract`、`lopdf`、视觉扫描和未来 MinerU 接入。
- [ ] 保存解析产物元数据：解析器名称、耗时、错误、正文长度、章节识别结果、图表数量、回退路径。
- [ ] 在论文详情中展示解析质量摘要和重解析入口。
- [ ] 建立 10-20 篇代表性 PDF 样本的人工评估表，覆盖双栏、扫描版、公式密集、表格密集和图表密集论文。
- [ ] MinerU 先作为实验性可选解析器方案评估，不作为默认路径。

验收标准：

- 单篇论文解析失败时能清楚展示失败原因和可尝试的回退方案。
- 已导入论文可以选择重解析，不破坏原有分析记录。
- 解析 adapter 不直接写进页面组件，页面只消费结构化状态。

### 3. 长期记忆 checkpoint

目标：让小妍能跨会话恢复研究过程，而不是只召回零散 observation。

交付项：

- [ ] 新增 `memory_session_summaries`，记录每轮会话的目标、调查内容、已完成事项、开放问题、下一步。
- [ ] 新增 `memory_links`，把记忆关联到 `paper`、`knowledge_note`、`research_interest`、`submission`、`experiment` 等实体。
- [ ] 记忆检索升级为 observation + checkpoint 的混合召回，保留隐私分层校验。
- [ ] 在小妍会话结束后生成轻量 checkpoint，失败或取消也记录原因。
- [x] 在主题详情或工作台展示“最近决策”和“待继续事项”。

验收标准：

- 关闭应用后重新进入同一研究主题，小妍能恢复上次推进到哪里。
- 隐私保护开启时，敏感记忆详情仍需验证后查看。
- 记忆写入、检索与注入逻辑不落在页面 JSX 中。

### 4. 投稿前诊断与实验证据链

目标：把已有 AI 模拟审稿、版本控制和实验记录组织成投稿前自检闭环。

交付项：

- [ ] AI 模拟审稿升级为“投稿前诊断报告”，覆盖录用风险、创新性、方法可靠性、实验充分性、相关工作覆盖、写作清晰度和目标刊会适配度。
- [ ] 诊断报告可一键转为提交 checklist 或修改任务。
- [ ] 实验记录可关联论文版本和诊断问题，形成“问题 -> 实验补强 -> 新版本”的证据链。
- [ ] 审稿意见结构化解析进入第二优先级，至少完成数据结构和 UI 入口预留。
- [ ] 拒稿转投恢复时复用诊断报告、审稿意见和实验记录，生成下一轮修改计划。

验收标准：

- 用户选择一个论文版本和目标刊会后，可以生成投稿前诊断报告。
- 报告中的高风险问题能落到 checklist 或修改任务。
- 修改任务能追溯到实验记录或论文版本。

### 5. 小妍 Agent 内核重构

目标：借鉴 Hermes 的 runtime / tool / event / context 分层，但保留小妍为唯一产品身份与唯一对话主体。

交付项：

- [ ] 抽象 `AgentRuntime` 边界，定义统一的 `AgentRequest`、`AgentEvent`、`AgentResult` 和取消语义；现有 `run_agentic` / `agent_graph` 先包成 `XiaoyanNativeRuntime`，不改变默认行为。
- [ ] 将 `rule / llm / hybrid` 选路下沉为 `RoutingPolicy`，规则模式保留为稳定 fallback，不再作为页面或业务流程的硬编码扩展点。
- [ ] 将小妍领域能力工具化，优先覆盖研究主题上下文、论文库检索、论文全文读取、Graph RAG、记忆 checkpoint、投稿诊断和实验证据查询。
- [ ] 新增小妍版 context builder，集中组装小妍身份、当前研究主题、论文 / 笔记 / 实验 / 投稿上下文、记忆 checkpoint、隐私边界和工具使用约束。
- [ ] 统一 Agent 事件流，把计划、节点开始、工具开始、工具完成、产物生成、文本 delta、完成和失败都收敛为后端事件模型，再映射到现有 `chat:*` 前端事件。
- [ ] 协同台文案从“多个外部助手”收束为“小妍正在执行的步骤 / 工具 / 证据链”，避免用户感知到第二个助手身份。
- [ ] 保留 Hermes adapter 设计草案：只描述如何通过 API server / sidecar 接入，不作为 0.4.0 默认运行路径。

验收标准：

- 用户可见的助手身份始终是小妍，设置、会话、记忆、协同台和导出内容不出现 Hermes 作为回答主体。
- 现有小妍对话在默认配置下行为不回退；旧的固定 Agent 图可通过 `XiaoyanNativeRuntime` 继续运行。
- 新增工具或上下文能力时，不需要继续修改大段页面 JSX 或在 `chat.rs` 中追加关键词规则。
- Agent 事件能被协同台稳定消费，并可追溯到具体工具调用、证据来源或失败原因。

### 6. 结构收束与发布质量

目标：在 0.4.0 中显式偿还核心页面和功能域的结构债，避免功能越多越难改。

交付项：

- [ ] 对本版本触达的大页面执行“抽离后修改”：页面只组合区块，异步数据和副作用进入 hook。
- [ ] 每个新增功能域默认建立 `features/<domain>/`，共享常量、类型和纯函数进入 `shared.ts`。
- [ ] 后端新增业务逻辑优先进入 service，Tauri command 只做参数校验、权限边界和调度。
- [ ] 数据库 schema 变更必须包含向后兼容迁移，不破坏 0.3.x 用户数据。
- [ ] 更新 `CHANGELOG.md`、版本号同步脚本流程和发布检查清单。

验收标准：

- 相关包通过 `pnpm --filter @research-copilot/desktop type-check`。
- 跨工作区修改时通过 `pnpm type-check` 和 `pnpm lint`。
- 发布前至少完成 macOS 构建验证；Windows 构建按发布节奏补齐。

## 优先级

### P0：必须进入 0.4.0

- 研究主题闭环的最小可用链路。
- 论文解析 adapter 与解析质量摘要。
- 长期记忆 checkpoint 的数据结构、写入和召回。
- 投稿前诊断报告与 checklist / 修改任务联动。
- 小妍唯一助手内核重构的 runtime 接口、context builder、RoutingPolicy fallback 和统一事件流。
- 本版本触达页面的结构拆分和 type-check。

### P0 收口状态（2026-05-15）

- 已完成：研究主题总览与继续入口、论文重解析与解析质量展示、会话 checkpoint 写入 / 召回 / 工作台可视化、投稿诊断报告保存 / 转清单 / 转修改任务、小妍唯一助手 runtime 边界与事件流收束。
- 已验证：`cargo test`、`pnpm --filter @research-copilot/desktop type-check`、`pnpm --filter @research-copilot/desktop lint`、`pnpm --filter @research-copilot/desktop build`、`pnpm type-check`、`pnpm lint`。
- 发布前仍需：自动更新签名产物和上传链路验证；本机缺少 `TAURI_SIGNING_PRIVATE_KEY` / `~/.tauri/research-copilot-updater.key`，因此当前只完成无 updater artifacts 的 DMG 构建烟测。
- 后续增强：实验 / 投稿与研究主题的显式字段关联、MinerU 样本评估、审稿意见结构化解析和更完整的 Hermes adapter 草案。

### P1：尽量进入 0.4.0

- MinerU 样本基准评估与实验性入口。
- 主题详情中的最近决策、开放问题和下一步建议。
- 实验证据链在投稿页和实验页的双向入口。
- 审稿意见结构化解析的第一版。
- Hermes sidecar / API server 的开发期验证方案与适配器草案，默认关闭且不暴露给普通用户。

### P2：推迟到 0.4.x

- 多格式文档导入（DOCX / PPTX / XLSX）。
- MinerU sidecar API 或外部服务配置。
- Web / Mobile 的主题闭环展示。
- 更完整的审稿回复协作工作台。
- 完整 HermesRuntime 适配、Hermes 工具桥接和跨 runtime 会话迁移。

## 里程碑

### M1：架构与数据底座

- 明确研究主题闭环的数据聚合边界。
- 完成论文解析 adapter 设计。
- 完成 `memory_session_summaries`、`memory_links` 迁移设计。
- 梳理投稿诊断报告的数据结构。
- 完成小妍 `AgentRuntime`、`AgentEvent`、`RoutingPolicy`、context builder 的接口设计，确认 Hermes 仅作为参考实现不作为用户可见身份。

### M2：核心链路打通

- 主题详情最小可用。（已新增主题总览）
- 论文重解析与质量摘要可用。
- 会话 checkpoint 写入和召回可用。
- 投稿前诊断报告可生成并保存。
- 现有小妍多 Agent 流程通过 `XiaoyanNativeRuntime` 跑通，前端继续消费统一事件流。

### M3：联动与体验

- 工作台展示“继续当前研究”。（已接入最近 checkpoint 与小妍续接入口）
- 论文、实验、投稿与研究主题互相跳转。
- 诊断报告转 checklist / 修改任务。
- 小妍能引用主题上下文和 checkpoint。
- 小妍协同台展示工具驱动的执行步骤，旧 Agent 节点文案逐步收束为小妍的任务步骤。

### M4：发布收口

- 修复核心链路阻断问题。
- 补齐 changelog、版本号、发布说明。
- 跑桌面端 type-check；涉及跨包时跑仓库级 type-check 和 lint。
- 完成安装包构建与更新链路检查。

## 建议任务拆分

### 前端

- `features/research-context/`：主题聚合、继续研究、主题详情区块。
- `features/papers/`：解析质量摘要、重解析入口、解析状态展示。
- `features/memory/`：checkpoint 列表、隐私校验后的详情展示。
- `features/submission/`：投稿前诊断报告、checklist / 修改任务联动。
- `features/experiment/`：实验记录与论文版本、诊断问题关联。
- `features/copilot/`：统一 Agent 事件展示、工具步骤、证据链和小妍唯一助手文案收束。

### 后端

- `services/paper_parser_service.rs`：解析 adapter 调度、质量元数据、回退策略。
- `services/memory_checkpoint_service.rs`：会话 checkpoint 生成、检索与实体关联。
- `services/research_context_service.rs`：研究主题聚合查询。
- `services/submission_diagnosis_service.rs`：诊断报告生成与结果落库。
- `services/agent_runtime_service.rs`：小妍 Agent runtime 抽象、默认 runtime 调度、取消和结果归档。
- `services/agent_context_service.rs`：集中构造小妍身份、主题、记忆、实体上下文和工具约束。
- `services/agent_tool_service.rs`：把论文、知识图谱、记忆、投稿和实验能力整理为小妍可调用的领域工具。
- `commands/*`：只保留 Tauri 参数入口、校验和 service 调用。

### 数据库

- `paper_parse_runs`：记录每次解析运行与质量指标。
- `memory_session_summaries`：记录会话 checkpoint。
- `memory_links`：连接记忆与论文、笔记、主题、投稿、实验等实体。
- `submission_diagnosis_reports`：保存投稿前诊断报告。
- `submission_revision_tasks`：保存从诊断报告或审稿意见转出的修改任务。
- 复用并扩展 `agent_runs`、`agent_artifacts`：记录 runtime、工具步骤、证据摘要和失败原因；能复用时不新增重复表。

## 风险与应对

| 风险 | 影响 | 应对 |
|---|---|---|
| 研究主题闭环过大 | 版本延期、结构失控 | 先做聚合与跳转，不做复杂自动编排 |
| 论文解析适配器牵动旧链路 | 导入与分析回归 | 保留现有默认解析路径，adapter 先包住现有能力 |
| 长期记忆注入过多 | token 成本和回答漂移 | checkpoint 只注入摘要与引用索引，详情按需补充 |
| 投稿诊断报告过度依赖模型质量 | 输出不稳定 | 固定报告 schema，保留用户编辑和 checklist 转化 |
| 直接替换成 Hermes 导致小妍身份稀释 | 产品体验割裂、记忆归属混乱 | Hermes 只作为架构参考；用户可见身份、prompt、记忆和事件命名都归小妍 |
| Python sidecar 增加发布复杂度 | 安装包体积、权限、依赖和诊断成本上升 | 0.4.0 不默认内嵌 sidecar，只保留开发期验证方案 |
| 工具驱动内核权限过宽 | 本地文件、终端或外部服务调用风险 | 小妍领域工具优先，危险工具默认不进入 0.4.0 主路径；所有副作用进入 service/hook 边界 |
| 大页面继续膨胀 | 后续维护困难 | 触达即拆分，先抽 hook / feature 组件再加功能 |

## 发布验收清单

- [ ] 0.4.0 的 P0 项均已完成或有明确降级说明。
- [ ] 新增数据表带迁移和兼容策略。
- [ ] 旧用户数据库升级后核心页面可正常打开。
- [ ] 论文导入、论文详情、小妍对话、知识主题、实验记录、投稿管理主链路可用。
- [ ] 小妍仍是唯一助手身份；普通用户路径下无 Hermes 可见模式、可见助手名或记忆来源。
- [ ] 小妍 Agent runtime 默认路径、取消逻辑、事件流和旧会话兼容性完成验证。
- [x] `pnpm --filter @research-copilot/desktop type-check` 通过。
- [x] 跨工作区修改时 `pnpm type-check` 和 `pnpm lint` 通过。
- [x] `CHANGELOG.md` 已补充 0.4.0 条目。
- [x] 版本号通过 `node scripts/sync-version.mjs --tag v0.4.0` 同步。
- [x] macOS 本机 DMG 构建烟测通过，产物为 `小妍_0.4.0_aarch64.dmg`。
- [ ] macOS 安装包和自动更新链路完成验证。
