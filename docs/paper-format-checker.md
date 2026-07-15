# 论文格式检测工具

## 定位

「论文格式检测工具」是投稿准备阶段的辅助工具，帮助作者在提交前自动识别 PDF/Word 论文中的格式问题，生成**分类清晰的审校报告与修改建议**。

支持预设模板（会议/期刊官方模板）与自定义模板/要求，覆盖标题层级、字体字号、页边距、行距、页码、图表编号、参考文献等常见检查项。

---

## 解决的核心痛点

| 痛点 | 说明 |
|---|---|
| 格式问题导致 desk reject | 页边距、字数、引用格式不符会被直接拒稿 |
| 人工检查效率低 | 投稿前逐页核对格式耗时且容易遗漏 |
| 模板要求分散 | 不同会议要求不同，难以集中管理 |
| 修改建议不具体 | 只知道"不对"，不知道"怎么改" |

---

## 核心功能

### 1. 模板库与自定义规则

**预设模板**：
- ACL / EMNLP / NAACL（Anthology 风格）
- CVPR / ICCV / ECCV（CVF 风格）
- NeurIPS / ICML / ICLR
- IEEE 会议 / 期刊
- Springer LNCS
- Nature / Science 系列
- 国内学位论文模板（各高校）
- 国家自然科学基金申请书

**自定义规则**：
- 用户上传 Word/PDF 模板或填写规则表单
- 支持正则 / 关键词匹配自定义检查项
- 可设置"必须包含"与"禁止出现"的元素清单

### 2. 自动检测项

| 检查类别 | 具体检测项 |
|---|---|
| **页面设置** | 页边距（上下左右）、纸张大小、页眉页脚高度 |
| **字体字号** | 正文字体/字号、标题字体/字号、摘要/关键词字号、公式编号字体 |
| **段落样式** | 行距、段前段后、首行缩进、对齐方式 |
| **标题层级** | 层级编号连续性、层级深度、标题格式一致性 |
| **图表** | 编号连续性（Figure 1, 2, 3...）、标题位置、引用一致性 |
| **公式** | 编号连续性、公式与编号对齐 |
| **页码** | 是否连续、起始页、位置与格式 |
| **参考文献** | 引用与列表一致性、编号/作者年份格式、URL/DOI 完整性 |
| **字数统计** | 摘要字数、正文字数、章节字数分布 |
| **隐藏项** | 批注、修订痕迹、空白页、低分辨率图片 |

### 3. 分类审校报告

检测报告按严重程度与类别组织：

```
📋 格式审校报告
├── ❌ 严重问题（必须修改）
│   ├── 页边距不符合要求（当前 2.5cm，要求 2.54cm）
│   └── 参考文献 [3] 在正文中未被引用
├── ⚠️ 警告问题（建议修改）
│   ├── 图 2 标题未使用要求字体
│   └── 摘要字数超出限制（320 / 250）
├── ✅ 通过项
│   ├── 标题层级连续
│   └── 页码连续
└── 📎 修改建议
    ├── 建议将页边距统一调整为 2.54cm
    └── 建议补充对参考文献 [3] 的引用或删除
```

### 4. 可视化定位

- 在 PDF/Word 预览中高亮问题位置
- 点击报告项跳转到对应页面
- 对 Word 文档支持一键应用部分简单格式修复（如批量调整标题样式）

---

## 技术实现要点

### 输入解析

| 文件类型 | 解析方案 |
|---|---|
| PDF | lopdf 提取文本块、字体、坐标、页面尺寸 |
| DOCX | python-docx / docx-rs 读取样式、段落、节属性 |
| LaTeX | 正则解析导言区 + 宏包命令 |

### 检测引擎设计

采用**规则插件化**架构：

```
FormatChecker
├── Parser（PDF / DOCX / LaTeX）
├── Normalizer（统一为内部文档模型）
├── Rule Engine
│   ├── PageRule
│   ├── FontRule
│   ├── HeadingRule
│   ├── FigureRule
│   ├── CitationRule
│   └── CustomRule
└── Report Builder
```

