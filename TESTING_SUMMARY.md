# 自动化测试脚本已创建完成

## 已创建的文件清单

### 配置文件
- `apps/desktop/vitest.config.ts` - Vitest 测试配置
- `apps/desktop/playwright.config.ts` - Playwright E2E 测试配置
- `apps/desktop/tsconfig.test.json` - 测试 TypeScript 配置
- `apps/desktop/tsconfig.e2e.json` - E2E 测试 TypeScript 配置

### 测试基础设施
- `apps/desktop/src/__tests__/setup.ts` - 测试环境设置和全局 Mock
- `apps/desktop/src/__tests__/mocks/tauri.ts` - Tauri API Mock 工具函数
- `apps/desktop/src/__tests__/helpers/render.tsx` - 测试渲染工具
- `apps/desktop/src/__tests__/helpers/router.tsx` - 路由测试工具
- `apps/desktop/src/__tests__/README.md` - 测试指南文档

### 组件测试 (Vitest)
- `apps/desktop/src/__tests__/components/CcfBadges.test.tsx` - CCF 学术标签组件
- `apps/desktop/src/__tests__/components/CollapsibleGroup.test.tsx` - 可折叠分组组件

### Hook 测试
- `apps/desktop/src/__tests__/hooks/useClickOutside.test.ts` - 点击外部关闭 Hook
- `apps/desktop/src/__tests__/hooks/usePersistentStringState.test.ts` - 持久化状态 Hook

### 纯函数 / 共享逻辑测试（src/lib）
- `apps/desktop/src/__tests__/lib/paperTags.test.ts` - 论文标签可见性解析/序列化/切换
- `apps/desktop/src/__tests__/lib/layoutMode.test.ts` - 横屏/专注布局存取与路径反查
- `apps/desktop/src/__tests__/lib/themeMode.test.ts` - 主题偏好与跟随系统
- `apps/desktop/src/__tests__/lib/themeStyle.test.ts` - 界面风格锁定
- `apps/desktop/src/__tests__/lib/links.test.ts` - DOI 规范化与论文链接构造
- `apps/desktop/src/__tests__/lib/interestUtils.test.ts` - 研究主题文件夹名
- `apps/desktop/src/__tests__/lib/apiBridge.test.ts` - token / API 基址管理

### 页面测试
- `apps/desktop/src/__tests__/pages/App.test.tsx` - 应用路由和导航
- `apps/desktop/src/__tests__/pages/Home.test.tsx` - 首页
- `apps/desktop/src/__tests__/pages/Planner.test.tsx` - 研究规划
- `apps/desktop/src/__tests__/pages/Survey.test.tsx` - 文献综述
- `apps/desktop/src/__tests__/pages/Papers.test.tsx` - 论文库
- `apps/desktop/src/__tests__/pages/Copilot.test.tsx` - AI 对话
- `apps/desktop/src/__tests__/pages/Knowledge.test.tsx` - 知识库
- `apps/desktop/src/__tests__/pages/Tools.test.tsx` - 实用工具
- `apps/desktop/src/__tests__/pages/Submission.test.tsx` - 投稿管理
- `apps/desktop/src/__tests__/pages/Experiment.test.tsx` - 实验记录
- `apps/desktop/src/__tests__/pages/Writing.test.tsx` - 论文写作
- `apps/desktop/src/__tests__/pages/Settings.test.tsx` - 设置

### E2E 测试 (Playwright)
- `apps/desktop/e2e/helpers/mock-tauri.ts` - E2E 测试 Mock 数据
- `apps/desktop/e2e/navigation.spec.ts` - 导航流程测试
- `apps/desktop/e2e/pages.spec.ts` - 页面渲染测试
- `apps/desktop/e2e/features.spec.ts` - 功能交互测试

## 测试覆盖的功能

### 1. 路由导航
- 所有 11 个主要页面的导航
- URL 重定向（/copilot → /xiaoyan, /write → /writing）
- 键盘快捷键跳转

### 2. 首页 (Home)
- 加载状态显示
- 错误状态显示
- 空状态引导
- 导航链接
- 数据概览

### 3. 工具页 (Tools)
- 6 个工具标签切换
- 论文检索、刊会查询、学术翻译、MD 整理、PPT 生成、科研友链

### 4. 实验记录 (Experiment)
- 记录列表显示
- 新建、编辑、删除记录
- JSON 配置验证
- 关联投稿
- 附件管理

