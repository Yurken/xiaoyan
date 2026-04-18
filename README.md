# 小妍

面向科研学习与论文工作的桌面端 AI 研究助手。采用 Supervisor 驱动的多 Agent 编排，覆盖研究方向规划、文献调研、论文精读、复现建议、知识库沉淀和带引用的对话问答，并支持按用途自定义大模型分工。

## 开发约束

- 共享开发规范见 [docs/development-principles.md](docs/development-principles.md)
- Agent 入口规范见 [AGENTS.md](AGENTS.md)、[CLAUDE.md](CLAUDE.md) 与 [CODEX.md](CODEX.md)
- 桌面端系统介绍见 [docs/system-introduction-desktop.md](docs/system-introduction-desktop.md)

## 功能概览

- **多 Agent 协同**：Supervisor 负责任务拆解，调用检索、规划、文献侦察、综述、论文解析、复现等专长 Agent，最终整合回答。
- **可观测小妍协同台**：实时展示计划步骤、Agent 执行轨迹与来源（Mission Control 面板）。
- **协作式研究规划**：支持 Topic Analyst / Paper Scout / Learning Path Designer 协作流程可视化。
- **协作式文献综述**：支持 Intent Planner / Literature Retriever / Survey Writer 协作流程可视化，输出结构化综述与候选论文。
- **论文库**：上传 PDF，自动提取全文、分块向量化，支持语义检索与论文精读分析。导入时可开启 AI 自动重命名，按自定义模板（作者、标题、年份等）就地改名原文件。
- **小妍解读（论文精读）**：点击解读后自动提取 PDF 图表（lopdf 位图 + 视觉模型扫描矢量图/表格），AI 分析时积极引用图表编号，结果以文字 + 图片并排呈现。
- **视界·视觉模型**：独立配置视觉模型（`vision_model` / `vision_base_url` / `vision_api_key`），小妍解读自动调用，扫描 PDF 各页识别 lopdf 无法提取的矢量图与表格。
- **记忆管理**：支持手动录入和 AI 自动提取用户操作记忆，小妍对话时自动注入相关上下文。
- **知识图谱与 Graph RAG**：论文引用关系自动构建图结构（`citation_graph.rs`），知识库检索时融合图邻域上下文（`graph_rag.rs`），提升多跳关联问题的回答质量。
- **知识卡片**：创建笔记，自动生成 Embedding，支持语义搜索。
- **研究规划**：输入研究方向，AI 生成系统化学习路线（前置知识、阶段、经典论文、开放问题）。
- **文献综述**：基于知识库 RAG + LLM 流式生成结构化综述。
- **PPT 生成与预览**：基于研究内容一键生成 PPT，内置幻灯片预览面板，可在工作区直接翻页浏览，支持导出为 `.pptx`。
- **投稿管理**：统一追踪会议与期刊截止日期（DDL 日历）、投稿状态看板、提交前检查清单、论文版本控制（含 PDF 上传 / 下载）、审稿意见归档与作者回复跟踪；支持智能推荐刊会。
- **AI 模拟审稿**：在版本控制中对任意已上传 PDF（或版本快照文本）一键触发，使用 `pdfjs-dist` 本地提取全文，基于研究领域、方法关键词生成 2–4 位模拟审稿人意见（含分类标签与大修 / 小修 / 接收 / 拒稿结论），结果可直接导入审稿归档进行跟踪回复。
- **实用工具**：
  - **arXiv 智能检索**：关键词 + 时间窗口 + LLM 重排，支持三步级联筛选（研究领域 × 类型 × 等级）自动填充检索范围
  - **期刊分区查询**：WoS / JCR / 中科院，支持按 CCF-A/B/C、中科院1-4区、Top期刊、JCR Q1/Q2/Q3、SCIE、SSCI 等级动态过滤
  - **CCF 等级查询**：679 个 CCF 会议与期刊
  - 按分类整理的科研友链
- **设置导入/导出**：支持加密（AES-256-GCM + PBKDF2）导出配置文件，方便多设备迁移。
- **按用途选模**：可为方向提示、深度规划、综述写作、论文精读、复现指导、多 Agent 调度与整合、视觉识别分别指定模型。
- **设置中心**：默认展示少量常用模型分工，高级设置中再展开逐项场景和单个 Agent 的覆盖参数。

## 页面一览

