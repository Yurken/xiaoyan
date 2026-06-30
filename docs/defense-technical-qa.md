# 小妍答辩技术细节 Q&A

> 本文件汇总答辩/路演中可能被问到的技术细节，答案均基于项目实际代码与文档，便于快速准备。

---

## 一、多 Agent 协同架构

### Q1：为什么要做多 Agent，而不是一个模型端到端回答？

科研场景对准确性、可追溯、可复盘要求高。单模型同时承担规划、检索、精读、写作，既难在每个子任务上最优，也容易在长对话中淹没关键上下文，且用户看不到答案是怎么来的。小妍用 Supervisor 显式编排专科 Agent，每个 Agent 只做一件事，执行轨迹和中间产物全部落库。

> 相关代码：`apps/desktop/src-tauri/src/agent_graph.rs`、`agent_nodes.rs`

### Q2：Supervisor 路由有哪几种模式？

三种：

- `rule`：纯规则路由，按关键词/意图匹配；
- `llm`：模型实时选路；
- `hybrid`：规则初选 + 模型修正（默认）。

> 相关代码：`apps/desktop/src-tauri/src/services/agent_routing_service.rs`

### Q3：7 个 Agent 各自负责什么？

| Agent | 职责 |
|---|---|
| retrieval | 图谱 + 语义检索，串行打底 |
| planner | 生成研究/学习路径 |
| literature_scout | 筛选最该优先读的核心论文 |
| survey | 组织结构化综述 |
| paper_analyst | 单篇论文深度解析 |
| reproduction | 输出可执行、风险明确的复现链路 |
| synthesis | 串行收口，生成最终回答 |

> 相关代码：`agent_nodes.rs`、`assistant_prompts.rs`

### Q4：Agent 之间是串行还是并行？

依赖图驱动的波次并行。通过 `worker_dependencies()` 做拓扑排序，`tokio::spawn` 同一波次真并发。整体节奏是：

```
Retrieval（串行）→ Worker 波次并行 → Synthesis（串行）
```

墙钟时间取决于最长依赖链，不是 Agent 总数。

> 相关代码：`agent_graph.rs` 中 `compute_execution_waves`

### Q5：Agent 之间怎么共享上下文？不会 token 爆炸吗？

通过 `SharedWorkspace`。每个 Agent 产出结构化 `AgentOutput`（summary / full_content / metadata / 耗时）。下游 Agent 通过 `build_worker_context()` **只读上游 summary**，不传全文，显著压低 token。

> 相关代码：`agent_workspace.rs`

### Q6：怎么防止 Agent 无限调用、成本失控？

- `multi_agent_max_steps`（默认 6）限制单次最多执行 Agent 数；
- `multi_agent_search_limit`（默认 8）限制 Retrieval 检索深度；
- 路由策略可选 `rule` 降低模型调用成本；
- 专用 Agent 可单独配置 cheaper 模型。

> 相关代码：`services/agent_runtime_service.rs`、设置默认值在 `pageConfig.tsx`

---

## 二、RAG 与 Graph RAG

### Q7：RAG 管线是怎么做的？

- 分块：智能句界切分，`chunk_size=800`、`overlap=150`，UTF-8 字符边界安全；
- Embedding：支持 `text-embedding-3-small/large`、`BAAI/bge-m3`、Ollama 本地模型，批量生成（batch≈48）；
- 检索：`cosine_similarity` 余弦相似度，`combined_search` 同时召回论文块 + 知识笔记，取 `rag_top_k=5`。

> 相关代码：`apps/desktop/src-tauri/src/rag.rs`

### Q8：为什么向量存在 SQLite 里，不用 Pinecone/Milvus？

本地优先、零外部依赖、隐私自持。向量以 JSON 存于 SQLite TEXT 列，本地线性扫描。当前数据规模可控，也预留了未来切换 `sqlite-vec`/ANN 的优化空间。

