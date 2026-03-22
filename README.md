# 智研 Copilot

面向科研学习与论文工作的桌面端 AI Copilot。采用 Supervisor 驱动的多 Agent 编排，覆盖研究方向规划、文献调研、论文精读、复现建议、知识库沉淀和带引用的对话问答，并支持按用途自定义大模型分工。

## 功能概览

- **多 Agent 协同**：Supervisor 负责任务拆解，调用检索、规划、文献侦察、综述、论文解析、复现等专长 Agent，最终整合回答。
- **可观测 Copilot**：实时展示计划步骤、Agent 执行轨迹与来源（Mission Control 面板）。
- **协作式研究规划**：研究方向规划支持 Agent 协作流程可视化，可查看 Topic Analyst / Paper Scout / Learning Path Designer 的执行过程。
- **协作式文献综述**：文献综述支持 Intent Planner / Literature Retriever / Survey Writer 协作流程可视化，并输出结构化综述与候选论文。
- **论文库**：上传 PDF，自动提取全文、分块向量化，支持语义检索与论文精读分析。导入时可开启 AI 自动重命名，按自定义模板（作者、标题、年份等）就地改名原文件。
- **知识卡片**：创建笔记，自动生成 Embedding，支持语义搜索。
- **研究规划**：输入研究方向，AI 生成系统化学习路线（前置知识、阶段、经典论文、开放问题）。
- **文献综述**：基于知识库 RAG + LLM 流式生成结构化综述。
- **实用工具**：内置 arXiv 智能检索（关键词 + 时间窗口 + LLM 重排）、期刊分区查询（WoS / JCR / 中科院）、CCF 等级查询，以及按分类整理的科研友链。
- **按用途选模**：可为方向提示、深度规划、综述写作、论文精读、复现指导、多 Agent 调度与整合分别指定模型。
- **设置中心**：默认展示少量常用模型分工，高级设置中再展开逐项场景和单个 Agent 的覆盖参数。

## 页面一览

| 页面 | 说明 |
|---|---|
| `/` | 工作台首页 |
| `/planner` | 研究方向规划 |
| `/survey` | 文献调研与结构化综述 |
| `/papers` | 论文库与 PDF 分析 |
| `/knowledge` | 知识卡片与语义检索 |
| `/copilot` | 多 Agent Copilot 工作台 |
| `/tools` | arXiv 检索、期刊分区查询、CCF 查询、科研友链 |
| `/settings` | Provider、常用模型分工、多 Agent 与运行设置 |

## 架构

桌面端为完全自包含的 Tauri v2 应用，所有逻辑在 Rust 进程内运行：

```
前端 (React + Vite)
    ↕  Tauri invoke() / listen()
Rust 后端 (Tauri Commands)
    ├── llm.rs                LLM 客户端（OpenAI / Anthropic / 兼容接口，SSE 流式）
    ├── rag.rs                文本分块 + 余弦相似度向量检索
    ├── ccf.rs                CCF 目录索引与查询
    ├── journal_partitions.rs 期刊分区索引与查询（WoS / JCR / 中科院）
    ├── db.rs                 SQLite 初始化与 Schema 迁移
    ├── state.rs              AppState（线程安全 Arc<RwLock>）
    └── commands/
        ├── settings   设置读写（事务）
        ├── papers     PDF 上传、解析、分析、复现、AI 重命名
        ├── knowledge  研究方向 + 知识笔记
        ├── chat       多 Agent 编排与流式对话
        ├── arxiv      arXiv 检索与 LLM 重排
        ├── journal    期刊分区查询
        └── misc       规划器、综述生成、搜索
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

### 数据库表结构

| 表 | 说明 |
|---|---|
| `settings` | 应用设置键值对 |
| `papers` | 论文元数据 + 全文 |
| `paper_chunks` | 论文分块 + Embedding 向量（JSON 存储） |
| `paper_analyses` | 论文 AI 分析结果 |
| `reproduction_guides` | 论文复现指南 |
| `research_interests` | 研究方向 + 学习路线 |
| `knowledge_notes` | 知识笔记 + Embedding |
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

### 3. 高级设置只在需要时展开

高级设置中可以继续微调：

- 逐项场景模型：例如单独给"方向提示"或"轻量 Copilot 对话"指定模型
- 多 Agent 细项：调度模型、默认执行模型、最终整合模型
- 单个 Agent 覆盖：例如只让文献侦察走快模型，只让论文解析走旗舰模型

当前继承关系如下：

```text
专项 Agent 覆盖值
  -> 常用模型分工
  -> 默认执行模型
  -> 主模型
```

### 4. 多 Agent 选路建议

设置页支持三种选路模式：

| 模式 | 说明 | 建议 |
|---|---|---|
| `rule` | 纯规则判断，最稳定 | 对成本敏感或需要严格可复现时使用 |
| `llm` | 由调度模型实时选择 Agent | 对开放式复杂任务更灵活 |
| `hybrid` | 规则初选 + 调度模型修正 | 默认推荐，大多数情况更稳妥 |

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
- `apps/web/package.json` / `package-lock.json`
- `packages/*/package.json` 及根 `package.json`

## 发布

推送 `v*` tag 后触发 GitHub Release 流水线：

1. **create-release**：创建草稿 Release
2. **build**（矩阵并行）：`macos-latest` / `windows-latest` 分别编译并上传产物
3. **publish-updater**：下载 updater 产物，重写 `latest.json` 中的下载地址，并同步到自有更新服务器
4. **publish-release**：所有构建完成后正式发布

> **macOS 首次打开**：发布的 `.dmg` 使用 ad-hoc 签名，未经 Apple 公证。执行以下命令后重新打开：
> ```bash
> xattr -cr /Applications/ResearchCopilot.app
> ```
> 或在「系统设置 → 隐私与安全性」中选择「仍要打开」。

### 桌面端升级检测

桌面端升级使用 Tauri v2 官方 updater。当前默认更新源固定为：

- `http://111.231.56.208/research-copilot-updates/latest.json`

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
│   │           ├── commands/  # Tauri Commands（settings/papers/knowledge/chat/arxiv/journal/misc）
│   │           ├── ccf.rs     # CCF 目录
│   │           ├── journal_partitions.rs  # 期刊分区
│   │           ├── db.rs      # SQLite 初始化
│   │           ├── llm.rs     # LLM 客户端
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

不会。设置存储在系统 Application Support 目录（见上方路径），与 App 本体分开存放，重装不影响数据。

**Q: PDF 上传到哪里？**

PDF 文件保留在原始位置，不会被复制。数据库只存储提取出的文本内容、分块向量和文件路径引用。开启自动重命名后，文件会在原目录就地改名。

**Q: macOS 提示"已损坏"无法打开怎么办？**

执行 `xattr -cr /Applications/ResearchCopilot.app` 后重新打开。