| 页面 | 说明 |
|---|---|
| `/` | 工作台首页 |
| `/planner` | 研究方向规划 |
| `/survey` | 文献调研与结构化综述 |
| `/papers` | 论文库与 PDF 分析 |
| `/knowledge` | 知识卡片、语义检索与知识图谱 |
| `/copilot` | 小妍多 Agent 协同工作台 |
| `/submission` | 投稿管理：DDL 日历、投稿看板、提交清单、版本控制（PDF 上传 + AI 模拟审稿）、审稿归档 |
| `/tools` | arXiv 检索、期刊分区查询、CCF 查询、科研友链 |
| `/settings` | Provider、常用模型分工、多 Agent 与运行设置 |

## 架构

桌面端为完全自包含的 Tauri v2 应用，所有逻辑在 Rust 进程内运行：

```
前端 (React + Vite)
    ↕  Tauri invoke() / listen()
Rust 后端 (Tauri Commands)
    ├── llm.rs                LLM 客户端（OpenAI / Anthropic / 兼容接口，SSE 流式；含视觉模型 chat_with_image）
    ├── rag.rs                文本分块 + 余弦相似度向量检索
    ├── citation_graph.rs     论文引用关系图（节点 + 有向边）
    ├── graph_rag.rs          Graph RAG：检索时融合图邻域上下文
    ├── agent_graph.rs        Copilot Agent 状态图（显式状态机）
    ├── agent_nodes.rs        各 Agent 节点实现
    ├── ccf.rs                CCF 目录索引与查询（679 条）
    ├── journal_partitions.rs 期刊分区索引与查询（WoS / JCR / 中科院，22804 条）
    ├── db.rs                 SQLite 初始化与 Schema 迁移
    ├── state.rs              AppState（线程安全 Arc<RwLock>）
    └── commands/
        ├── settings        设置读写（事务）、加密导入/导出
        ├── papers          PDF 上传、解析、图表提取（lopdf + 视觉扫描）、分析、复现、AI 重命名
        ├── knowledge       研究方向 + 知识笔记
        ├── knowledge_graph 知识图谱构建与查询
        ├── memory          记忆管理（手动 / 自动提取 / 上下文构建）
        ├── chat            多 Agent 编排与流式对话
        ├── arxiv           arXiv 检索与 LLM 重排
        ├── journal         期刊分区查询 + 按等级/学科过滤（journal_rank_filter）
        ├── submission      投稿管理、版本控制、审稿归档
        └── misc            规划器、综述生成、搜索
SQLite（本地嵌入式，无需独立服务）
```

## 数据存储

所有数据保存在本地 SQLite 数据库：

| 平台 | 路径 |
|---|---|
| macOS | `~/Library/Application Support/com.researchcopilot.desktop/research_copilot.db` |
| Windows | `%APPDATA%\com.researchcopilot.desktop\research_copilot.db` |
| Linux | `~/.local/share/com.researchcopilot.desktop/research_copilot.db` |

### 设置持久化

设置保存在 SQLite 的 `settings` 表（`key TEXT PRIMARY KEY, value TEXT`）：

- **写入**：点击「保存所有设置」后，Tauri Command `settings_update` 在事务内对每个键执行 `INSERT ... ON CONFLICT DO UPDATE`（upsert），全部成功后同步更新内存缓存
- **读取**：每次启动时从数据库加载全部键值并合并进内存缓存（默认值兜底）
- **敏感字段**（API Key 等）：读取时返回 `***` 占位，保存时跳过 `***` 值（保留已存储内容）
- **持久性**：数据库文件在卸载/重装 App 时保留于 Application Support 目录，不会随 App 本体删除
- **导入/导出**：设置支持加密导出为 `.rcconf` 文件（AES-256-GCM + PBKDF2），便于备份和多设备迁移

### 数据库表结构

| 表 | 说明 |
|---|---|
| `settings` | 应用设置键值对 |
| `papers` | 论文元数据 + 全文 |
| `paper_chunks` | 论文分块 + Embedding 向量（JSON 存储） |
| `paper_figures` | 论文图表文件（lopdf 提取 + 视觉模型扫描） |
| `paper_analyses` | 论文 AI 分析结果 |
| `reproduction_guides` | 论文复现指南 |
| `research_interests` | 研究方向 + 学习路线 |
| `knowledge_notes` | 知识笔记 + Embedding |
| `memories` | 用户记忆（手动 / 自动） |
| `chat_sessions` | 对话会话 |
| `chat_messages` | 对话消息 |
| `agent_runs` | Agent 执行记录 |
| `agent_artifacts` | Agent 产物 |

