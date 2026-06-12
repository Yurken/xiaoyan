# PRD：小妍 0.4.2 工程质量夯实版

## 1. Summary

0.4.2 完成了全模块提示词优化，0.4.2 的目标是夯实工程质量——拆分超大页面、将 service stub 接入真实 DB、补完证据链在关键模块的接入，让 0.4.0 建好的底座真正可维护、可扩展。

## 2. Background

### 2.1 当前状态

0.4.0 合并后引入了大量新模块（research-context、evidence、submission-diagnosis、writing、chat_tools），但存在以下工程债：

| 问题 | 严重程度 | 影响 |
|---|---|---|
| Copilot.tsx 1185 行、Papers.tsx 1158 行、Submission.tsx 863 行 | 高 | 继续往这些页面加功能会导致不可维护 |
| evidence_service.rs 仅 36 行，evidence 命令仅 7 行 | 高 | 证据链核心能力未接入真实 DB |
| submission_diagnosis_service.rs 为 stub 实现 | 中 | 诊断报告无法持久化 |
| research_context_service.rs 使用硬编码假数据 | 中 | 研究主题聚合页无法展示真实数据 |
| 多个 service 函数为 `unimplemented!()` 或空实现 | 中 | 功能入口存在但不可用 |

### 2.2 为什么是现在

0.4.1 PRD 定义的五大 Feature 中，Feature 1-4（继续研究入口、主题 Command Center、证据链抽屉、诊断转任务）的前端 UI 已在 0.4.0 合并中初步完成，但后端数据链路未真正打通。继续堆新功能而不修基础，会导致技术债复利增长。

## 3. Objective

在不新增功能入口的前提下，完成工程质量清理：拆分大页面、接入真实数据链路、补完证据链。

## 4. Key Results

| KR | 指标 | 目标 |
|---|---|---|
| KR1 | 超大页面拆分 | Copilot.tsx < 400 行，Papers.tsx < 400 行，Submission.tsx < 400 行 |
| KR2 | Service 真实化 | evidence_service、submission_diagnosis_service、research_context_service 接入真实 DB 查询 |
| KR3 | 证据链覆盖 | 论文分析和投稿诊断中证据可追溯并展示 |
| KR4 | 工程质量 | `cargo check` 零 error，`pnpm type-check` + `pnpm lint` 通过 |

## 5. Feature Breakdown

### Feature 1：超大页面拆分

**Copilot.tsx（1185 行 → <400 行）**

当前 Copilot.tsx 混合了会话管理、消息列表、Agent 步骤展示、工具调用卡片、思考过程面板等多种职责。拆分方案：

- `features/copilot/ChatSessionPanel.tsx` — 会话列表、新建、切换
- `features/copilot/MessageList.tsx` — 消息渲染（已有 ToolActionCard、ThinkingProcessPanel）
- `features/copilot/ChatInput.tsx` — 输入框、发送、agent 选择
- `useChatSession.ts` — 会话管理 hook
- `useChatMessages.ts` — 消息流 hook
- `Copilot.tsx` — 仅组合上述组件

**Papers.tsx（1158 行 → <400 行）**

拆分方案：

- `features/papers/PaperListPanel.tsx` — 论文列表、搜索、筛选
- `features/papers/PaperImportPanel.tsx` — PDF 导入
- `features/papers/PaperAnalysisPanel.tsx` — 精读结果展示
- `usePaperList.ts` — 论文列表 hook
- `Papers.tsx` — 仅组合上述组件

**Submission.tsx（863 行 → <400 行）**

拆分方案：

- `features/submission/SubmissionDashboard.tsx` — 投稿总览
- `useSubmissionDashboard.ts` — 投稿数据聚合 hook
- 已有 feature 组件已较完善（20+ 个文件），主要是将页面中的内联逻辑移入 hook

### Feature 2：Service 真实化

**evidence_service.rs → 接入 DB**

当前仅 36 行空壳。需要：

- 定义 `EvidenceLink` 类型（source_type, source_id, target_type, target_id, snippet）
- 实现 `link_evidence()` — 建立证据关联
- 实现 `get_evidence_for()` — 按目标查询证据链
- 在论文分析和投稿诊断流程中调用

**submission_diagnosis_service.rs → 接入 DB**

当前为 stub 实现（返回空数组）。需要：

- `list_submission_diagnosis_reports()` — 从 `submission_diagnosis_reports` 表查询
- `save_ai_review_diagnosis_report()` — 写入诊断报告
- `import_diagnosis_report_to_checklist()` — 诊断项转 checklist 并写入 DB

**research_context_service.rs → 接入 DB**

当前使用硬编码假数据。需要：

- `get_recent_themes()` — 从 `research_interests` 表查询
- `get_theme_context()` — 聚合关联的论文、笔记、实验、投稿
- `build_research_context_summary()` — 已有 stub，需接入 DB

### Feature 3：证据链接入

在以下场景中接入证据链：

1. 论文精读结果 — 每个分析结论关联到论文中的具体章节或图表
2. 投稿诊断 — 每条诊断关联到论文版本和具体问题位置
3. 证据抽屉 — 已有 `EvidenceDrawer.tsx` 组件，需在更多页面中接入

### Feature 4：Stub 清理

全局扫描并修复所有 `unimplemented!()`、`todo!()`、返回空数组/空字符串的 stub 函数。

## 6. Non-goals

- 不新增功能入口或页面。
- 不新增 UI 组件（使用已有组件）。
- 不修改 DB schema。
- 不改动提示词（0.4.2 已完成）。
- 不做 Web / Mobile 同步。

## 7. Implementation Order

| Phase | 内容 | 预计变更文件数 |
|---|---|---|
| Phase 1 | 拆分 Copilot.tsx | 6-8 |
| Phase 2 | 拆分 Papers.tsx + Submission.tsx | 8-10 |
| Phase 3 | evidence_service 真实化 | 3-4 |
| Phase 4 | submission_diagnosis_service 真实化 | 2-3 |
| Phase 5 | research_context_service 真实化 | 2-3 |
| Phase 6 | 证据链接入 + stub 清理 | 5-8 |
| Phase 7 | 全量 type-check + lint，收口 | - |

## 8. Acceptance Checklist

- [ ] Copilot.tsx < 400 行
- [ ] Papers.tsx < 400 行
- [ ] Submission.tsx < 400 行
- [ ] `cargo check` 零 error
- [ ] `pnpm type-check` 通过
- [ ] `pnpm lint` 通过
- [ ] evidence_service 有真实 DB 查询
- [ ] 诊断报告可入库和查询
- [ ] 研究主题从 DB 读取而非硬编码
- [ ] CHANGELOG.md 增加 0.4.2 条目
