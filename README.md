# 小妍

面向科研工作者的桌面端 AI 研究助手。基于 `AgentRuntime` 驱动的多 Agent 编排架构，以 Supervisor 模式统一调度专长 Agent，覆盖从选题规划、文献调研、论文精读、知识沉淀、实验记录到投稿管理的完整科研链路。所有数据本地存储，研究资产隐私可控。

## 设计理念

- **一体化工作流** — 在同一应用中串联规划、检索、阅读、写作与投稿，消除工具切换带来的上下文断裂。
- **结构化沉淀** — 论文、笔记、对话、实验结论统一入库并建立关联，成为可检索、可复用的长期研究资产。
- **可观测 AI 协作** — 可视化 Agent 规划步骤、执行轨迹与中间产物，会话自动生成 checkpoint 记录关键决策与下一步建议，使 AI 决策可追溯、可复盘。

## 核心功能

| 模块 | 说明 |
|---|---|
| 研究主题总览 | 聚合路线、论文、笔记、会话、checkpoint、知识主张、实验与投稿，一键续接当前研究 |
| 研究规划 | 输入研究方向，AI 生成系统化学习路线（前置知识、阶段划分、经典论文、开放问题） |
| 文献综述 | 基于知识库 RAG + 流式 LLM 生成结构化综述，附带候选论文 |
| 论文库 | PDF 上传、全文提取、分块向量化、语义检索；支持 AI 自动重命名；解析质量链路记录解析器、耗时、回退路径 |
| 论文精读 | 自动抽取 PDF 图表（lopdf 位图 + 视觉模型扫描矢量图/表格），图文并排呈现分析结果 |
| 小妍协同 | `AgentRuntime` 统一调度专长 Agent（检索/规划/侦察/综述/解析/复现），整合回答并引用来源，会话自动生成 checkpoint 记录关键决策与下一步建议 |
| 知识库 | 笔记创建、自动 Embedding、语义搜索；知识图谱 + Graph RAG 增强多跳关联问答 |
| 投稿管理 | DDL 日历、状态看板、版本控制、AI 模拟审稿（生成诊断报告，可转 checklist / 修改任务并关联论文版本与实验记录）、审稿归档与回复跟踪 |
| 实验记录 | 结构化实验管理，独立字段 + 附件上传，与投稿关联建立证据链 |
| 工具集 | arXiv 三步级联检索、期刊分区查询（WoS/JCR/中科院，22804 条）、CCF 等级查询（679 条） |

## 技术架构

桌面端为自包含 Tauri v2 应用，核心逻辑在 Rust 进程内运行：

```
前端 (React + Vite)
    ↕  Tauri invoke() / listen()
Rust 后端 (Tauri Commands)
    ├── llm.rs              LLM 客户端（OpenAI / Anthropic / 兼容接口，SSE 流式，视觉模型）
    ├── rag.rs              文本分块 + 余弦相似度向量检索
    ├── citation_graph.rs   论文引用关系图
    ├── graph_rag.rs        图增强检索（邻域上下文融合）
    ├── agent_runtime.rs    AgentRuntime（工具注册、AgentContext、统一事件边界）
    ├── agent_graph.rs      Agent 状态图（显式状态机）
    ├── agent_nodes.rs      各 Agent 节点实现
    ├── ccf.rs              CCF 目录索引
    ├── journal_partitions.rs  期刊分区索引与动态过滤
    ├── db.rs               SQLite Schema 迁移
    ├── state.rs            AppState（Arc<RwLock>）
    ├── services/           服务层（settings / submission / memory / chat_context / source / research_context）
    └── commands/           命令层（参数校验 → service 委托）
        ├── settings        设置读写、加密导入导出、配置快照
        ├── papers          PDF 解析、图表提取、AI 分析、复现
        ├── knowledge       研究方向与知识笔记
        ├── knowledge_graph 知识图谱构建与查询
        ├── memory          记忆录入/自动提取/上下文构建/隐私分层
        ├── chat            多 Agent 编排与流式对话
        ├── arxiv           arXiv 检索与 LLM 重排
        ├── journal          期刊分区查询与过滤
        ├── submission      投稿管理、版本控制、审稿归档
        ├── experiment      实验记录
        └── misc            规划器、综述生成、搜索
SQLite（本地嵌入式，无需独立服务）
```

### 数据存储

所有数据保存在本地 SQLite 数据库：

| 平台 | 路径 |
|---|---|
| macOS | `~/Library/Application Support/com.researchcopilot.desktop/research_copilot.db` |
| Windows | `%APPDATA%\com.researchcopilot.desktop\research_copilot.db` |
| Linux | `~/.local/share/com.researchcopilot.desktop/research_copilot.db` |

数据库文件独立于应用本体，卸载/重装不会丢失数据。

## 项目结构

