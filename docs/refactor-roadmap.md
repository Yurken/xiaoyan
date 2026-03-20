# 跨平台重构路线图

> 目标：从单一 Web 应用升级为 Web + Desktop + Mobile 跨平台产品

---

## Phase 1：Monorepo 化 + 共享层抽取

**目标**：不改功能，重组目录结构，为跨平台打好基础。

- [x] 初始化 pnpm workspace
- [x] 初始化 Turborepo（turbo.json）
- [x] 迁移 `frontend/` → `apps/web/`
- [x] 创建 `packages/types`，迁移 `lib/types.ts`
- [x] 创建 `packages/api-sdk`，迁移 `lib/api.ts`，增加 `baseURL` 配置
- [x] 创建 `packages/ui`，迁移 `components/ui/`，去除 Next.js 依赖
- [x] 创建 `packages/config`（tsconfig.base.json）
- [x] 更新根目录 README

---

## Phase 2：后端产品化

**目标**：让后端具备支撑多端的能力。

- [ ] 新增 `jobs` 表（迁移脚本）
- [ ] 集成 ARQ，替换 `BackgroundTasks`（PDF 解析/向量化/综述生成改为 Job）
- [ ] 新增 `GET /api/jobs/{job_id}` 接口（状态轮询）
- [ ] 新增 `users` 表 + JWT 鉴权模块（login / refresh）
- [ ] 所有现有表增加 `user_id` 字段
- [ ] 集成 MinIO，新增 `files` 表，替换本地 `uploads/` 目录（保留本地模式）
- [ ] 更新 `docker-compose.yml`，增加 Redis 和 MinIO 服务
- [ ] `message_citations` 表，替换 `chat_messages.sources` JSONB
- [ ] `packages/api-sdk` 增加 auth token 注入 + job 轮询工具函数

---

## Phase 3：桌面端上线（Tauri）

**目标**：发布 macOS / Windows 桌面客户端。

- [ ] 初始化 `apps/desktop`（Tauri v2 + React + React Router）
- [ ] 接入 `packages/api-sdk`、`packages/ui`、`packages/types`
- [ ] 实现文件上传适配器（Tauri `dialog.open()`）
- [ ] 实现 Token 存储适配器（Tauri keychain plugin）
- [ ] 实现全局快捷键唤起 Copilot 窗口
- [ ] 桌面端页面：论文库、Copilot、知识库、设置
- [ ] 打包脚本（macOS `.dmg`、Windows `.msi`）
- [ ] github打包流程

---

## Phase 4：移动端（Expo）

**目标**：只读消费端，上架 App Store / Google Play。

- [ ] 初始化 `apps/mobile`（Expo SDK + Expo Router）
- [ ] 接入 `packages/api-sdk`
- [ ] 实现页面：论文列表浏览、知识库阅读、Copilot 对话
- [ ] Push Notification（ARQ job 完成时触发）
- [ ] EAS Build 配置
- [ ] App Store / Google Play 提交
- [ ] github多平台打包流程（win、mac、app）

---

## 可直接生成代码的任务（按优先级）

1. 生成 monorepo 初始化脚本（pnpm workspace + Turbo）
2. 生成 `packages/types` 初版
3. 生成 `packages/api-sdk` 初版（支持 baseURL、token、SSE 流）
4. 生成 FastAPI JWT 鉴权模块（users 表 + login/refresh）
5. 生成 jobs 表 + ARQ Worker 骨架
6. 生成 MinIO 文件存储适配层
7. 生成 Tauri 桌面端初始化方案
8. 生成 message_citations 表迁移
9. 生成 packages/ui 迁移脚本
10. 生成完整 docker-compose.yml（含 Redis + MinIO）
