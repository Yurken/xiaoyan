# 多 Agent 评审投稿文件

## 定位

将现有的「AI 模拟审稿」从单模型判断升级为**多 Agent 角色化评审**，模拟真实学术会议/期刊的审稿流程。

不同 Agent 分别扮演不同审稿视角，独立审读投稿文件后由 Chair Agent 汇总冲突、生成综合意见与修改优先级，帮助作者在投稿前发现潜在问题。

---

## 解决的核心痛点

| 痛点 | 说明 |
|---|---|
| 单模型审稿视角单一 | 一个模型容易遗漏某类问题（如实验设计、理论保证、写作） |
| 审稿意见缺乏冲突检验 | 真实审稿人中常见意见冲突，单模型无法模拟这种张力 |
| 修改建议没有优先级 | 列出 20 条建议但不知从何下手 |
| 缺少与投稿文件的绑定 | 审稿意见没有与具体 PDF 版本、行号、章节关联 |

---

## 核心功能

### 1. 角色化审稿 Agent 池

每个 Agent 有明确评审职责与关注点：

| Agent 角色 | 评审重点 | 输出格式 |
|---|---|---|
| **Method Reviewer** | 方法创新性、假设合理性、理论保证、技术正确性 | 评分 + 优点 + 缺陷 + 问题清单 |
| **Experiment Reviewer** | 实验设计、数据集、评测指标、baseline、统计显著性、可复现性 | 评分 + 实验缺陷 + 建议补充 |
| **Related Work Reviewer** | 文献覆盖度、对比公平性、引用准确性、定位清晰度 | 评分 + 遗漏文献 + 对比建议 |
| **Writing Reviewer** | 结构清晰度、图表质量、语法表达、符号一致性 | 评分 + 具体修改位置 |
| **Impact Reviewer** | 问题重要性、贡献边界、潜在影响力 | 评分 + 贡献总结 + 风险提示 |
| **Rebuttal Reviewer** | 专门从反驳角度挑刺，模拟最强质疑 | 评分 + 尖锐问题 |

### 2. 评审流程编排

```
用户上传投稿 PDF
    ↓
Supervisor Agent 解析论文结构（摘要、方法、实验、相关工作、结论）
    ↓
并行分发至各 Reviewer Agent（每个 Agent 只读自己关注的章节 + 全文）
    ↓
各 Agent 独立生成审稿意见
    ↓
Chair Agent 汇总
    ├── 识别意见冲突（如 Method 赞而 Experiment 疑）
    ├── 生成综合评分与置信区间
    ├── 提炼 Top-K 必改问题
    └── 给出修改优先级（P0/P1/P2）
    ↓
输出结构化评审报告
```

### 3. 结构化评审报告

最终输出包含：

- **总体建议**：接收 / 小修 / 大修 / 拒稿（含置信度）
- **综合评分雷达图**：创新性、实验、写作、相关工作的多维评分
- **共识区**：所有 Reviewer 都认同的优点与问题
- **冲突区**：Reviewer 之间存在分歧的观点，附各方理由
- **必改清单**：按优先级排序，每条关联到 PDF 具体位置
- **修改建议**：逐条可执行建议，可一键转为待办或实验任务

### 4. 与投稿生命周期的联动

- 评审报告绑定到具体投稿条目与 PDF 版本
- 支持多轮迭代：修改后重新发起评审，对比两轮差异
- 评审意见可沉淀为「回复审稿人」素材库

---

## 技术实现要点

### Agent 提示策略

- 每个 Reviewer 使用**独立 system prompt + 角色卡**，避免互相干扰
- 使用**结构化输出**（JSON Schema / XML）统一返回格式
- 对实验部分采用**表格提取**：先抽取实验表格，再让 Agent 评判

### 冲突检测与 Chair Agent

Chair Agent 的核心任务不是再读一遍全文，而是：
1. 提取各 Reviewer 的评分与关键主张
2. 用 LLM 判断主张之间是否存在冲突
3. 对冲突项要求各 Reviewer 补充理由
4. 综合给出优先级排序

### 数据模型建议

```sql
-- 多 Agent 评审任务
submission_reviews (
  id TEXT PRIMARY KEY,
  submission_id TEXT,        -- 关联投稿条目
  pdf_version_id TEXT,       -- 关联 PDF 版本
  status TEXT,               -- pending | running | completed | failed
  overall_score REAL,
  overall_recommendation TEXT,
  radar_chart JSON,
  created_at INTEGER,
  completed_at INTEGER
);

-- 各 Reviewer 意见
submission_review_opinions (
  review_id TEXT,
  agent_role TEXT,
  score REAL,
  strengths TEXT,
  weaknesses TEXT,
  questions TEXT,
  recommendation TEXT,
  raw_output TEXT
);

-- 必改问题清单
submission_review_issues (
  id TEXT PRIMARY KEY,
  review_id TEXT,
  title TEXT,
  description TEXT,
  priority TEXT,             -- P0 | P1 | P2
  page_ref TEXT,             -- 如 "Page 4, Section 3.2"
  quote TEXT,                -- 原文引用
  source_agents TEXT         -- JSON 数组，哪些 Agent 提出
);
```

### 与现有模块复用

- **PDF 解析**：复用论文精读模块的文本与图表提取
- **协同台**：评审进度可在协同台可视化，展示各 Agent 状态
- **投稿管理**：评审任务作为投稿条目的一个阶段或标签页
- **记忆系统**：用户对评审结果的反馈可沉淀为长期记忆

---

## 实现阶段

### MVP（3-4 周）

- [ ] 定义 3 个核心 Reviewer 角色（Method / Experiment / Writing）
- [ ] 实现基于 Supervisor 的串行/并行评审编排
- [ ] 生成结构化文本报告（总体建议 + 优缺点 + 问题清单）
- [ ] 在投稿详情页新增「多 Agent 评审」入口

### 进阶（5-8 周）

- [ ] 扩展至 5-6 个 Reviewer 角色
- [ ] Chair Agent 冲突检测与优先级排序
- [ ] 评分雷达图与 PDF 位置锚定
- [ ] 多轮评审差异对比
- [ ] 评审意见一键转待办 / 实验任务

### 未来扩展

- [ ] 支持期刊/会议特定审稿风格模板（CVPR、ACL、Nature 等）
- [ ] 用户自定义 Reviewer（如强调伦理、公平性）
- [ ] 与真实审稿历史对比，校准 Agent 评分偏差

---

## 验收标准

- [ ] 单篇论文评审可在 5 分钟内完成（含 PDF 解析）
- [ ] 报告包含至少 3 个独立 Reviewer 意见
- [ ] 必改问题清单与 PDF 位置关联率 ≥ 70%
- [ ] 用户可将任意 issue 一键转为投稿待办或实验任务