### Q9：Graph RAG 和普通 RAG 有什么区别？

普通 RAG 靠语义相似度，Graph RAG 额外融合论文引用关系图：

- 自动构建论文引用网络（节点 + 有向边）；
- 检索时带回引用/被引用论文片段；
- 支持多跳推理，能回答"某篇论文被哪些后续工作改进"这类问题。

> 相关代码：`apps/desktop/src-tauri/src/graph_rag.rs`、引用图引擎

### Q10：Embedding 服务怎么降级？

配置优先级为"独立向量服务 → 主 Provider 默认"。如果独立 embedding 没配，自动回退到主 LLM provider 的默认 embedding 模型；缺少向量时 memory 检索自动退化为关键词检索。

---

## 三、本地架构与隐私

### Q11：为什么选 Tauri + Rust + SQLite，而不是 Electron？

| 方案 | 劣势 |
|---|---|
| 纯 Web + 云端 | 论文需上传，隐私风险 |
| Electron + Node | 包体大、内存高、GC 停顿 |
| Tauri + Rust + SQLite | 包小、性能高、完全离线、本地优先 |

所有 Rust 逻辑跑在 Tauri 主进程内，无独立后端启动成本，一套代码输出 macOS/Windows/Linux 三端。

### Q12：API Key 和敏感数据怎么保护？

- API Key：前端展示 `***` 掩码，Rust 后端持真实值；
- 应用锁：PBKDF2 + SHA-256 密码保护，闲置超时自动锁定；
- 配置导出：AES-256-GCM + PBKDF2 加密；
- 记忆隐私：敏感观察记录需密码验证后查看。

### Q13：数据存在哪里？重装会丢吗？

SQLite 存在 Application Support 目录，卸载/重装 App 数据库保留。支持加密导出 `.rcconf` 跨设备迁移。

---

## 四、PDF 与图表解析

### Q14：PDF 图表解析怎么做？

双路并行 + 智能合并：

- **路 A（lopdf）**：提取 PDF 内嵌位图、正则匹配 Figure/Table 标题；
- **路 B（视觉模型）**：PDF 页面转图片，GPT-4o/Claude 扫描识别矢量图、复杂表格；
- **合并**：按图表编号去重合并，AI 精读时提示词要求积极引用图表编号。

> 相关代码：`apps/desktop/src-tauri/src/paper_pdf.rs`

### Q15：为什么视觉模型扫描不能替代 lopdf？

成本高、速度慢。lopdf 处理位图和文本标题又快又便宜，视觉模型只补 lopdf 无法提取的矢量图和复杂表格，两者互补。

---

## 五、记忆体系

### Q16：长期记忆分几层？

三层：

- 手动备忘：用户主动录入；
- 近期操作：系统自动记录；
- 过程观察：AI 从对话中自动提取。

### Q17：记忆检索怎么打分？

多因子混合：

```
score = importance × 4
      + 关键词匹配分
      + cosine × 40
      + 近期加权
```

近 90 天记录 ∪ 历史已嵌入条目，并集去重重排；缺 embedding 时自动退化关键词检索。

> 相关代码：`services/memory_retrieval_service.rs`

### Q18：记忆库会不会无限膨胀？

有健康治理：

- 24h 内相同 `(source, event_type, summary)` 去重；
- `importance ≤ 1` 且超 90 天自动删除；
- 总量超过 5000 条按重要度+时间裁剪；
- embedding 后台异步分批补齐（batch=64）。

> 相关代码：`memory.rs`

---

## 六、模型配置与成本

### Q19：模型怎么分工？

按用途分组：

| 分组 | 用途 |
|---|---|
| 快速模型 | 方向提示、多 Agent 调度、轻量对话 |
| 深度分析模型 | 规划、论文精读、复杂分析 |
| 写作整合模型 | 综述写作、最终整合 |
| 代码复现模型 | 复现指导、训练配置 |
| 视觉模型 | PDF 图表扫描 |

