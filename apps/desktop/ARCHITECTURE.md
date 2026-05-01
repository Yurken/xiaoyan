# 小研 (ResearchCopilot) Desktop 系统架构说明

## 一、系统一句话概括

小研是一款基于 Tauri v2 的本地学术研究 Copilot 桌面应用，集论文管理、知识图谱构建、多智能体对话、投稿管理与实验记录于一体，所有数据本地存储，通过 LLM 与 RAG 提供智能化研究辅助。

## 二、核心业务流程

```
用户输入问题/指令
    → 前端路由到对应功能页面
    → 通过 Tauri IPC invoke 调用后端命令
    → 后端命令层解析请求，决定走"简单对话"还是"多智能体编排"
    → 多智能体路径：Supervisor 路由 → DAG 调度 → 各 Agent 节点执行（检索/分析/综述等）
    → Agent 执行中调用 RAG（语义搜索 + 图谱搜索）+ LLM（流式生成）
    → 结果通过 Tauri 事件流式推送回前端
    → 前端增量渲染回答，附带引用来源
    → 对话/分析结果持久化到本地 SQLite
```

**核心业务线：**
1. **论文管理**：导入 PDF → 提取全文 → 分块嵌入 → AI 分析 → 复现指导
2. **知识构建**：研究兴趣 → 知识笔记 → 知识图谱（Claims/Evidence）→ 引用图谱
3. **Copilot 对话**：简单对话 / 多智能体协作（检索 + 分析 + 综述 + 规划）
4. **投稿管理**：会议/期刊查询 → 投稿版本 → 审稿轮次 → AI 审稿辅助
5. **实验记录**：实验 CRUD + 附件管理
6. **工具集**：综述生成、研究规划、翻译、Obsidian 导出

## 三、系统分层架构

### 1. 用户/入口层

| 模块 | 职责 | 输入 | 输出 |
|------|------|------|------|
| **Tauri 应用窗口** | 原生桌面窗口，提供系统级能力（文件对话框、shell、自动更新） | 用户操作 | 渲染器事件 |
| **侧边栏导航** | 页面路由入口：Home / Copilot / Planner / Survey / Papers / Knowledge / Experiment / Submission / Tools / Settings | 点击 | React Router 导航 |
| **布局模式切换** | sidebar（默认）/ focus（单页专注）模式 | 用户选择 | 布局状态变更 |

### 2. 前端展示层

| 模块 | 职责 | 输入 | 输出 |
|------|------|------|------|
| **Pages（11 个路由页面）** | 各业务功能的 UI 容器 | 路由匹配 | 渲染 feature 组件 |
| **Features 模块** | copilot / knowledge / papers / submission / experiment / tools / workbench 等业务组件 | 用户交互 + API 数据 | 渲染 UI |
| **apiClient（lib/client.ts）** | 统一封装 20+ 个 Tauri `invoke()` 调用模块 | 前端调用参数 | Promise / AsyncGenerator |
| **streamChat** | 流式对话异步生成器，桥接 Tauri 事件到 React 消费 | Tauri 事件流 | `AsyncGenerator<ChatStreamChunk>` |
| **主题/布局管理** | `applyTheme()` / `watchSystemTheme()` / `getLayoutMode()` | 系统主题 / 用户设置 | CSS 变量生效 |

**页面清单：**
- Home（首页摘要）、Copilot（AI 对话）、Planner（研究规划）、Survey（综述生成）、Papers（论文管理）、Knowledge（知识库）、Experiment（实验记录）、Submission（投稿管理）、Tools（工具箱）、Settings（设置）

### 3. 后端接口层（Tauri IPC Commands）