## 快速开始

### 前置条件

- Node.js 18+
- pnpm 9+
- Rust 工具链（`rustup`）

### 1. 安装依赖

```bash
pnpm install
```

### 2. 开发模式

```bash
pnpm dev:desktop
```

### 3. 生产构建

```bash
pnpm tauri build
```

输出：
- `src-tauri/target/release/bundle/macos/ResearchCopilot.app`
- `src-tauri/target/release/bundle/dmg/ResearchCopilot_*.dmg`

如需直接在桌面端包目录执行，也可以使用：

```bash
cd apps/desktop
pnpm tauri dev
pnpm tauri build
```

### 4. 开发自检（建议每次修改后执行）

```bash
# 仅校验桌面端
pnpm --filter @research-copilot/desktop type-check

# 校验整个仓库
pnpm type-check
pnpm lint
```

## 常见问题排查

### 1. 小妍页面报错：`Can't find variable: Send`

**现象**
- 打开小妍页面后白屏或控制台报错：`Can't find variable: Send`

**原因**
- 页面中使用了 `<Send />` 图标组件，但对应文件没有从 `lucide-react` 导入 `Send`。

**解决**
- 在报错页面顶部导入中补充 `Send`：

```ts
import { ..., Send, ... } from "lucide-react";
```

- 然后执行类型检查确认无遗漏：

```bash
pnpm --filter @research-copilot/desktop type-check
```

## 设置配置

首次启动后在「设置」页面配置 LLM Provider。建议按下面顺序配置：

### 1. 先配置主模型连接

主模型是所有功能的最终兜底值。若某个场景或 Agent 没有单独指定模型，最终都会回退到这里。

### OpenAI 兼容接口（推荐，可接阿里云 DashScope、DeepSeek 等）

| 字段 | 示例 |
|---|---|
| API Base URL | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| API Key | `sk-...` |
| 对话模型 | `qwen-plus` / `deepseek-chat` |
| Embedding 模型 | `text-embedding-v3` / `BAAI/bge-m3` |

### OpenAI 原生

| 字段 | 示例 |
|---|---|
| API Key | `sk-...` |
| 对话模型 | `gpt-4o-mini` |
| Embedding 模型 | `text-embedding-3-small` |

### Anthropic

| 字段 | 示例 |
|---|---|
| API Key | `sk-ant-...` |
| 对话模型 | `claude-3-5-haiku-20241022` |

> Anthropic 不提供 Embedding API，选择 Anthropic 作为对话 Provider 时，Embedding 需额外配置独立向量接口，否则 RAG 功能不可用。

### 2. 再配置常用模型分工

设置页默认只展示 4 组常用模型。大多数情况下，配好这几组就够用：

| 分组 | 推荐用途 | 配置建议 |
|---|---|---|
| 快速模型 | 方向提示、综述检索规划、多 Agent 调度、文献侦察、轻量对话 | 优先低延迟模型；若服务商支持联网或搜索，可优先放在这里 |
| 深度分析模型 | 深度规划分析、规划结果生成、论文精读、复杂研究分析 | 优先旗舰模型或推理能力更强的模型 |
| 写作整合模型 | 综述写作、多 Agent 综述、最终整合回答 | 优先长上下文、结构化和长输出质量稳定的模型 |
| 代码复现模型 | 复现指导、训练配置、实现排查 | 优先代码和工程理解能力强的模型，温度建议更低 |

推荐的最简配置方式：

1. 只配置主模型
2. 如需更好体验，再补一个快速模型
3. 如果你经常做规划、综述和论文精读，再补深度分析模型或写作整合模型

### 3. 视界·视觉模型（可选）

在「视界」模块配置专用视觉模型（支持 OpenAI Vision 格式或 Anthropic）：

| 字段 | 说明 |
|---|---|
| `vision_model` | 视觉模型名称，如 `gpt-4o`、`claude-3-5-sonnet-20241022` |
| `vision_base_url` | 视觉模型 API Base URL（留空则复用主模型接口） |
| `vision_api_key` | 视觉模型 API Key（留空则复用主模型密钥） |

