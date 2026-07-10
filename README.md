<p align="center">
  <img src="apps/desktop/public/xiaoyan_poster.png" alt="小妍" width="720" />
</p>

<p align="center">
  <a href="https://github.com/Yurken/xiaoyan/releases/latest"><img src="https://img.shields.io/badge/release-v0.4.6.1-863bff?style=flat-square" alt="Release" /></a>
  <a href="https://github.com/Yurken/xiaoyan/actions/workflows/desktop-release.yml"><img src="https://github.com/Yurken/xiaoyan/actions/workflows/desktop-release.yml/badge.svg" alt="Build" /></a>
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-333?style=flat-square" alt="Platform" />
  <img src="https://img.shields.io/badge/stack-Tauri%20v2%20+%20React%20+%20Rust-f5a623?style=flat-square" alt="Stack" />
</p>

<p align="center">
  面向科研工作者的桌面端 AI 研究助手<br/>
  以 <code>AgentRuntime</code> 驱动的多 Agent 编排架构，覆盖选题规划 → 文献调研 → 论文精读 → 知识沉淀 → 实验记录 → 投稿管理全链路<br/>
  <strong>所有数据本地存储，研究资产隐私可控。</strong>
</p>

---

## ✨ 核心功能

### 工作台首页

工作台不是静态仪表盘，而是会基于你的研究数据动态生成的「今日视图」：

- **研究主题总览**：聚合路线、论文、笔记、会话、checkpoint、知识主张、实验与投稿，一键续接当前研究
- **待办议程**：从各模块提炼的下一步行动（如继续精读某篇论文、补充实验记录、回复审稿意见）
- **风险提醒**：临近 DDL 的投稿、卡住的 Agent 任务、缺失证据链的主张
- **资产卡片**：最近阅读的论文、最新笔记、活跃会话的快速入口
- **AI 生成式摘要**：基于真实研究活动生成当日/当周研究进展总结

### 研究规划

输入研究方向后，多 Agent 协作生成系统化学习路线：

- 前置知识与阶段拆分
- 每个阶段的代表论文与必读材料
- 可行切入点与开放问题
- 规划结果保存为「研究主题」，后续论文、笔记、实验、投稿均可关联

### 文献综述

围绕研究问题，系统启动检索规划 → 文献检索 → 时序/方法分析 → 综述写作的 Agent 流水线：

- 流式输出结构化综述初稿
- 基于本地论文库 RAG + 联网搜索补充候选文献
- 支持按时间范围、文献类型、数据库过滤
- 综述结果可保存为知识笔记，沉淀到知识库

### 论文库

本地 PDF 管理器 + 语义检索入口：

- PDF 上传、全文提取、分块向量化、语义检索
- 导入时自动识别标题、作者、年份、会议/期刊、关键词（可关闭）
- 支持 AI 自动按模板重命名原文件
- 多维度排序：创建时间、标题、重要性、手动顺序，均支持正逆序
- 文件夹与子文件夹归档、跨层移动、重复论文合并
- 论文卡片直接创建笔记、跳转精读、查看解读状态

### 论文精读

PDF 导入后自动进入精读流程，双路提取图表：

- **文本提取**：全文提取并分块向量化
- **图表提取**：lopdf 提取位图 + 视觉模型扫描矢量图/表格
- **AI 解读**：从问题背景、方法、证据/结果、综合评审等维度分析
- **图表引用**：AI 分析时主动引用图号，结果图文并排呈现
- **复现/验证指南**：生成代码级复现步骤、环境配置、数据集链接，支持工程复现、理论复核、综述复核、材料复核等多种类型
- **翻译面板**：支持选择不同模型对选中段落翻译

### 小妍协同（多 Agent 工作台）

不是单一模型问答，而是可观测的多 Agent 协作：

- **Agent 图谱**：检索、规划、文献侦察、综述、论文解析、复现、整合七个节点显式编排
- **两种对话模式**：「直接对话」快速回答；「任务拆解」先规划再调度 Agent
- **技能系统**：输入 `/` 唤起技能，选择预置提示词模板（如深度分析论文、润色段落、生成摘要）
- **附件上传**：支持文本文件、图片等多模态附件
- **来源引用**：回答附带可追溯的论文、笔记、知识主张来源
- **生成中可终止**：长按或点击停止按钮可中断当前生成，保留已输出内容