| 模块 | 职责 | 调用方 | 输出 |
|------|------|--------|------|
| **commands/chat.rs** | 对话会话管理、流式编排、Agent 路由 | 前端 chatApi | Tauri 事件流 + DB |
| **commands/papers.rs** | 论文 CRUD、PDF 上传/提取、AI 分析、复现指导 | 前端 papersApi | 结构化数据 |
| **commands/knowledge.rs** | 研究兴趣、主题建议、学习路径、Web 剪藏 | 前端 knowledgeApi | 数据 + 嵌入 |
| **commands/knowledge_graph.rs** | Claims / Evidence 链接 / 引用管理 | 前端 knowledgeApi | 图谱数据 |
| **commands/submission.rs** | 投稿全生命周期 CRUD | 前端 submissionApi | 结构化数据 |
| **commands/arxiv.rs** | arXiv API 搜索 | 前端 arxivApi | 论文列表 |
| **commands/paper_search.rs** | 多引擎论文搜索（arXiv + Semantic Scholar） | 前端 | 聚合结果 |
| **commands/memory.rs** | 用户记忆 CRUD、事件流水线、观察推导 | 前端 memoryApi | 记忆数据 |
| **commands/experiment.rs** | 实验记录 + 附件 | 前端 experimentApi | 结构化数据 |
| **commands/misc.rs** | 规划生成、综述生成、翻译、Markdown 格式化 | 前端 | 生成结果 |
| **commands/export.rs** | 导出到 Obsidian vault | 前端 exportApi | 文件写入 |
| **commands/settings.rs** | 设置管理（service 层薄封装） | 前端 settingsApi | 配置数据 |
| **commands/update.rs** | 应用自动更新检查 + 安装 | 前端 | 更新状态 |

### 4. 业务编排层

| 模块 | 职责 | 输入 | 输出 |
|------|------|------|------|
| **agent_graph.rs** | 多智能体 DAG 执行引擎，按拓扑序调度 Agent 节点 | Agent 执行计划 | Agent 执行结果 |
| **agent_nodes.rs** | 各 Agent 节点的具体执行逻辑 | 上下文 + 指令 | Agent 输出产物 |
| **assistant_prompts.rs** | 7 种 Agent 角色的系统提示词 | Agent 类型 | System prompt |
| **Agent 路由（chat.rs）** | 混合路由：规则匹配 + LLM 判断 | 用户意图 | 选中的 Agent 列表 |
| **services/chat_context_service.rs** | 构建对话上下文摘要（兴趣/论文/记忆） | 用户 ID | 上下文摘要 |
| **services/memory_retrieval_service.rs** | 长期记忆检索 | 查询 | 相关记忆列表 |
| **services/submission_service.rs** | 投稿业务逻辑 | 投稿数据 | 业务处理结果 |
| **services/source_service.rs** | 来源/会议聚合查询 | 查询参数 | 聚合结果 |

**7 种 Agent 角色：**

| Agent | 职责 |
|-------|------|
| **retrieval** | 检索：GraphRAG（知识图谱 claims + 引用邻域）+ 语义搜索（嵌入余弦相似度） |
| **planner** | 研究规划：分解研究目标为可执行步骤 |
| **literature_scout** | 文献侦察：根据主题搜索和筛选论文 |
| **survey** | 综述生成：结构化文献综述撰写 |
| **paper_analyst** | 论文分析：深度分析论文的 RQ、方法、创新点、局限性 |
| **reproduction** | 复现指导：生成论文复现方案 |
| **synthesis** | 综合：整合多 Agent 输出为最终回答 |

### 5. AI/模型能力层

| 模块 | 职责 | 输入 | 输出 |
|------|------|------|------|
| **llm/（LlmClient）** | LLM 客户端抽象层，支持 OpenAI 和 Anthropic 两种协议 | 请求参数 | 流式/非流式响应 |
| **rag.rs** | 语义检索：文本分块 + 嵌入 + 余弦相似度排序 | 查询文本 | 相关文本块列表 |
| **graph_rag.rs** | 图谱检索：Claims 来源搜索，融合语义检索与知识图谱结构 | 查询 | 带引用的检索结果 |
| **citation_graph.rs** | 引用图谱：petgraph 有向图，支持 A* 最短路径、中心性分析、BFS 子图 | 查询 | 图谱子图/路径 |
| **嵌入服务** | 批量文本嵌入（`embed()`） | 文本列表 | 向量列表 |
| **多模态** | 图片理解（`chat_with_image()`） | 图片 + 文本 | 分析结果 |