配置后，点击「小妍解读」时会自动调用视觉模型扫描 PDF 各页，识别 lopdf 无法提取的矢量图和表格，补充进论文图表库。

### 4. 高级设置只在需要时展开

高级设置中可以继续微调：

- 逐项场景模型：例如单独给"方向提示"或"轻量小妍对话"指定模型
- 多 Agent 细项：调度模型、默认执行模型、最终整合模型
- 单个 Agent 覆盖：例如只让文献侦察走快模型，只让论文解析走旗舰模型

当前继承关系如下：

```text
专项 Agent 覆盖值
  -> 常用模型分工
  -> 默认执行模型
  -> 主模型
```

### 5. 多 Agent 选路建议

设置页支持三种选路模式：

| 模式 | 说明 | 建议 |
|---|---|---|
| `rule` | 纯规则判断，最稳定 | 对成本敏感或需要严格可复现时使用 |
| `llm` | 由调度模型实时选择 Agent | 对开放式复杂任务更灵活 |
| `hybrid` | 规则初选 + 调度模型修正 | 默认推荐，大多数情况更稳妥 |

## arXiv 论文检索：三步级联筛选

论文检索模块支持三步级联筛选，自动填充 arXiv 分类和期刊/会议范围：

**步骤 1 · 研究领域**（计算机科学两级分类 + 其他领域平铺）

| CS 一级分组 | 子领域 |
|---|---|
| 人工智能 | AI & 机器学习、计算机视觉、自然语言处理 |
| 数据与信息 | 数据库 & 数据挖掘 |
| 系统与工程 | 系统 & 体系结构、软件工程、网络 & 通信 |
| 安全与理论 | 安全 & 密码学、理论计算机 |
| 人机与多媒体 | 人机交互、跨学科 & 多媒体 |

其他领域：生物信息、数学、物理、电气工程、机器人

**步骤 2 · 类型**：全部 / 会议 / 期刊

**步骤 3 · 等级**（静态 + 动态）：

| 等级 | 来源 | 说明 |
|---|---|---|
| CCF-A / B / C | 静态内嵌 | CCF 目录，679 条 |
| 中科院1区 / 2区 | 静态内嵌 | 按领域精选 |
| 中科院3区 / 4区 | 动态查询 | 从本地 22804 条期刊库过滤 |
| Top期刊 | 动态查询 | `cas_top = true`，共 1789 条 |
| JCR Q1 / Q2 / Q3 | 动态查询 | `jcr_quartile` 字段 |
| SCIE / SSCI | 动态查询 | `indexes` 字段 |

选择领域 + 等级后自动填充 arXiv 分类（`categories`）和期刊/会议名称（`journal_ref_terms`），动态等级通过 `journal_rank_filter` 命令查询本地数据库，加载过程显示进度提示。

## 版本号管理

修改版本号时，在仓库根目录执行：

```bash
node scripts/sync-version.mjs --version 1.2.3
# 或带 v 前缀
node scripts/sync-version.mjs --tag v1.2.3
```

脚本会同步更新以下文件，重复执行幂等：

- `apps/desktop/package.json` / `src-tauri/Cargo.toml` / `src-tauri/tauri.conf.json`
- `apps/desktop/src-tauri/src/commands/arxiv.rs`（User-Agent 常量）
- `apps/mobile/package.json` / `app.json`
- `apps/web/package.json`
- `packages/*/package.json` 及根 `package.json`

## 发布

推送 `v*` tag 后触发 GitHub Release 流水线：

1. **create-release**：创建草稿 Release
2. **build**（矩阵并行）：`macos-latest` / `windows-latest` 分别编译并上传产物
3. **publish-github-assets**：将安装包（`.dmg` / `.msi` / `.exe`）上传到 GitHub Release
4. **publish-release**：所有构建完成后正式发布

> 自有更新服务器分发（`publish-updater`）当前已禁用，安装包仅通过 GitHub Release 分发。

> **macOS 首次打开**：发布的 `.dmg` 使用 ad-hoc 签名，未经 Apple 公证。执行以下命令后重新打开：
> ```bash
> xattr -cr /Applications/ResearchCopilot.app
> ```
> 或在「系统设置 → 隐私与安全性」中选择「仍要打开」。

### 桌面端升级检测

桌面端升级使用 Tauri v2 官方 updater。当前默认更新源固定为：

- `http://66.42.97.41/research-copilot-updates/latest.json`

