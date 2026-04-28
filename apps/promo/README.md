# 小妍 Research Copilot 宣传片

这是一个 60 秒 Remotion 宣传片，面向桌面端 AI 研究助手「小妍」。

## 分镜

| 时间 | 内容 |
| --- | --- |
| 0-6s | 品牌开场：从论文堆里，拉出清晰研究路线 |
| 6-14s | 科研流程痛点：找论文、读图表、写综述、管投稿分散割裂 |
| 14-23s | 多 Agent 协同台：任务拆解、执行轨迹、来源可观测 |
| 23-32s | 论文库与 AI 精读：PDF、图表、语义分块、复现建议 |
| 32-42s | 知识图谱与 Graph RAG：论文、笔记、记忆形成可检索网络 |
| 42-51s | 投稿管理：DDL、看板、版本、模拟审稿与回复跟踪 |
| 51-60s | 本地内核与按用途选模，收束品牌口号 |

## 使用

```bash
pnpm --filter @research-copilot/promo studio
pnpm --filter @research-copilot/promo render
pnpm --filter @research-copilot/promo render:poster
```

生成文件会输出到 `apps/promo/out/`。