**支持的 LLM 提供商：**
- OpenAI（兼容 DeepSeek、Kimi 等 OpenAI 兼容端点）
- Anthropic（自动检测 Anthropic 兼容 base_url）
- Ollama（本地模型发现）

**按功能独立配置模型：** 每个功能可独立设置 model / base_url / api_key / temperature / top_p / max_tokens（共 ~20 组配置）。

### 6. 数据存储层

| 模块 | 技术 | 职责 |
|------|------|------|
| **SQLite（research_copilot.db）** | sqlx + WAL 模式，最大 5 连接 | 本地全量数据持久化 |
| **settings / settings_history** | KV 存储 + 配置快照 | 应用设置 + 历史回滚 |
| **papers / paper_chunks / paper_analyses / reproduction_guides / paper_figures** | 论文元数据 + 分块嵌入 + 结构化分析 + 复现指南 + 图表 | 论文管理核心表 |
| **research_interests / knowledge_notes** | 研究兴趣 + 笔记（含嵌入向量） | 知识库 |
| **knowledge_graph_claims / knowledge_graph_evidence_links / knowledge_paper_citations** | 知识图谱三元组 | 图谱推理基础 |
| **chat_sessions / chat_messages / agent_runs / agent_artifacts** | 会话 + 消息 + Agent 运行记录 | 对话历史 + 可追溯性 |
| **user_memories / memory_events / memory_observations** | 用户记忆 + 事件流水线 + 观察推导 | 长期记忆系统 |
| **submissions / paper_versions / review_rounds / review_comments / submission_checklist** | 投稿全生命周期数据 | 投稿管理 |
| **experiment_records / experiment_attachments** | 实验记录 + 附件 | 实验管理 |
| **venues** | CCF/SCI 会议期刊注册表 | 会议/期刊查询 |
| **skills** | 自定义 + 内置技能 | 技能系统 |
| **AppState（内存）** | settings 缓存 + chat_handles 映射 | 运行时状态管理 |

**迁移策略：** `db.rs` 中的 `ensure_*` 函数，启动时幂等执行，自动添加缺失列/表。

### 7. 外部服务层

| 服务 | 用途 | 调用方式 |
|------|------|----------|
| **arXiv API** | 论文搜索（arxiv.rs，48KB） | 同步 HTTP |
| **Semantic Scholar API** | 论文搜索（paper_search.rs，27KB） | 同步 HTTP |
| **OpenAI API** | Chat completions + Embeddings + Streaming | 同步/SSE 流式 |
| **Anthropic API** | Messages API + Streaming | 同步/SSE 流式 |
| **Ollama** | 本地模型发现（`/api/tags`） | 同步 HTTP |
| **OpenAI 兼容端点** | DeepSeek、Kimi 等 | 同步/SSE 流式 |
| **PDF 提取** | pdf-extract crate（Rust 原生） | 本地库调用 |
| **Obsidian** | 导出笔记/论文到 Vault | 文件系统写入 |
| **Tauri Updater** | 应用自动更新 | HTTP + 文件替换 |
| **CCF 数据** | 会议评级（嵌入应用内） | 本地数据 |
| **期刊分区数据** | WoS/JCR/CAS 分区（嵌入应用内） | 本地数据 |

## 四、模块调用关系

