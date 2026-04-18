# 小妍长期记忆规划

## 当前进度（2026-04-18）

### 已完成

- `设置 -> 小妍` 已增加长期记忆总开关，关闭后不再自动写入和注入长期记忆。
- 已落地 `memory_events` 与 `memory_observations` 两层数据结构。
- 已接入聊天主链路：提问、回答完成、回答失败。
- 已接入 `agent_runs` 完成 / 失败事件。
- 已接入知识笔记创建、更新、移动、删除，以及 `web_clip` 导入事件。
- 记忆管理页已能查看长期记忆 observation。
- 聊天注入已从“只看最近 observation”升级为“按当前问题做相关召回，再回退到近期高价值 observation”。

### 进行中

- observation 仍是模板化压缩，尚未引入异步 AI 压缩 worker。
- 召回已具备 query-aware 能力，但还不是 FTS5 / embedding 混合检索。
- 还没有 session checkpoint summary，也没有 `memory_links`。

### 下一步优先级

1. 引入 `memory_session_summaries`，沉淀阶段性 checkpoint。
2. 为 observation 建立更稳的检索层：FTS5 和向量召回二选一或组合。
3. 把 papers / knowledge graph / submission 关键动作接入统一事件流。
4. 为 observation 增加“提升为笔记 / claim / 待办”的升级路径。

## 背景

当前仓库已经有两类“记忆”能力：

- 研究知识记忆：论文、知识笔记、知识图谱、claim/evidence/citation 已能沉淀长期研究材料。
- 对话辅助记忆：`user_memories` 会保存手动备忘和部分自动记录，并在 `run_chat()` 中压缩后注入给小妍。

现状的问题不在于“完全没有记忆”，而在于长期记忆仍停留在“摘要拼接”阶段，还没有形成稳定的过程记忆架构。

## 当前实现

### 已存在能力

- `apps/desktop/src-tauri/src/commands/memory.rs`
  负责统一写入长期记忆事件、结构化 observation，并聚合手动备忘、自动记录与 observation 上下文。
- `apps/desktop/src-tauri/src/commands/chat.rs`
  在 `run_chat()` 中触发聊天事件沉淀，并把 query-aware 的长期记忆上下文拼进系统提示。
- `apps/desktop/src-tauri/src/services/memory_retrieval_service.rs`
  负责 observation 的相关召回和上下文压缩。
- `apps/desktop/src-tauri/src/db.rs`
  已包含 `memory_events`、`memory_observations`，并保留 `chat_messages`、`agent_runs`、`agent_artifacts` 等过程源数据。
- `apps/desktop/src-tauri/src/commands/knowledge.rs`
  `apps/desktop/src-tauri/src/commands/knowledge_notes.rs`
  `apps/desktop/src-tauri/src/commands/knowledge_graph.rs`
  已具备语义知识层，不需要被长期记忆替代。

### 当前短板

1. 记忆结构还不完整：已具备 observation，但还缺 checkpoint summary、关联实体、升级路径。
2. 记忆采集仍不够全：chat / agent / notes 已接入，但 papers / graph / submission 还没有统一接入。
3. 检索刚进入 query-aware 阶段：目前是本地词法相关召回，还不是 FTS5 / embedding / index-first 组合。
4. 过程知识与语义知识未打通：会话里的关键决策、失败路线、待办事项还不会自动提升到知识图谱或工作台。

## 目标

把小妍从“能记住少量摘要的助手”升级为“能持续推进研究任务的助理”。

### 设计目标

- 让小妍跨会话记住研究过程，而不只是当前窗口内容。
- 控制 token 预算，避免把历史全文直接塞进上下文。
- 让过程记忆能逐步提升为知识笔记、claim 或待办。
- 保持本地优先，不额外引入重量级外部服务作为第一阶段依赖。

### 非目标

- 不追求把所有原始聊天全文永久注入模型。
- 第一阶段不做长会话 Endless Mode。
- 不替换现有知识图谱、笔记、论文管理体系。

## 目标架构

长期记忆建议拆成三层：

1. Profile Memory
   用户显式保存的偏好、规则、写作习惯、常用方向。
2. Episodic Memory
   会话过程中的关键操作、结论、失败尝试、未完成事项。
3. Semantic Knowledge Memory
   论文、笔记、知识图谱中的稳定知识。

小妍优先使用 Episodic Memory 恢复上下文，再把高价值内容提升到 Semantic Knowledge Memory。

## 数据模型建议

建议保留现有 `user_memories` 兼容层，并新增以下表。

目前已落地：

- `memory_events`
- `memory_observations`

尚未落地：

- `memory_session_summaries`
- `memory_links`

### `memory_events`

- 原始事件流水
- 字段建议：
  - `id`
  - `session_id`
  - `run_id`
  - `event_type`
  - `source`
  - `payload_json`
  - `created_at`

### `memory_observations`

