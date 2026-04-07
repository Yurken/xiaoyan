# 重构路线图

## 架构方向

**桌面端本地内核为核心。**

| 端 | 定位 | 内核 |
|---|---|---|
| Desktop | 旗舰端，全功能 | Tauri / Rust / SQLite（本地自包含） |
| Web | 展示版 / 远程协作版 | HTTP 后端（功能子集） |
| Mobile | 轻量陪伴端 | HTTP 后端（消费型场景） |

新能力**默认落在 Desktop**，Web/Mobile 按需选择性同步，不追求三端对齐。

---

## 已完成

- [x] Monorepo 化：pnpm workspace + Turborepo
- [x] `packages/types`、`packages/api-sdk`、`packages/ui` 抽取
- [x] Desktop Tauri v2 + React + React Router 架构
- [x] CI：lint + type-check + Web smoke build + Rust 测试
- [x] 确认架构方向为"桌面本地内核"

## 待办

### 近期

- [ ] 桌面端核心功能补全（以 Desktop 为唯一开发优先级）
- [ ] Web/Mobile 按消费场景做减法，移除与 Desktop 本地能力强绑定的页面
- [ ] CI 接入分支保护规则（GitHub branch protection：要求 CI 全绿才可合并）

### 中期

- [ ] Desktop 本地知识库能力增强（全文检索、向量索引）
- [ ] Web 端实现远程协作场景（分享、只读展示）
- [ ] Mobile 端聚焦阅读 + 通知推送

### 暂缓 / 不做

- ~~Phase 2 后端产品化（ARQ + MinIO + JWT）~~：与桌面本地内核方向不一致，暂不推进；仅在 Web/Mobile 侧确有多用户协作需求时再评估。
