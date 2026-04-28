# Agent Rules

所有代理在修改本仓库前，先遵守 [docs/development-principles.md](docs/development-principles.md)。

本仓库的强约束：

- 不要继续把功能直接堆进超大页面或超大组件。
- 如果目标文件已经超过合理规模，先拆当前触达的逻辑，再继续改功能。
- 页面负责组合，`features/<domain>/` 负责功能，`shared.ts` 负责共享常量和纯函数。
- 远程调用、文件系统、Tauri、副作用、节流与状态机逻辑默认进入 hook，不直接留在页面 JSX 中。
- 完成结构性修改后，至少跑相关包 `type-check`；跨工作区修改时补跑 `pnpm type-check` 和 `pnpm lint`。

Codex 在本项目中的额外约束：

- 不要直接大范围阅读和修改代码。
- 遇到复杂分析、重构、生成测试、定位 bug 时，优先调用终端 `kimi` CLI。
- 调用 `kimi` 时不要一次性布置过多任务，应拆成小而明确的单项任务。
- 不要因为 `kimi` 在 12 步内没有返回就终止或杀死进程；除非用户另有指示，最多容忍 `kimi` 连续运行 30 分钟。
- `kimi` 返回结果后，Codex 只负责审查方案是否安全、可行、能否优化。
- Codex 仅做小范围应用修改、运行测试、指导 `kimi` 工作，并总结 diff。