### 知识库

提供「知识图谱」与「知识笔记」两种互补视图：

- **知识笔记**：支持 Markdown、标签、语义搜索，可导入本地 Markdown/文本文件
- **知识图谱**：
  - 节点：研究主题、结论/主张、论文、实验、笔记
  - 边：所属关系、证据关系（支持/冲突/背景）、论文引用关系
  - 交互：拖拽平移、⌘/Ctrl + 滚轮缩放、点击节点查看详情
  - 按研究主题聚焦，减少视觉噪音
  - 时间线视图展示研究演进
- **Graph RAG**：小妍在回答时会自动召回用户建立的知识图谱结论与证据链，区分支持、冲突、背景证据

### 投稿管理

覆盖从写完论文到成功发表的完整流程：

- **刊会追踪**：内置 CCF / 中科院分区数据，支持会议 DDL 与期刊特刊追踪
- **投稿看板**：Kanban 视图管理 writing / submitted / reviewing / accepted / rejected 状态
- **提交清单**：可勾选的投稿前检查项
- **版本管理**：保存论文版本快照（含 PDF、文本、备注）
- **AI 模拟审稿**：基于摘要或 PDF 全文生成 2-4 位模拟审稿人意见（含大修/小修/接收/拒稿结论）
- **投稿诊断**：投稿前风险评估与修改建议
- **审稿意见跟踪**：按轮次记录审稿意见、回复状态、修订任务
- **拒稿转投**：一键生成转投目标推荐与恢复计划

### 实验记录

结构化实验管理而非简单笔记：

- 标题、配置（JSON）、结果、备注独立字段
- 支持上传实验截图与结果图表
- 可关联到投稿，构建「实验 → 论文 → 投稿」证据链
- 实验可被引用为知识主张的证据

### 学术写作

内置 LaTeX 写作工作区：

- 基于模板创建论文草稿（期刊、会议、学位论文笔记）
- 编辑器 + 预览双栏/单栏切换
- LaTeX 诊断、代码片段、字数/公式/引用统计
- AI 写作助手：润色、续写、生成摘要、审稿视角评论
- 可导出到 TeXstudio 或 Overleaf

### 桌面伴侣

基于 Canvas Sprite 动画的桌面宠物系统，与系统状态联动：

- 空闲、思考、检索、阅读、写作、完成、出错等多状态动画
- 多角色外观可选
- 与 Agent 执行状态联动，直观感知任务进度

### 工具集

- **arXiv 智能检索**：关键词 + 时间窗口 + 多分类 + 三步级联筛选 + LLM 重排
- **期刊分区查询**：WoS / JCR / 中科院，支持 10+ 种等级动态过滤
- **CCF 等级查询**：679 个会议与期刊即查即得
- **学术翻译**：专业学术文本翻译
- **PPT 生成与预览**：一键生成幻灯片，支持导出 .pptx
- **科研友链**：按分类整理的学术资源导航

### 记忆、隐私与同步

- **长期记忆**：小妍会记录用户偏好与关键决策，支持语义召回，可开启隐私保护
- **主动研究**：后台扫描论文库与研究主题，主动推荐研究线索（可关闭）
- **应用锁**：闲置超时自动锁定，PBKDF2 + SHA-256 密码保护
- **配置加密导出**：AES-256-GCM + PBKDF2 加密导出，跨设备安全迁移
- **WebDAV / 自托管同步**：可选的端到端加密同步方案
- **全量数据备份**：密码保护的全量备份与恢复
- **Token 用量统计**：按今日/本月/总计查看消耗

---

## 💡 设计理念

> **一体化工作流** — 在同一应用中串联规划、检索、阅读、写作与投稿，消除工具切换带来的上下文断裂。
>
> **结构化沉淀** — 论文、笔记、对话、实验结论统一入库并建立关联，成为可检索、可复用的长期研究资产。
>
> **可观测 AI 协作** — 可视化 Agent 规划步骤、执行轨迹与中间产物，会话自动生成 checkpoint 记录关键决策与下一步建议。