内部文档模型示例：

```rust
struct DocumentModel {
    pages: Vec<Page>,
    paragraphs: Vec<Paragraph>,
    headings: Vec<Heading>,
    figures: Vec<Figure>,
    equations: Vec<Equation>,
    references: Vec<Reference>,
}

struct Paragraph {
    text: String,
    page: usize,
    bbox: Rect,
    font: String,
    font_size: f32,
    line_height: f32,
    style: ParagraphStyle,
}
```

### 模板规则配置

```yaml
# templates/acl2024.yaml
name: ACL 2024
type: conference
page:
  width: 210mm
  height: 297mm
  margin_top: 25.4mm
  margin_bottom: 25.4mm
  margin_left: 25.4mm
  margin_right: 25.4mm
font:
  body: { family: "Times New Roman", size: 11pt }
  title: { family: "Times New Roman", size: 17pt, bold: true }
  abstract: { size: 10pt }
heading:
  level_1: { size: 14pt, bold: true }
  level_2: { size: 12pt, bold: true }
limits:
  abstract_words: 250
  max_pages: 8
```

### 数据模型建议

```sql
-- 格式模板
format_templates (
  id TEXT PRIMARY KEY,
  name TEXT,
  category TEXT,          -- conference | journal | thesis | custom
  source TEXT,            -- builtin | user_upload
  rules JSON,             -- 完整规则配置
  created_at INTEGER
);

-- 检测任务
format_check_tasks (
  id TEXT PRIMARY KEY,
  submission_id TEXT,     -- 可选，关联投稿
  file_path TEXT,
  template_id TEXT,
  status TEXT,
  report JSON,
  created_at INTEGER,
  completed_at INTEGER
);

-- 检测规则命中记录
check_issues (
  id TEXT PRIMARY KEY,
  task_id TEXT,
  rule_id TEXT,
  severity TEXT,          -- error | warning | info
  category TEXT,          -- page | font | heading | figure | citation ...
  message TEXT,
  location TEXT,          -- JSON：{ page, bbox, paragraph_index }
  suggestion TEXT
);
```

---

## 与现有模块的关系

- **投稿管理**：格式检测作为投稿条目的「投稿前检查」步骤
- **论文精读**：复用 PDF 解析能力，但侧重版面信息而非语义内容
- **实用工具集**：作为独立工具入口，也支持从投稿页直接触发
- **多 Agent 评审**：格式问题可作为 Writing Reviewer 的输入之一

---

## 实现阶段

### MVP（4-6 周）

- [ ] 支持 PDF 与 DOCX 解析
- [ ] 实现 5 个核心检测规则：页面、字体、标题、图表、页码
- [ ] 内置 3-5 个常用会议模板（如 ACL、CVPR、IEEE）
- [ ] 生成文本版审校报告
- [ ] 在实用工具集中新增「格式检测」入口

### 进阶（6-10 周）

- [ ] 支持 LaTeX 源文件检测
- [ ] 扩展至参考文献引用一致性、公式编号、字数限制
- [ ] 自定义规则编辑器（YAML / 表单）
- [ ] 报告与 PDF 预览联动高亮
- [ ] 对 DOCX 支持一键修复简单格式问题

### 未来扩展

- [ ] OCR 检测扫描版 PDF 的格式
- [ ] 与会议投稿系统 API 对接，自动拉取最新模板要求
- [ ] 格式历史对比：同一论文不同版本的格式差异

---

## 验收标准

- [ ] 常见会议模板的页边距、字体、标题检测准确率达到 90% 以上
- [ ] 单篇 8 页论文检测耗时 ≤ 15 秒
- [ ] 报告支持按严重程度和类别筛选
- [ ] 用户上传的自定义规则可被正确解析并执行