```
┌─────────────────────────────────────────────────────────────────────┐
│                        React 前端 (Renderer)                        │
│                                                                     │
│  Pages ──→ Features ──→ apiClient (client.ts) ──→ invoke()         │
│                                    │                                │
│                              streamChat                             │
│                          (AsyncGenerator)                           │
│                                    │                                │
│                         listen("chat:*") ←──────────────────┐       │
└────────────────────────────────┬───────────────────────────│───────┘
                                 │ Tauri IPC (invoke)        │ Events
                                 ▼                           │
┌─────────────────────────────────────────────────────────────┴───────┐
│                    Rust 后端 (Tauri Main Process)                   │
│                                                                     │
│  Commands ──→ Services ──→ Repositories ──→ SQLite                  │
│     │              │                                                │
│     │         ┌────┴────┐                                          │
│     │         ▼         ▼                                          │
│     │    LlmClient   RAG/GraphRAG                                  │
│     │    (chat/       (rag.rs/                                     │
│     │     embed)      graph_rag.rs)                                │
│     │         │         │                                          │
│     │    ┌────┴─────────┴───┐                                      │
│     │    ▼                  ▼                                      │
│     │  AgentGraph (DAG)   CitationGraph                             │
│     │  agent_graph.rs     citation_graph.rs                         │
│     │    │                                                       │
│     │    ▼                                                       │
│     │  AgentNodes (7 种角色)                                       │
│     │  agent_nodes.rs                                             │
│     │    │                                                       │
│     │    ▼                                                       │
│     │  emit Tauri Events ───────────────────────────────────→ 前端  │
│     │  (chat:plan, chat:delta, chat:done, ...)                    │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         外部服务                                     │
│  arXiv API │ Semantic Scholar │ OpenAI │ Anthropic │ Ollama │ ...  │
└─────────────────────────────────────────────────────────────────────┘
```

**关键调用链路：**

| 路径 | 调用类型 | 说明 |
|------|----------|------|
| 前端 → Commands | 同步 IPC（invoke） | 常规 CRUD 操作 |
| 前端 → chat_stream → Commands | 异步流式 IPC | 1) invoke 获取 request_id → 2) 事件流推送 |
| Commands → AgentGraph | 异步（tokio::spawn） | DAG 拓扑序并发执行 |
| AgentGraph → AgentNodes | 异步（并发） | 各 Agent 节点独立执行 |
| AgentNodes → LlmClient | 同步/流式 HTTP | 调用外部 LLM API |
| AgentNodes → RAG/GraphRAG | 同步本地计算 | 嵌入 + 余弦相似度 |
| AgentNodes → SQLite | 同步 SQL 查询 | 读写本地数据库 |
| Commands → SQLite | 同步 SQL | 持久化对话/分析结果 |
| 启动时 → 关键词回填 | 后台 tokio 任务 | 查找有全文但无标签的论文，提取关键词 |

## 五、关键数据流

### 流 1：多智能体对话流
```
用户提问
  → chat_stream invoke → request_id 返回
  → tokio::spawn 异步任务
  → chat_context_service 构建上下文（兴趣 + 记忆 + 论文）
  → select_agents 混合路由（规则 + LLM 判断）
  → AgentGraph DAG 调度
      ├─ retrieval Agent → rag.rs + graph_rag.rs → 检索结果
      ├─ paper_analyst Agent → LlmClient → 分析结果
      ├─ survey Agent → LlmClient → 综述草稿
      └─ synthesis Agent → 整合所有 Agent 输出 → 最终回答
  → emit chat:delta（增量 token）→ 前端实时渲染
  → emit chat:done → 持久化 chat_messages
  → memory 事件自动记录
```

### 流 2：论文分析流
```
PDF 上传 → pdf-extract 提取全文 → 存入 papers.full_text
  → 分块（rag.rs）→ 嵌入（embed()）→ 存入 paper_chunks
  → AI 分析（paper_analysis_* 模型配置）→ 存入 paper_analyses
  → 复现指导（paper_reproduction_*）→ 存入 reproduction_guides
```