### Q20：模型配置怎么回退？

三层回退：专用 Agent 模型 → Worker 基础模型 → 全局默认。Supervisor 温度固定低温（0.1）保证路由稳定。

---

## 七、前端工程与状态管理

### Q21：前端为什么用 feature 目录组织？

项目强约束"页面只负责组合，功能进 `features/<domain>/`"。避免大页面堆功能：

- 页面文件 ≤ 500 行；
- feature 组件 ≤ 400 行；
- hook ≤ 300 行；
- 远程调用、副作用、Tauri 调用进 hook，不在 JSX 里直接写。

> 相关约束：`docs/development-principles.md`

### Q22：Tauri 全局状态怎么管理？

Rust 后端用 `Arc<RwLock<AppState>>` 线程安全持有。前端通过 `invoke` 调用命令，`listen` 接收 SSE 事件。

> 相关代码：`apps/desktop/src-tauri/src/state.rs`、`lib/client.ts`

### Q23：SSE 流式是怎么从前端到后端的？

Rust 后端通过 Tauri 通道持续推送 `Plan` / `RoutingDecision` / `RunStarted` / `TextDelta` / `RunFinished` 等事件，前端监听后更新 Mission Control 面板。

> 相关代码：`services/agent_event_service.rs`

---

## 八、三端与产品策略

### Q24：三端定位是什么？

- **Desktop（旗舰端）**：Tauri/Rust/SQLite 本地内核，全功能；
- **Web（展示/协作版）**：HTTP 后端，功能子集，远程协作；
- **Mobile（轻量陪伴端）**：消费型场景，阅读、通知、快速查阅。

新能力默认先在 Desktop 实现验证，Web/Mobile 选择性同步，不追求三端对齐。

### Q25：为什么不直接做 Web 版？

科研论文和实验数据高度敏感，本地内核是核心差异点。Web 版只作为展示/协作补充，不能替代本地旗舰端。

---

## 九、具体模块细节

### Q26：工作台主按钮是怎么决定显示什么的？

状态驱动。根据研究主题 `status`、关联论文数、已分析数、笔记数、对话数等判断阶段，推荐下一步行动。例如：

- 无主题 → "开始规划"
- 有论文未分析 → "解读《xxx》"
- 有分析无笔记 → "去知识"
- 全都有 → "打开总览"

最近修复：当关联多篇论文但只分析了少量时，优先推荐"继续精读"而不是跳到"问小妍"。

> 相关代码：`apps/desktop/src/features/workbench/model.ts`

### Q27：arXiv 检索三步级联是什么？

1. 研究领域选择；
2. 类型筛选（全部/会议/期刊）；
3. 等级过滤（CCF-A/B/C、中科院分区、JCR Q1-Q3 等）。

等级过滤查询本地 22804 条期刊库，选择后自动填充 arXiv 分类。

### Q28：AI 模拟审稿怎么生成多角色？

本地提取 PDF 全文后，识别研究领域/方法关键词，生成 2-4 位不同视角审稿人（方法论、实验设计、创新性等），输出结构化意见 + 大修/小修/接收/拒稿结论，与论文版本绑定。

---

## 十、答辩建议

1. **被问到不熟的问题**：先讲"设计目标"再讲"实现"，比直接背代码更稳。
2. **强调差异点**：本地内核、多 Agent 显式编排、Graph RAG、PDF 图表视觉解析，这四个是核心竞争力。
3. **成本/性能问题**：准备好"默认 max_steps=6、search_limit=8、向量 SQLite 本地扫描"这些数字。
4. **隐私问题**：把 API Key 掩码、AES-256-GCM 导出、应用锁、SQLite 本地存储四点串起来答。
5. **如果被质疑向量存在 SQLite 性能不够**：强调当前规模可控、零依赖、预留 sqlite-vec 升级空间。

---

*生成时间：2026-06-30*