客户端不会直接访问私有 GitHub Release，而是从这台服务器读取公开的 `latest.json` 和安装包。

需要在 GitHub Actions 中配置这些 Secrets：

- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`：当前这把 key 没有密码，留空或不设置即可
- `UPDATE_SERVER_SSH_PRIVATE_KEY`

建议的服务器目录结构：

- `/var/www/html/research-copilot-updates/latest.json`
- `/var/www/html/research-copilot-updates/v1.2.3/*`
- `/var/www/html/research-copilot-updates/v1.2.4/*`

注意：

- 当前配置显式启用了 `dangerousInsecureTransportProtocol`，因此允许使用 HTTP 更新源。这是为了先跑通基于 IP 的自动更新，不是长期最优方案。
- 真正长期可维护的做法仍然是给更新服务器配 HTTPS 域名，再去掉这个危险开关。
- 本机已经生成一套 updater 签名密钥：`~/.tauri/research-copilot-updater.key` / `~/.tauri/research-copilot-updater.key.pub`。
- 本机到服务器的部署 SSH key 在 `~/.ssh/research-copilot-update-server`，公钥已写入服务器 `root` 的 `authorized_keys`。
- 如果你是手工发布，也可以直接用 `scripts/upload-updater-assets.sh <dir> <tag>` 上传已经生成好的 updater 资产目录。

## 项目结构

```
.
├── apps/
│   ├── desktop/               # Tauri v2 桌面端（主要）
│   │   ├── src/               # React 前端
│   │   └── src-tauri/
│   │       └── src/
│   │           ├── commands/  # Tauri Commands（settings/papers/knowledge/memory/chat/arxiv/journal/misc）
│   │           ├── data/      # 本地数据（ccf_catalog.json / journal_partitions.json）
│   │           ├── ccf.rs     # CCF 目录（679 条）
│   │           ├── journal_partitions.rs  # 期刊分区（22804 条，含动态过滤）
│   │           ├── db.rs      # SQLite 初始化
│   │           ├── llm.rs     # LLM 客户端（含视觉模型）
│   │           ├── rag.rs     # 向量检索
│   │           ├── state.rs   # 应用状态
│   │           └── lib.rs     # 入口
│   ├── mobile/                # Expo 移动端（Android APK）
│   └── web/                   # Next.js Web 端
└── packages/
    ├── types/                 # 共享类型
    └── ui/                    # 共享 UI 组件
```

## 常见问题

**Q: 可以接国内模型吗？**

可以。在设置页选择「兼容接口」，填入对应的 Base URL 和 API Key 即可。支持阿里云 DashScope（通义千问）、DeepSeek、零一万物等所有兼容 OpenAI 协议的服务。

**Q: 现在要配置很多模型吗？**

不需要。默认只建议你配置主模型和 4 组常用模型分工。只有在你明确知道某个场景或某个 Agent 需要不同模型时，才需要展开高级设置继续细调。

**Q: API Key 设置后重启看到 `***` 是正常的吗？**

正常。`***` 表示密钥已安全存储（不在界面明文展示），实际调用时会使用真实密钥。若要更换密钥，直接输入新值保存即可。

**Q: 重装应用后设置会丢失吗？**

不会。设置存储在系统 Application Support 目录（见上方路径），与 App 本体分开存放，重装不影响数据。如需迁移到新设备，可在设置页导出加密配置文件（`.rcconf`），在新设备导入还原。

**Q: PDF 上传到哪里？**

PDF 文件保留在原始位置，不会被复制。数据库只存储提取出的文本内容、分块向量和文件路径引用。开启自动重命名后，文件会在原目录就地改名。

**Q: 小妍解读的图表识别需要什么条件？**

lopdf 图表提取无需额外配置。视觉模型扫描（识别矢量图和表格）需要在设置「视界」模块配置支持图像输入的视觉模型（如 `gpt-4o`）。未配置时仅使用 lopdf 提取位图图像。

**Q: macOS 提示"已损坏"无法打开怎么办？**

执行 `xattr -cr /Applications/ResearchCopilot.app` 后重新打开。

## 致谢

小妍的桌面伴侣形象「墩墩」的动画设计灵感来自 [clawd-on-desk](https://github.com/rullerzhou-afk/clawd-on-desk)。那只趴在桌角的 clawd 让人看了就想养一只，墩墩正是沿着这条路走下来的。