## 🏗️ 技术架构

桌面端为自包含 Tauri v2 应用，核心逻辑在 Rust 进程内运行：

```
前端 (React + Vite)
    ↕  Tauri invoke() / listen()
Rust 后端 (Tauri Commands)
    ├── llm.rs                 LLM 客户端（OpenAI / Anthropic / 兼容接口，SSE 流式，视觉模型）
    ├── rag.rs                 文本分块 + 余弦相似度向量检索
    ├── citation_graph.rs      论文引用关系图
    ├── graph_rag.rs           图增强检索（知识图谱 + 引用邻域上下文融合）
    ├── agent_runtime.rs       AgentRuntime（工具注册、AgentContext、统一事件边界）
    ├── agent_graph.rs         Agent 状态图（显式状态机）
    ├── agent_nodes.rs         各 Agent 节点实现（检索/规划/侦察/综述/解析/复现/整合）
    ├── db.rs                  SQLite Schema 迁移
    ├── state.rs               AppState（Arc<RwLock>）
    ├── services/              服务层（settings / submission / memory / chat_context / source / research_context / sync / paper_parser）
    └── commands/              命令层（参数校验 → service 委托）
SQLite（本地嵌入式，无需独立服务）
```

核心数据流：

1. 用户在前端操作 → Tauri invoke 调用 Rust command
2. Rust 层进行参数校验后委托给 service
3. service 操作本地 SQLite，必要时调用 LLM/RAG/AgentRuntime
4. Agent 执行状态通过 SSE 或事件总线推回前端
5. 论文、笔记、实验、投稿等数据统一落库，供知识图谱与 Graph RAG 召回

<details>
<summary><b>📂 项目结构</b></summary>