### 流 3：知识图谱构建流
```
研究兴趣创建 → research_interests 表
  → 知识笔记创建 → knowledge_notes 表（含嵌入）
  → Claims 提取 → knowledge_graph_claims 表
  → Evidence 链接 → knowledge_graph_evidence_links 表
  → 引用关系 → knowledge_paper_citations 表
  → GraphRAG 检索时联合查询
```

### 流 4：投稿管理流
```
查询会议/期刊 → venues 表 + CCF/journal 分区数据
  → 创建投稿 → submissions 表
  → 添加版本 → paper_versions 表
  → 录入审稿意见 → review_rounds + review_comments 表
  → AI 审稿辅助 → LlmClient 分析审稿意见 → 生成回应建议
```

### 流 5：记忆流水线
```
每次对话/Agent 运行 → memory_events 记录（prompt/completion/failure/agent_run）
  → 定期推导 observations → memory_observations 表
  → 下次对话前 memory_retrieval_service 检索相关记忆
  → 注入 chat_context_service 构建的上下文
```

## 六、Mermaid 架构图代码

```mermaid
flowchart TB
    subgraph USER["<b>用户/入口层</b>"]
        U[用户] --> WIN[Tauri 桌面窗口]
        WIN --> SIDEBAR[侧边栏导航]
        SIDEBAR --> PAGE_HOME[Home]
        SIDEBAR --> PAGE_COPILOT[Copilot 对话]
        SIDEBAR --> PAGE_PAPERS[论文管理]
        SIDEBAR --> PAGE_KNOWLEDGE[知识库]
        SIDEBAR --> PAGE_SUBMISSION[投稿管理]
        SIDEBAR --> PAGE_EXPERIMENT[实验记录]
        SIDEBAR --> PAGE_TOOLS[工具箱]
        SIDEBAR --> PAGE_SETTINGS[设置]
    end

    subgraph FRONTEND["<b>前端展示层 (React 19)</b>"]
        PAGE_HOME --> FE_FEATURES[Features 组件]
        PAGE_COPILOT --> FE_FEATURES
        PAGE_PAPERS --> FE_FEATURES
        PAGE_KNOWLEDGE --> FE_FEATURES
        PAGE_SUBMISSION --> FE_FEATURES
        FE_FEATURES --> API_CLIENT[apiClient / client.ts]
        FE_FEATURES --> STREAM[streamChat 异步生成器]
    end

    subgraph COMMANDS["<b>后端接口层 (Tauri IPC Commands)</b>"]
        API_CLIENT -->|invoke| CMD_CHAT[commands/chat.rs]
        API_CLIENT -->|invoke| CMD_PAPERS[commands/papers.rs]
        API_CLIENT -->|invoke| CMD_KNOWLEDGE[commands/knowledge.rs]
        API_CLIENT -->|invoke| CMD_KG[commands/knowledge_graph.rs]
        API_CLIENT -->|invoke| CMD_SUBMISSION[commands/submission.rs]
        API_CLIENT -->|invoke| CMD_MEMORY[commands/memory.rs]
        API_CLIENT -->|invoke| CMD_SEARCH[commands/paper_search.rs]
        API_CLIENT -->|invoke| CMD_MISC[commands/misc.rs]
        API_CLIENT -->|invoke| CMD_SETTINGS[commands/settings.rs]
        CMD_CHAT -->|emit events| STREAM
    end

    subgraph ORCHESTRATION["<b>业务编排层</b>"]
        CMD_CHAT --> AGENT_SELECT[Agent 路由<br/>规则 + LLM 混合]
        AGENT_SELECT --> AGENT_GRAPH[AgentGraph<br/>DAG 执行引擎]
        AGENT_GRAPH --> AGENT_RETRIEVAL[retrieval Agent]
        AGENT_GRAPH --> AGENT_PLANNER[planner Agent]
        AGENT_GRAPH --> AGENT_SCOUT[literature_scout Agent]
        AGENT_GRAPH --> AGENT_SURVEY[survey Agent]
        AGENT_GRAPH --> AGENT_ANALYST[paper_analyst Agent]
        AGENT_GRAPH --> AGENT_REPRO[reproduction Agent]
        AGENT_GRAPH --> AGENT_SYNTH[synthesis Agent]
        CMD_MISC --> PLANNER_GEN[研究规划生成]
        CMD_MISC --> SURVEY_GEN[综述生成]
        CMD_MISC --> TRANSLATE[翻译]
    end

    subgraph AI["<b>AI/模型能力层</b>"]
        AGENT_RETRIEVAL --> RAG[rag.rs<br/>语义搜索]
        AGENT_RETRIEVAL --> GRAPH_RAG[graph_rag.rs<br/>图谱检索]
        AGENT_RETRIEVAL --> CITATION[citation_graph.rs<br/>引用图谱]
        AGENT_ANALYST --> LLM[LlmClient]
        AGENT_SURVEY --> LLM
        AGENT_SYNTH --> LLM
        AGENT_REPRO --> LLM
        PLANNER_GEN --> LLM
        SURVEY_GEN --> LLM
        LLM --> EMBED[嵌入服务 embed()]
        RAG --> EMBED
        LLM --> MULTI_MODAL[多模态 chat_with_image()]
    end

    subgraph SERVICES["<b>业务服务层</b>"]
        CMD_CHAT --> CTX_SVC[chat_context_service<br/>上下文构建]
        CMD_MEMORY --> MEM_SVC[memory_retrieval_service<br/>记忆检索]
        CMD_SETTINGS --> SET_SVC[settings_service<br/>设置管理 + 加密]
        CMD_SUBMISSION --> SUB_SVC[submission_service<br/>投稿逻辑]
    end

    subgraph DB["<b>数据存储层 (SQLite)</b>"]
        SERVICES --> DB_MAIN[(research_copilot.db)]
        CMD_PAPERS --> DB_MAIN
        CMD_KNOWLEDGE --> DB_MAIN
        CMD_KG --> DB_MAIN
        CMD_MEMORY --> DB_MAIN
        DB_MAIN --> T_PAPERS[(papers / chunks<br/>analyses / figures)]
        DB_MAIN --> T_KG[(claims / evidence<br/>citations)]
        DB_MAIN --> T_CHAT[(sessions / messages<br/>agent_runs)]
        DB_MAIN --> T_MEMORY[(memories / events<br/>observations)]
        DB_MAIN --> T_SUB[(submissions / versions<br/>review_rounds)]
        DB_MAIN --> T_SETTINGS[(settings / history)]
        DB_MAIN --> T_EXP[(experiment_records<br/>attachments)]
    end

    subgraph EXTERNAL["<b>外部服务层</b>"]
        LLM --> API_OPENAI[OpenAI API]
        LLM --> API_ANTHROPIC[Anthropic API]
        LLM --> API_OLLAMA[Ollama 本地模型]
        LLM --> API_COMPAT[OpenAI 兼容端点<br/>DeepSeek / Kimi]
        CMD_SEARCH --> API_ARXIV[arXiv API]
        CMD_SEARCH --> API_S2[Semantic Scholar API]
        CMD_PAPERS --> PDF_EXT[PDF 提取<br/>pdf-extract crate]
    end

    subgraph BG["<b>后台任务</b>"]
        STARTUP[应用启动] --> KW_BACKFILL[关键词回填任务]
        CMD_CHAT --> TOKIO_SPAWN[tokio::spawn 对话任务]
        CMD_PAPERS --> TOKIO_SPAWN
    end

    subgraph EXPORT["<b>导出服务</b>"]
        CMD_MISC --> OBSIDIAN[Obsidian Vault 导出]
    end

    style USER fill:#e3f2fd,stroke:#1565c0
    style FRONTEND fill:#e8f5e9,stroke:#2e7d32
    style COMMANDS fill:#fff3e0,stroke:#e65100
    style ORCHESTRATION fill:#fce4ec,stroke:#c62828
    style AI fill:#f3e5f5,stroke:#6a1b9a
    style SERVICES fill:#fff8e1,stroke:#f57f17
    style DB fill:#e0f2f1,stroke:#00695c
    style EXTERNAL fill:#efebe9,stroke:#4e342e
    style BG fill:#f5f5f5,stroke:#616161
    style EXPORT fill:#e8eaf6,stroke:#283593
```

