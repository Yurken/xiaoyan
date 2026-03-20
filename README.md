# 智研 Copilot — AI 科研全流程助手

面向高校学生和科研新手的 AI 助手，帮助完成研究方向规划、文献调研、论文精读、实验复现指导和知识库沉淀。

## 功能一览

| 页面 | 功能 |
|---|---|
| `/` | 工作台首页，快速入口 |
| `/planner` | 研究方向规划，生成学习路径 + 经典论文推荐 |
| `/survey` | 文献调研，自动检索 + 生成结构化综述 |
| `/papers` | 论文库，上传 PDF，AI 精读分析 |
| `/papers/[id]` | 论文详情 + 复现指导 |
| `/knowledge` | 个人知识库，语义搜索，笔记管理 |
| `/copilot` | 多轮对话 Copilot，支持基于论文/知识库的 RAG 问答 |

## 技术栈

- **后端**: Python 3.11 + FastAPI + SQLAlchemy (async) + pgvector
- **前端**: Next.js 15.5.14 (App Router) + TypeScript + Tailwind CSS
- **数据库**: PostgreSQL 15 + pgvector
- **LLM**: 支持 OpenAI / Anthropic / 任意 OpenAI-compatible API

## 快速启动

### 前置条件

- Python 3.11+
- Node.js 18+
- Docker（用于启动数据库）

### 1. 克隆 & 配置环境变量

```bash
# 复制并填写环境变量
cp .env.example backend/.env
# 编辑 backend/.env，至少填写：
#   DATABASE_URL
#   LLM_PROVIDER + 对应的 API Key
```

### 2. 启动数据库

使用 Docker Compose 一键启动（已内置 pgvector 扩展，并自动执行 schema 初始化）：

```bash
docker compose up -d
```

数据库监听 `localhost:5433`，`backend/.env` 中的默认 `DATABASE_URL` 已与此配置对应。

> 如果已有 PostgreSQL 且安装了 pgvector，也可手动初始化：
> ```bash
> createdb research_copilot
> psql research_copilot < backend/migrations/init.sql
> ```

### 3. 启动后端

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt

uvicorn app.main:app --reload --port 8008
```

后端 API 文档：http://localhost:8008/docs

### 4. 启动前端

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev -- --port 3333
```

前端：http://localhost:3333

## 环境变量说明

详见 `.env.example`，核心配置：

```env
DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/research_copilot

# LLM 供应商: openai | anthropic | openai_compatible
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_CHAT_MODEL=gpt-4o-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

# 使用 OpenAI 兼容 API（DeepSeek、月之暗面、硅基流动等）
# LLM_PROVIDER=openai_compatible
# OPENAI_COMPATIBLE_BASE_URL=https://api.deepseek.com/v1
# OPENAI_COMPATIBLE_API_KEY=sk-...
# OPENAI_COMPATIBLE_EMBEDDING_MODEL=BAAI/bge-m3
```

## 项目结构

```
.
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI 入口
│   │   ├── config.py            # 配置管理
│   │   ├── database.py          # 数据库连接
│   │   ├── models/              # SQLAlchemy 数据模型
│   │   ├── schemas/             # Pydantic 请求/响应模型
│   │   ├── services/
│   │   │   ├── llm/             # LLM 供应商抽象层
│   │   │   ├── pdf_parser.py    # PDF 解析 & 分块
│   │   │   ├── embedding_service.py
│   │   │   ├── rag_service.py   # 向量检索
│   │   │   ├── literature_search.py  # Semantic Scholar
│   │   │   ├── planner_service.py
│   │   │   ├── survey_service.py
│   │   │   └── paper_analyzer.py
│   │   ├── repositories/        # 数据访问层
│   │   ├── api/                 # API 路由
│   │   └── prompts/             # Prompt 模板
│   ├── migrations/init.sql      # 数据库 Schema
│   └── requirements.txt
├── frontend/
│   ├── app/                     # Next.js App Router 页面
│   ├── components/              # React 组件
│   └── lib/                     # API 客户端 & 类型定义
├── .env.example
└── README.md
```

## RAG 设计

1. PDF 上传后自动分块（默认 800 字符，150 重叠）
2. 每个 chunk 向量化后存入 pgvector
3. 问答时先检索 Top-K 相关 chunk，拼入 Prompt
4. 知识库笔记同样向量化，支持跨论文语义检索
5. 响应中附上引用来源片段

## Prompt 模板

| 任务 | 文件 |
|---|---|
| 学习路径生成 | `backend/app/prompts/planner.py` |
| 文献综述 | `backend/app/prompts/survey.py` |
| 论文精读 | `backend/app/prompts/paper_reading.py` |
| 复现指导 | `backend/app/prompts/reproduction.py` |
| 知识库问答 | `backend/app/prompts/qa.py` |

## 常见问题

**Q: pgvector 安装失败？**
参考：https://github.com/pgvector/pgvector#installation

**Q: 文献检索返回空结果？**
Semantic Scholar 是免费公开 API，网络不稳定时可能无结果。综述仍会基于 LLM 知识生成。

**Q: 使用国内大模型（DeepSeek 等）？**
设置 `LLM_PROVIDER=openai_compatible`，配置对应 `OPENAI_COMPATIBLE_*` 参数。

**Q: embedding 维度不匹配？**
修改 `migrations/init.sql` 中 `vector(1536)` 为目标维度，重新初始化数据库。
