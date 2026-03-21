# 智研 Copilot v0.1.4

面向科研学习与论文工作的多端 AI Copilot。项目采用 Supervisor 驱动的多 agent 编排，覆盖研究方向规划、文献调研、论文精读、复现建议、知识库沉淀和带引用的对话问答。

## 当前能力

- **多 agent 协同**：Supervisor 负责任务拆解、调用专长 agent、汇总结果与引用来源。
- **可观测 Copilot**：Web 与 Desktop 的 Copilot 页面展示计划步骤、agent 执行轨迹、产物和来源（Mission Control 面板）。
- **设置中心**：可在界面内配置 LLM Provider、模型、Base URL、多 agent 开关与运行参数，修改后即时生效。
- **跨端支持**：提供 Web、Desktop、Mobile 三端；移动端当前只发布 Android APK，不构建 iOS。

## 页面一览

| 页面 | 说明 |
|---|---|
| `/` | 工作台首页 |
| `/planner` | 研究方向规划 |
| `/survey` | 文献调研与结构化综述 |
| `/papers` | 论文库与 PDF 分析 |
| `/knowledge` | 知识卡片与语义检索 |
| `/copilot` | 多 agent Copilot 工作台 |
| `/settings` | 模型、Provider、多 agent 与运行设置 |

## 架构概览

### 后端

- FastAPI + SQLAlchemy(async) + PostgreSQL + pgvector
- OpenAI / Anthropic / OpenAI-compatible LLM Provider 抽象
- RAG 检索、PDF 解析、论文分析、综述生成、异步任务队列
- `agent_runs` / `agent_artifacts` 持久化与 SSE 事件流

### 前端

- `apps/web`: Next.js 15 App Router
- `apps/desktop`: Tauri v2 + React
- `apps/mobile`: Expo Router + React Native
- `packages/types` / `packages/api-sdk` / `packages/ui`: 共享类型、SDK 与 UI 组件

## 快速启动

### 前置条件

- Node.js 18+
- pnpm 9+
- Python 3.11+
- Docker

### 1. 安装前端依赖

```bash
pnpm install
```

### 2. 配置后端环境变量

```bash
cp .env.example backend/.env
```

至少需要配置：

- `DATABASE_URL`
- `LLM_PROVIDER`
- 对应 Provider 的 API Key / Base URL / Model

### 3. 启动数据库

```bash
docker compose up -d
```

默认使用带 pgvector 的 PostgreSQL，数据库端口为 `5433`。

### 4. 启动后端

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8008
```

后端文档地址：`http://localhost:8008/docs`

### 5. 启动前端

Web:

```bash
pnpm dev:web
```

Desktop:

```bash
cd apps/desktop
pnpm dev
```

Mobile:

```bash
cd apps/mobile
pnpm start
```

## 设置与运行时配置

设置页面支持直接配置：

- LLM Provider 与 API Key
- Chat / Embedding 模型
- OpenAI-compatible Base URL
- 多 agent 开关与专家 agent 启用列表
- 最大并发、超时、步骤预算等运行参数

后端在设置保存后会刷新 Provider 缓存，因此模型与密钥调整不需要重启服务。

## 发布说明

### 桌面端

推送 `v*` tag 后触发三阶段 GitHub Release 流水线：

1. **create-release**：通过 GitHub API 创建草稿 Release
2. **build**（矩阵并行）：在 `ubuntu-latest`、`macos-latest`、`windows-latest` 分别编译并上传产物
3. **publish-release**：所有构建完成后将 Release 从草稿发布为正式版本

输出产物：macOS `.dmg`（ad-hoc 签名）、Windows `.exe` / `.msi`。

> **macOS 安装说明**：发布的 `.dmg` 使用 ad-hoc 签名，未经 Apple 公证。首次打开前需执行：
> ```bash
> xattr -cr /Applications/ResearchCopilot.app
> ```
> 或在「系统设置 → 隐私与安全性」中选择「仍要打开」。

### 移动端

- 推送 `v*` tag 后会触发 EAS Android 构建
- 当前仅构建 Android APK
- iOS 发布链已禁用
- 需在仓库 Secrets 中配置 `EXPO_TOKEN`，否则构建步骤自动跳过

### 版本同步

发布前可使用：

```bash
node scripts/sync-version.mjs --tag v0.1.4
```

该脚本会同步根包、Web、Desktop、Mobile、共享包以及后端版本号。

## 项目结构

```text
.
├── apps/
│   ├── desktop/          # Tauri 桌面端
│   ├── mobile/           # Expo 移动端（Android APK）
│   └── web/              # Next.js Web 端
├── backend/
│   ├── app/
│   │   ├── api/          # FastAPI 路由
│   │   ├── models/       # 数据模型
│   │   ├── prompts/      # Prompt 模板
│   │   ├── repositories/ # 数据访问层
│   │   ├── schemas/      # Pydantic 模型
│   │   └── services/     # LLM / RAG / Agent / Jobs
│   └── migrations/       # SQL 迁移
├── packages/
│   ├── api-sdk/          # 共享 API SDK
│   ├── config/           # 共享配置
│   ├── types/            # 共享类型
│   └── ui/               # 共享 UI 组件
├── scripts/
│   └── sync-version.mjs  # 版本同步脚本
└── README.md
```

## 常见问题

**Q: 可以接国内模型吗？**

可以。将 `LLM_PROVIDER` 设为 `openai_compatible`，并配置对应 `OPENAI_COMPATIBLE_*` 参数即可。

**Q: 为什么移动端没有 iOS 包？**

当前发布策略只保留 Android APK，移动端工作流不会构建 iOS。

**Q: 设置页改了模型后为什么能立即生效？**

后端保存设置时会主动失效并重建 LLM Provider 缓存。

**Q: macOS 提示"已损坏"无法打开怎么办？**

由于 `.dmg` 使用 ad-hoc 签名而非 Apple 公证，macOS Gatekeeper 会拦截。在终端执行 `xattr -cr /Applications/ResearchCopilot.app` 后重新打开即可。
