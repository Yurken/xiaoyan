# 智研 Copilot v0.2.0

面向科研学习与论文工作的桌面端 AI Copilot。采用 Supervisor 驱动的多 Agent 编排，覆盖研究方向规划、文献调研、论文精读、复现建议、知识库沉淀和带引用的对话问答。

> **v0.2.0 重大变更**：桌面端已完全去除 Python 后端依赖，改为纯 Rust Tauri Commands + 本地 SQLite，开箱即用，无需 Docker / PostgreSQL / Python 环境。

## 功能概览

- **多 Agent 协同**：Supervisor 负责任务拆解，调用检索、规划、文献侦察、综述、论文解析、复现等专长 Agent，最终整合回答。
- **可观测 Copilot**：实时展示计划步骤、Agent 执行轨迹与来源（Mission Control 面板）。
- **论文库**：上传 PDF，自动提取全文、分块向量化，支持语义检索与论文精读分析。
- **知识卡片**：创建笔记，自动生成 Embedding，支持语义搜索。
- **研究规划**：输入研究方向，AI 生成系统化学习路线（前置知识、阶段、经典论文、开放问题）。
- **文献综述**：基于知识库 RAG + LLM 流式生成结构化综述。
- **设置中心**：界面内配置 LLM Provider、模型、多 Agent 参数，保存后立即生效。

## 页面一览

| 页面 | 说明 |
|---|---|
| `/` | 工作台首页 |
| `/planner` | 研究方向规划 |
| `/survey` | 文献调研与结构化综述 |
| `/papers` | 论文库与 PDF 分析 |
| `/knowledge` | 知识卡片与语义检索 |
| `/copilot` | 多 Agent Copilot 工作台 |
| `/settings` | 模型、Provider、多 Agent 与运行设置 |

## 架构（v0.2.0）

桌面端为完全自包含的 Tauri v2 应用，所有逻辑在 Rust 进程内运行：

```
前端 (React + Vite)
    ↕  Tauri invoke() / listen()
Rust 后端 (Tauri Commands)
    ├── llm.rs        LLM 客户端（OpenAI / Anthropic / 兼容接口，SSE 流式）
    ├── rag.rs        文本分块 + 余弦相似度向量检索
    ├── db.rs         SQLite 初始化与 Schema 迁移
    ├── state.rs      AppState（线程安全 Arc<RwLock>）
    └── commands/
        ├── settings  设置读写
        ├── papers    PDF 上传、解析、分析、复现
        ├── knowledge 研究方向 + 知识笔记
        ├── chat      多 Agent 编排与流式对话
        └── misc      规划器、综述生成、搜索
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

- **写入**：点击「保存所有设置」后，Tauri Command `settings_update` 对每个键执行 `INSERT ... ON CONFLICT DO UPDATE`（upsert），同步更新内存缓存
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
cd apps/desktop
pnpm tauri dev
```

### 3. 生产构建

```bash
cd apps/desktop
pnpm tauri build
```

输出：
- `src-tauri/target/release/bundle/macos/ResearchCopilot.app`
- `src-tauri/target/release/bundle/dmg/ResearchCopilot_*.dmg`

## 设置配置

首次启动后在「设置」页面配置 LLM Provider：

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

> Anthropic 不提供 Embedding API，选择 Anthropic 作为对话 Provider 时，Embedding 需额外配置 OpenAI 兼容接口或保持空（RAG 功能不可用）。

## 发布说明

### 桌面端

推送 `v*` tag 后触发 GitHub Release 流水线：

1. **create-release**：创建草稿 Release
2. **build**（矩阵并行）：`macos-latest` / `ubuntu-latest` / `windows-latest` 分别编译并上传产物
3. **publish-release**：所有构建完成后正式发布

> **macOS 首次打开**：发布的 `.dmg` 使用 ad-hoc 签名，未经 Apple 公证。执行以下命令后重新打开：
> ```bash
> xattr -cr /Applications/ResearchCopilot.app
> ```
> 或在「系统设置 → 隐私与安全性」中选择「仍要打开」。

## 项目结构

```
.
├── apps/
│   ├── desktop/               # Tauri v2 桌面端（主要）
│   │   ├── src/               # React 前端
│   │   └── src-tauri/
│   │       └── src/
│   │           ├── commands/  # Tauri Commands（settings/papers/knowledge/chat/misc）
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

**Q: API Key 设置后重启看到 `***` 是正常的吗？**

正常。`***` 表示密钥已安全存储（不在界面明文展示），实际调用时会使用真实密钥。若要更换密钥，直接输入新值保存即可。

**Q: 重装应用后设置会丢失吗？**

不会。设置存储在系统 Application Support 目录（见上方路径），与 App 本体分开存放，重装不影响数据。

**Q: PDF 上传到哪里？**

PDF 文件保留在原始位置，不会被复制。数据库只存储提取出的文本内容、分块向量和文件路径引用。

**Q: macOS 提示"已损坏"无法打开怎么办？**

执行 `xattr -cr /Applications/ResearchCopilot.app` 后重新打开。