- 由事件压缩后的结构化 observation
- 字段建议：
  - `id`
  - `session_id`
  - `run_id`
  - `title`
  - `subtitle`
  - `narrative`
  - `facts_json`
  - `concepts_json`
  - `text`
  - `embedding`
  - `importance`
  - `created_at`

### `memory_session_summaries`

- 会话阶段性 checkpoint
- 字段建议：
  - `id`
  - `session_id`
  - `request`
  - `investigated`
  - `learned`
  - `completed`
  - `next_steps`
  - `open_questions`
  - `files_read_json`
  - `files_modified_json`
  - `created_at`

### `memory_links`

- 用来把过程记忆连到领域实体
- 字段建议：
  - `id`
  - `memory_id`
  - `memory_kind`
  - `entity_type`
  - `entity_id`
  - `relation`

可关联实体包括：

- `chat_session`
- `agent_run`
- `paper`
- `knowledge_note`
- `research_interest`
- `claim`
- `submission`

## 事件采集入口

应从前端埋点转为后端统一采集，优先覆盖这些入口：

1. 用户提交提问
2. 助手回答完成
3. agent run 完成或失败
4. 论文导入、解析、打开、标记
5. 笔记创建、编辑、移动、删除
6. 知识图谱 claim/evidence 变化
7. 综述、复现、投稿流程的关键动作

原则：

- 页面只发起业务动作，不直接定义长期记忆策略。
- Tauri 命令层负责发事件。
- 后台队列负责压缩和落库。

## 检索与注入策略

当前采用本地 query-aware 词法召回，下一阶段升级为本地混合检索：

- 现阶段：基于 observation 标题/摘要/叙事与当前问题的词法相关性评分，并叠加重要度、时间衰减。
- 下一阶段：引入 FTS5 和 / 或 embedding 召回。
- 目标：兼顾新近性、重要度、语义相关性。

注入策略从“全文摘要拼接”升级为“目录优先”：

1. 先返回轻量 index
2. 再按需补 2-3 条 observation 详情
3. 超长历史只保留摘要与链接，不直接铺满上下文

## 与知识图谱、笔记的串联

长期记忆不能和知识图谱平行割裂，应建立升级路径：

- observation 中的稳定事实，可推荐提升为笔记或 claim
- session summary 中的 `next_steps` 可转为工作台待办
- 研究方向页可显示“最近决策”“最近失败尝试”“待验证问题”
- 知识图谱中的结论应能追溯到会话、笔记和论文来源

## 设置与交互

### 已落地的第一步

在 `设置 -> 小妍` 中增加开关：

- `xiaoyan_long_term_memory_enabled`

作用：

- 开启：小妍会继续写入自动长期记忆，并在对话开始时按问题召回相关 observation
- 关闭：只使用当前工作台上下文，不读取长期记忆，也不再自动写入新的长期记忆
- 关闭不会删除已有记忆数据

### 后续建议

- 在记忆管理页显示“当前是否参与对话注入”
- 支持查看 observation 来源与关联实体
- 支持将一条 observation 提升为笔记 / claim / 待办

## 分阶段实施

### Phase 0

- [x] 增加长期记忆总开关
- [x] 用开关控制当前 `build_memory_context()` 注入
- [x] 保持现有 `user_memories` 兼容行为

### Phase 1

- [x] 引入 `memory_events`
- [x] 引入 `memory_observations`
- [x] 从 chat / agent / notes 统一采集事件
- [ ] 从 papers / graph / submission 统一采集事件
- [ ] 增加异步压缩队列

### Phase 2

- [ ] 引入 `memory_session_summaries`
- [ ] 增加 FTS5 和 embedding 检索
- [ ] 把注入逻辑改成 index-first
- [x] 先把注入逻辑升级为 query-aware observation 召回

### Phase 3

- 增加 `memory_links`
- 支持 observation 提升为笔记、claim、待办
- 在知识图谱与工作台里展示过程记忆痕迹

### Phase 4

- 为 agent 暴露 `memory_search / memory_timeline / memory_get` 工具
- 让多能力域协作显式使用长期记忆检索，而不是只依赖系统提示词注入

## 风险与验证

### 主要风险

1. 召回污染：无关旧记忆抢占上下文
2. 摘要失真：压缩后的 observation 歪曲原始意图
3. 隐私与可控性：用户需要明确关闭入口与可见性
4. 延迟上涨：同步压缩会拖慢主流程

### 验证指标

- 新会话问题的上下文恢复是否更准确
- 用户是否能少重复输入背景
- 长任务是否能记住“做到哪了、下一步是什么”
- 召回内容是否与当前研究方向保持相关
- 对话 token 消耗是否低于“直接拼全文”的方案

## 建议的下一步

下一步优先做 Phase 2 的基础层：

1. 新增 `memory_session_summaries`
2. 让 observation 检索从当前词法相关召回升级为 FTS5 / embedding 混合检索
3. 把 papers / graph / submission 也接入统一事件流

完成后，再把高价值 observation 推到知识图谱和笔记体系中，形成真正可连续推进研究的长期记忆内核。
