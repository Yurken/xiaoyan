# 小妍长期记忆规划

## 背景

当前仓库已经有两类“记忆”能力：

- 研究知识记忆：论文、知识笔记、知识图谱、claim/evidence/citation 已能沉淀长期研究材料。
- 对话辅助记忆：`user_memories` 会保存手动备忘和部分自动记录，并在 `run_chat()` 中压缩后注入给小妍。

现状的问题不在于“完全没有记忆”，而在于长期记忆仍停留在“摘要拼接”阶段，还没有形成稳定的过程记忆架构。

## 当前实现

### 已存在能力

- `apps/desktop/src-tauri/src/commands/memory.rs`
  负责从 `user_memories` 聚合手动备忘、最近自动记录和近七天摘要。
- `apps/desktop/src-tauri/src/commands/chat.rs`
  在 `run_chat()` 中把长期记忆拼进系统上下文。
- `apps/desktop/src-tauri/src/db.rs`
  已保存 `chat_messages`、`agent_runs`、`agent_artifacts` 等过程数据，可作为未来 observation 的原始事件源。
- `apps/desktop/src-tauri/src/commands/knowledge.rs`
  `apps/desktop/src-tauri/src/commands/knowledge_graph.rs`
  已具备语义知识层，不需要被长期记忆替代。

### 当前短板

1. 记忆结构过粗：只有 `summary/detail` 风格，缺少 observation、checkpoint summary、关联实体等结构化层次。
2. 记忆采集分散：不少自动记忆靠前端页面手写 `memory.add()`，来源不统一。
3. 检索方式偏弱：目前是统一摘要注入，没有 index-first / 按需召回。
4. 过程知识与语义知识未打通：会话里的关键决策、失败路线、待办事项不会提升到知识图谱或工作台。

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

建议保留现有 `user_memories` 兼容层，并新增以下表：

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

第一阶段采用本地混合检索：

- FTS5：负责关键词和短语检索。
- 现有 embedding：负责 observation / summary 语义召回。
- 组合排序：兼顾新近性、重要度、语义相关性。

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

- 开启：小妍在对话开始时注入长期记忆摘要
- 关闭：只使用当前工作台上下文，不读取长期记忆
- 关闭不会删除已有记忆数据

### 后续建议

- 在记忆管理页显示“当前是否参与对话注入”
- 支持查看 observation 来源与关联实体
- 支持将一条 observation 提升为笔记 / claim / 待办

## 分阶段实施

### Phase 0

- 增加长期记忆总开关
- 用开关控制当前 `build_memory_context()` 注入
- 保持现有 `user_memories` 行为不变

### Phase 1

- 引入 `memory_events`
- 从 chat / agent / papers / notes / graph 统一采集事件
- 增加异步压缩队列

### Phase 2

- 引入 `memory_observations` 与 `memory_session_summaries`
- 增加 FTS5 和 embedding 检索
- 把注入逻辑改成 index-first

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

优先做 Phase 1：

1. 统一事件采集接口
2. 新增 `memory_events` 与 `memory_observations`
3. 让聊天入口从固定摘要注入升级为“轻量索引 + 少量详情”

完成后，再把高价值 observation 推到知识图谱和笔记体系中，形成真正可连续推进研究的长期记忆内核。