## 七、绘图提示词

```
请绘制一个学术研究 Copilot 桌面应用的系统架构图，应用名为"小研"(ResearchCopilot)，
基于 Tauri v2 框架（Rust 后端 + React 前端）。

架构分为 7 层，从上到下依次为：

1. 【用户入口层】Tauri 桌面窗口，左侧导航栏包含 9 个页面入口（首页、Copilot 对话、
   论文管理、知识库、投稿管理、实验记录、工具箱、设置等）。

2. 【前端展示层】React 19 + React Router v7，通过 apiClient 统一封装 Tauri IPC 调用，
   流式对话使用 AsyncGenerator 模式接收后端事件。

3. 【后端接口层】23 个 Tauri Command 模块，核心包括 chat（对话编排）、papers（论文管理）、
   knowledge（知识库）、submission（投稿）、memory（记忆）、paper_search（论文搜索）等。
   Chat 流式调用通过 invoke 获取 request_id，后端 emit Tauri 事件推送增量结果。

4. 【业务编排层】核心是多智能体 DAG 编排引擎（AgentGraph），包含 7 种 Agent 角色：
   retrieval（检索）、planner（规划）、literature_scout（文献侦察）、survey（综述）、
   paper_analyst（论文分析）、reproduction（复现）、synthesis（综合）。
   Agent 路由采用规则 + LLM 混合判断。另有研究规划生成、综述生成、翻译等独立功能。

5. 【AI/模型能力层】LlmClient 抽象层支持 OpenAI 和 Anthropic 两种协议，
   可对接 OpenAI、Anthropic、Ollama、DeepSeek、Kimi 等多个提供商。
   包含语义检索（RAG）、图谱检索（GraphRAG）、引用图谱（petgraph）、
   文本嵌入、多模态图片理解等能力。每个功能可独立配置模型参数。

6. 【数据存储层】本地 SQLite 数据库（WAL 模式），包含 20+ 张表：
   论文管理（papers/paper_chunks/paper_analyses/paper_figures）、
   知识图谱（claims/evidence_links/citations）、
   对话系统（sessions/messages/agent_runs/artifacts）、
   用户记忆（memories/events/observations）、
   投稿管理（submissions/versions/review_rounds/comments）、
   实验记录（experiment_records/attachments）、
   设置（settings/settings_history）等。

7. 【外部服务层】arXiv API、Semantic Scholar API（论文搜索）；
   OpenAI API、Anthropic API、Ollama（LLM 推理）；
   pdf-extract（PDF 提取）、Obsidian（笔记导出）、Tauri Updater（自动更新）。

另有后台任务：启动时关键词回填、对话异步 tokio 任务。

数据流重点标注：
- 对话流式：前端 invoke → 后端 tokio::spawn → AgentGraph DAG → Agent 执行 →
  emit chat:delta 事件 → 前端增量渲染 → chat:done 持久化
- 论文分析流：PDF 上传 → 全文提取 → 分块嵌入 → AI 分析 → 复现指导
- 知识图谱流：研究兴趣 → 笔记 → Claims → Evidence → GraphRAG 检索

整体配色清爽专业，使用蓝色系为主色调，各层用不同色块区分。
箭头标注调用方向，流式调用用虚线箭头，同步调用用实线箭头。
```