```
.
├── apps/
│   ├── desktop/                # Tauri v2 桌面端（旗舰端）
│   │   ├── src/                # React 前端
│   │   │   └── features/       # 功能模块
│   │   │       ├── companion   # 桌面伴侣
│   │   │       ├── copilot     # 小妍协同 / 多 Agent 对话
│   │   │       ├── experiment  # 实验记录
│   │   │       ├── focus       # 聚焦模式与兴趣标签
│   │   │       ├── knowledge   # 知识库 / 知识图谱 / 综述
│   │   │       ├── papers      # 论文库与精读
│   │   │       ├── reader      # PDF 阅读器
│   │   │       ├── research-context  # 研究主题上下文
│   │   │       ├── settings    # 设置中心
│   │   │       ├── submission  # 投稿管理
│   │   │       ├── tools       # 工具集
│   │   │       ├── workbench   # 工作台首页
│   │   │       └── writing     # LaTeX 学术写作
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

</details>

<details>
<summary><b>📍 页面路由</b></summary>

| 路由 | 模块 |
|---|---|
| `/` | 工作台首页 |
| `/planner` | 研究规划 |
| `/survey` | 文献综述 |
| `/papers` | 论文库与精读 |
| `/knowledge` | 知识库与知识图谱 |
| `/xiaoyan` | 多 Agent 协同工作台 |
| `/writing` | LaTeX 学术写作 |
| `/submission` | 投稿管理 |
| `/experiment` | 实验记录 |
| `/tools` | 工具集（arXiv / 期刊分区 / CCF 查询 / PPT / 翻译） |
| `/settings` | 设置中心 |

</details>

<details>
<summary><b>💾 数据存储路径</b></summary>

所有数据保存在本地 SQLite 数据库，独立于应用本体，卸载/重装不会丢失数据。

| 平台 | 路径 |
|---|---|
| macOS | `~/Library/Application Support/com.researchcopilot.desktop/research_copilot.db` |
| Windows | `%APPDATA%\com.researchcopilot.desktop\research_copilot.db` |
| Linux | `~/.local/share/com.researchcopilot.desktop/research_copilot.db` |

</details>

## 🚀 快速开始

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

## ⚙️ 模型配置

首次启动后在设置页面配置 LLM Provider：

1. **主模型** — 所有功能的最终兜底值，推荐 OpenAI 兼容接口（支持阿里云 DashScope、DeepSeek、OpenAI、Anthropic 等）
2. **常用模型分工** — 快速模型 / 深度分析 / 写作整合 / 代码复现四组，覆盖多数场景
3. **视界·视觉模型**（可选）— 论文精读图表扫描，支持 OpenAI Vision / Anthropic 格式
4. **翻译模型**（可选）— 独立配置翻译用模型
5. **高级设置**（按需）— 逐场景、逐 Agent 粒度覆盖

> 继承链：`Agent 覆盖 → 常用分工 → 默认执行模型 → 主模型`
>
> 多 Agent 选路支持三种模式：`rule`（规则判断）、`llm`（模型实时选择）、`hybrid`（规则初选 + 模型修正，默认推荐）
>
> 联网搜索：可配置 Tavily 等搜索 provider，作为小妍协同与论文检索的补充信息源。

## 📦 发布流程

推送 `v*` tag 触发 GitHub Actions 流水线：创建 Release → 矩阵构建（macOS / Windows / Linux）→ 上传安装包与更新包到 Cloudflare R2 → 生成更新清单与官网下载清单回传 R2 → 发布。

安装包与自动更新统一从 R2 公共地址分发，发布无需手工打包上传，全部走 CI。

版本同步脚本：

```bash
node scripts/sync-version.mjs --version 1.2.3
node scripts/sync-version.mjs --version 1.2.3.4 # 四段修订版号，运行时会映射为可发布的 SemVer
```

GitHub 流水线成功后，如需同步旧服务器下载页：

```bash
pnpm release:landing                    # 同步最新版本到下载页
pnpm release:landing --version v0.4.4   # 指定版本
pnpm release:landing --dry-run          # 预览模式
```

## ❓ 常见问题

<details>
<summary><b>支持国内模型吗？</b></summary>
支持。在设置中选择「兼容接口」，填入阿里云 DashScope、DeepSeek 等兼容 OpenAI 协议的 Base URL 和 API Key 即可。
</details>

<details>
<summary><b>必须配置多组模型吗？</b></summary>
不必。仅配置主模型即可使用全部功能；如需更好体验，再补充常用分工中的快速模型或深度分析模型。
</details>

<details>
<summary><b>API Key 显示 <code>***</code> 正常吗？</b></summary>
正常。<code>***</code> 表示密钥已安全存储，界面不展示明文。更换时直接输入新值保存。
</details>

<details>
<summary><b>重装应用后设置会丢失吗？</b></summary>
不会。设置文件存储在系统 Application Support 目录，与 App 本体隔离。多设备迁移可使用加密导出（<code>.rcconf</code> 文件，AES-256-GCM + PBKDF2）。
</details>

<details>
<summary><b>知识图谱怎么用？</b></summary>
在「知识库 → 知识图谱」里：
1. 先创建研究主题和结论（观点/假设/开放问题）
2. 把论文、实验或笔记绑定为结论的证据，选择「支持/冲突/背景」关系
3. 在论文之间手动记录引用关系
4. 小妍协同回答问题时，会自动召回图谱中的结论与证据链作为上下文
</details>

<details>
<summary><b>小妍协同和直接对话有什么区别？</b></summary>
- 直接对话：单轮或多轮聊天，适合快速问答、润色、解释概念
- 任务拆解：小妍会先拆步骤，再按需调度检索、论文解析、复现等 Agent，适合复杂研究任务
</details>

<details>
<summary><b>PDF 会复制到数据库吗？</b></summary>
不会。PDF 保留在原位置，数据库仅存储提取的文本、向量和文件路径引用。
</details>

<details>
<summary><b>论文精读的图表识别需要什么配置？</b></summary>
lopdf 位图提取无需额外配置；视觉模型扫描（矢量图/表格）需在「视界」模块配置支持图像输入的视觉模型。
</details>

<details>
<summary><b>macOS 提示"已损坏"怎么办？</b></summary>
执行 <code>xattr -cr /Applications/小妍.app</code> 后重新打开。
</details>

## 📖 开发规范

- [开发原则](docs/development-principles.md)
- [CLAUDE.md](CLAUDE.md) / [AGENTS.md](AGENTS.md) / [CODEX.md](CODEX.md) — Agent 入口规范
- [桌面端系统介绍](docs/system-introduction-desktop.md)