```
.
├── apps/
│   ├── desktop/                # Tauri v2 桌面端（旗舰端）
│   │   ├── src/                # React 前端
│   │   │   └── features/       # 功能模块（companion / copilot / knowledge / papers / settings / submission / tools / workbench）
│   │   └── src-tauri/
│   │       └── src/
│   │           ├── data/       # 本地数据（ccf_catalog.json / journal_partitions.json）
│   │           └── lib.rs      # 入口
│   ├── mobile/                 # Expo 移动端（轻量陪伴）
│   └── web/                    # Next.js Web 端（展示/远程协作）
└── packages/
    ├── types/                  # 跨端共享类型
    └── ui/                     # 共享 UI 组件
```

## 页面路由

| 路由 | 模块 |
|---|---|
| `/` | 工作台首页 |
| `/planner` | 研究规划 |
| `/survey` | 文献综述 |
| `/papers` | 论文库与精读 |
| `/knowledge` | 知识库与知识图谱 |
| `/xiaoyan` | 多 Agent 协同工作台 |
| `/submission` | 投稿管理 |
| `/experiment` | 实验记录 |
| `/tools` | 工具集（arXiv / 期刊分区 / CCF 查询） |
| `/settings` | 设置中心 |

## 快速开始

### 前置条件

- Node.js 18+
- pnpm 9+
- Rust 工具链（`rustup`）

### 安装与运行

```bash
pnpm install          # 安装依赖
pnpm dev:desktop      # 启动开发模式
pnpm tauri build      # 生产构建
```

开发自检：

```bash
pnpm --filter @research-copilot/desktop type-check   # 桌面端类型校验
pnpm type-check                                       # 全仓库类型校验
pnpm lint                                             # 全仓库 lint
```

## 模型配置

首次启动后在设置页面配置 LLM Provider。推荐配置流程：

1. **主模型** — 所有功能的最终兜底值，推荐 OpenAI 兼容接口（支持阿里云 DashScope、DeepSeek 等）
2. **常用模型分工** — 快速模型 / 深度分析 / 写作整合 / 代码复现四组，覆盖多数场景
3. **视界·视觉模型**（可选）— 论文精读图表扫描，支持 OpenAI Vision / Anthropic 格式
4. **高级设置**（按需）— 逐场景、逐 Agent 粒度覆盖

继承链：`Agent 覆盖 → 常用分工 → 默认执行模型 → 主模型`

多 Agent 选路支持三种模式：`rule`（规则判断）、`llm`（模型实时选择）、`hybrid`（规则初选 + 模型修正，默认推荐）。

## 版本管理

```bash
node scripts/sync-version.mjs --version 1.2.3
```

同步更新 `apps/`、`packages/` 及根 `package.json` 中的版本号，重复执行幂等。

## 发布

推送 `v*` tag 触发 GitHub Actions 流水线：创建 Release → 矩阵构建（macOS / Windows）→ 上传产物 → 发布。

手工打包上传：

```bash
export UPDATE_ADMIN_PASSWORD='<password>'
pnpm build:updater:mac -- v0.3.2    # macOS
pnpm build:updater:win -- v0.3.2    # Windows (PowerShell)
```

macOS 首次打开提示"已损坏"时执行 `xattr -cr /Applications/小妍.app` 后重新打开。

## 常见问题

**支持国内模型吗？** 支持。在设置中选择「兼容接口」，填入阿里云 DashScope、DeepSeek 等兼容 OpenAI 协议的 Base URL 和 API Key 即可。

**必须配置多组模型吗？** 不必。仅配置主模型即可使用全部功能；如需更好体验，再补充常用分工中的快速模型或深度分析模型。

**API Key 显示 `***` 正常吗？** 正常。`***` 表示密钥已安全存储，界面不展示明文。更换时直接输入新值保存。

**重装应用后设置会丢失吗？** 不会。设置文件存储在系统 Application Support 目录，与 App 本体隔离。多设备迁移可使用加密导出（`.rcconf` 文件，AES-256-GCM + PBKDF2）。

**PDF 会复制到数据库吗？** 不会。PDF 保留在原位置，数据库仅存储提取的文本、向量和文件路径引用。

**论文精读的图表识别需要什么配置？** lopdf 位图提取无需额外配置；视觉模型扫描（矢量图/表格）需在「视界」模块配置支持图像输入的视觉模型。

## 开发规范

- [开发原则](docs/development-principles.md)
- [CLAUDE.md](CLAUDE.md) / [AGENTS.md](AGENTS.md) / [CODEX.md](CODEX.md) — Agent 入口规范
- [桌面端系统介绍](docs/system-introduction-desktop.md)

## 致谢

桌面伴侣「墩墩」的动画设计灵感来自 [clawd-on-desk](https://github.com/rullerzhou-afk/clawd-on-desk)。
