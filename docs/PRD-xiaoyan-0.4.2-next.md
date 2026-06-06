# 0.4.2 下一阶段规划

## 当前完成

| 项 | 状态 |
|---|---|
| 提示词全面优化（6 模块） | ✓ |
| 超大页面拆分（Copilot 320 / Papers 169 / Submission 328） | ✓ |
| evidence_service 接入真实 DB | ✓ |
| submission_diagnosis_service 接入真实 DB | ✓ |
| research_context_service 接入真实 DB | ✓ |
| `cargo check` 零 error / `tsc` 通过 | ✓ |

## 待推进（按优先级）

### 1. 证据链前端接入

`EvidenceDrawer.tsx` 已存在但未被任何页面引用。需要接入：

- **论文详情页** — PaperDetailModal 中精读结论旁展示「查看证据」按钮，弹出证据抽屉展示：论文原文、图表、精读分析摘要
- **投稿诊断页** — 每条诊断旁展示证据来源（论文版本、审稿意见、诊断报告）
- **研究主题页** — ResearchCommandCenter 中最近活动关联证据

预计变更：5-8 个文件，主要是前端接入。

### 2. Experiment.tsx 拆分（557 行）

实验记录页仍超过 500 行。拆分方案：

- `features/experiment/useExperimentList.ts` — 实验 CRUD、分组、筛选
- `features/experiment/ExperimentListPanel.tsx` — 实验卡片渲染
- `Experiment.tsx` — 仅组合

### 3. Settings.tsx 拆分（670 行）

设置页仍超过 600 行。已有较多 section 组件（AboutSection、MemorySection、RolesSection 等），主要是将页面级状态管理移入 hook：

- `features/settings/useSettings.ts` — 设置读写的统一 hook
- 页面仅做 section 组合

### 4. useResearchContext 数据链路验证

`useResearchContext.ts` 通过 `research_context_get_theme_context` 获取数据，但 `nextSteps` 和 `openQuestions` 字段当前后端返回空数组，需要 verify 实际数据流是否完整。

### 5. CHANGELOG 更新

补充 0.4.2 条目。

## 非目标

- 不新增功能入口
- 不修改 DB schema
- 不改提示词

## 预计提交

3-4 个提交，约 15-20 个文件变更。