### 5. 论文库 (Papers)
- 论文列表显示
- 导入功能
- 文件夹管理

### 6. AI 对话 (Copilot)
- 会话管理
- 消息输入
- 对话区域

### 7. 知识库 (Knowledge)
- 知识图谱视图
- 知识笔记视图

### 8. 投稿管理 (Submission)
- 5 个标签页切换
- 期刊会议追踪、看板、审稿、清单、版本管理

### 9. 其他页面
- 研究规划、文献综述、论文写作、设置等

## 运行测试命令

```bash
# 组件测试
cd apps/desktop
pnpm test           # 运行所有测试
pnpm test:watch     # 监听模式
pnpm test:coverage  # 生成覆盖率报告

# E2E 测试
pnpm test:e2e       # 运行 E2E 测试
pnpm test:e2e:ui    # 打开 Playwright UI

# 全部测试
pnpm test:all       # 运行组件测试 + E2E 测试
```

## 当前状态

- 单元/组件测试（Vitest）：23 个文件 / 140 用例，全部通过。
- 端到端测试（Playwright）：52 用例，全部通过（跑在 Vite dev server + 注入 Tauri mock）。
- `pnpm type-check`、`pnpm lint` 均通过（lint 仅余存量警告，0 error）。

## 数据安全 / 不污染数据库

- Vitest 全程 mock `@tauri-apps/api/core` 的 `invoke`，**不触达真实后端，也不写任何数据库**；`localStorage` 为内存 mock，跑完即弃。
- Playwright 跑在 Vite dev server，于浏览器内注入 `window.__TAURI_INTERNALS__.invoke` mock，**不连真实 Tauri 后端 / 数据库**。
- 本地 AI 联通测试以**只读**方式打开真实 `research_copilot.db`（`SELECT key,value FROM settings`），不跑迁移、不写入，零污染。

## 多操作系统

- 前端（Vitest/jsdom、Playwright/chromium）行为与 OS 无关，CI 在 ubuntu 上跑即可代表三端。
- OS 相关逻辑集中在 Rust/Tauri 层（窗口装饰、更新通道、平台探测）。CI 的 **Desktop Rust Test** 已扩成 `ubuntu / macOS / windows` 三平台矩阵；release preflight 在 macOS 跑一遍。

## AI 相关测试（不进流水线，本地手动）

- 流水线只测机械功能：`cargo test` 默认跳过 `#[ignore]`，真实 AI 用例（`ai_live_*`）不会在 CI / 打包流程里运行。
- 真实 AI 测试**复用本地数据库里开发者填好的 API 配置**（与 App 相同的 `LlmClient::from_settings` 解析逻辑），本地手动运行：
  - `bash scripts/test-ai-local.sh`（macOS / Linux）
  - `pwsh scripts/test-ai-local.ps1`（Windows）
  - 或直接 `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml -- --ignored --nocapture ai_live`
  - 数据库不在默认位置时用 `RC_DB_PATH=/abs/research_copilot.db` 覆盖。
- 用例定义在 `apps/desktop/src-tauri/src/ai_live_test.rs`：`ai_live_settings_present`（只读校验配置完整）与 `ai_live_chat_smoke`（发一次真实对话）。

## 流水线门禁（全部测试通过才能打包）

- `.github/workflows/ci.yml` 新增 **Desktop Frontend Test** 任务：每次 push / PR 跑 `pnpm test` + `pnpm test:e2e`。
- `.github/workflows/desktop-release.yml` 的 **preflight** 任务新增 `pnpm test` + `pnpm test:e2e`；`create-release` → `build` 均 `needs: preflight`，任一测试失败都不会打包发布。

## 维护约定

- 新增或修改功能时，必须同步新增/更新对应测试（纯函数/hook 优先 Vitest，关键用户流程补 Playwright）。
- Tauri invoke 命令名以 `src/lib/client.ts` 为正典；改命令或返回形状时同步更新 `e2e/helpers/mock-tauri.ts`（走 `window.__TAURI_INTERNALS__.invoke`）。
- `tsconfig.test.json` 的 `types` 须含 `vite/client`，否则 Vite 环境声明（`*.svg?url`、`import.meta.env`）会报类型错误。

## 后续改进建议

1. **添加视觉回归测试** - 使用 Playwright 截图对比
2. **性能测试** - 测试页面加载和交互响应时间
3. **覆盖率门禁** - 为 `pnpm test:coverage` 设定阈值并纳入 CI
