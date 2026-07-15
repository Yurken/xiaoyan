# 小妍内部 LLM Wiki 与混合检索

LLM Wiki 是小妍的内部知识编译层，不是面向用户的编辑页面。论文和笔记进入研究方向后，系统自动把分散材料整理为有稳定标识、来源依据、关系链接与修订记录的知识页；小妍在对话和知识检索时读取这些页面，用户不需要手工创建、编译或审核 Wiki。

## 1. 自动整理行为

自动整理由 SQLite 变更触发器和持久化后台队列驱动：

- 论文正文解析完成、标题或所属研究方向变化时自动入队；
- 笔记创建、修改、移动或删除时自动入队；
- WebDAV 同步写入论文或笔记时，同样由本地触发器入队；
- 同一研究方向的连续变化合并为一个任务，并等待 8 秒再开始；
- 后台串行编译，避免同时发起多组 LLM 请求；
- 每次最多处理 10 个变化来源，仍有剩余时自动接续下一批；
- 失败后从 30 秒开始指数退避，最长等待 6 小时；新的材料变化会立即重置退避；
- 应用启动时延迟 30 秒检查已有研究方向，补齐历史材料或其他设备同步来的变化。

用户界面不提供 Wiki 页签、页面阅读器、手工编译按钮或 Tauri Wiki 命令。Wiki 数据仅作为小妍的内部检索语料存在。

## 2. 应用逻辑

```mermaid
flowchart LR
    A["研究方向内论文 / 笔记"] --> B["SQLite 变更触发器"]
    B --> C["持久化去抖队列"]
    C --> D["内容哈希与来源增删检测"]
    D --> E["阶段 1：概念抽取与去重"]
    E --> F["阶段 2：知识页生成或合并"]
    F --> G["事务写入修订 / 来源 / 链接 / 分块"]
    G --> H["Embedding 与健康检查"]
    H --> I["语义 + 关键词 RRF 检索"]
    I --> J["小妍对话上下文 / search_knowledge 工具"]
```

### 两阶段编译

阶段 1 从变化来源抽取候选概念：稳定 `slug`、标题、页面类型、摘要、来源键和建议链接。候选按规范化 `slug` 合并，防止同一概念被多个来源重复建页。

阶段 2 读取候选引用的来源及同 `slug` 的已有知识页，生成合并后的 Markdown：

- 关键事实必须使用 `[source:paper:<id>]` 或 `[source:note:<id>]`；
- 页面关系使用 `[[target-slug|显示标题]]`；
- 来源冲突进入“争议与边界”，不能由模型擅自裁决；
- 更新旧页面时删除已经失去来源支持的断言。

所有页面生成完成后才开启 SQLite 事务。页面、修订、来源映射、链接和检索分块在同一事务中提交，模型中途失败不会留下半套知识页。

### 来源删除与移动

增量检测不仅比较现有来源哈希，也比较上次编译清单。论文或笔记被删除、移出研究方向时：

1. 立即把引用该来源的知识页归档并删除其检索分块，避免小妍读到过期内容；
2. 清理失效来源映射和该研究方向的编译哈希；
3. 用全部现存来源分批重建；
4. 仍有依据的概念复用原 `slug` 和页面记录，没有依据的页面继续归档。

## 3. 数据模型

| 表 | 职责 |
| --- | --- |
| `wiki_pages` | 当前内部知识页、稳定 slug、置信度与当前修订号 |
| `wiki_page_revisions` | 每次模型编译的不可变快照 |
| `wiki_page_sources` | 知识页到论文/笔记的来源映射 |
| `wiki_page_links` | 知识页之间的关系链接 |
| `wiki_page_chunks` | 带标题路径、内容哈希和可选 embedding 的检索分块 |
| `wiki_compile_sources` | 每个来源的上次内容哈希和编译运行 |
| `wiki_compile_runs` | 编译状态、处理来源数、页面数和错误 |
| `wiki_issues` | 缺失来源、断链、孤立页和非法引用等检查结果 |
| `wiki_compile_queue` | 本机自动整理任务、执行时间、重试次数和最近错误 |

知识内容表进入本地备份和 WebDAV 同步。`wiki_compile_queue` 是本机可重建的运行状态，不参与同步；同步资料落库后会在目标设备自动重新入队。

## 4. 小妍如何读取

统一检索覆盖论文分块、知识笔记和内部 Wiki 分块。语义通道使用 cosine similarity，关键词通道对标题与精确术语加权，最终通过 Reciprocal Rank Fusion 合并：

```text
score(d) = Σ channel_weight / (60 + rank(d))
```

同一论文或知识页的多个分块按实体聚合；直接命中 Wiki 时，可以扩展一跳知识页关系。自动生成页面保持 `draft` 来源标记并按 `0.72` 降权，原始论文和笔记证据仍优先。Embedding 未配置或请求失败时自动退回关键词检索。

内部 Wiki 目前只由以下后端路径消费：

- `chat_context_service`：为小妍构建对话上下文；
- `search_knowledge` Chat Tool：小妍主动查询本地知识；
- RAG 服务：与论文、笔记结果统一融合。

## 5. 参考实现与取舍

参考源码位于被 Git 忽略的 `tmp/llm-wiki-references/`：

| 仓库 | 参考版本 | 许可证 | 采用的设计思想 |
| --- | --- | --- | --- |
| `atomicstrata/llm-wiki-compiler` | `bed4dda` | MIT | 两阶段编译、哈希增量、事务写入与来源追踪 |
| `NiharShrotri/llm-wiki` | `940730b` | MIT | draft/merge 流程、运行记录和混合检索 |
| `nashsu/llm_wiki` | `9b71ade` | GPL-3.0 | 仅参考 Rust/Tauri、RRF 和图扩展架构；未复制源码 |

当前实现继续使用 SQLite 与 JSON embedding，没有引入独立向量数据库，也没有复制 GPL 代码。

## 6. 开发验证

```bash
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml services::wiki
pnpm --filter @research-copilot/desktop exec vitest run src/__tests__/pages/Knowledge.test.tsx
pnpm type-check
pnpm lint
```

测试覆盖队列触发与去抖、失败退避、来源删除失效、候选去重、修订写入、健康检查、RRF 聚合，以及无 embedding 时的关键词召回。
