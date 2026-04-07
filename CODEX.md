# Codex Project Instructions

在本仓库工作时，优先遵守 [docs/development-principles.md](docs/development-principles.md)。

执行要求：

- 不继续向遗留大文件内联追加功能；对大文件的修改必须伴随拆分。
- 默认采用“页面组合 + feature hook + feature component + shared.ts”的结构。
- 网络请求、文件系统、Tauri、副作用、节流和状态机逻辑不直接留在页面里。
- 新增弹窗、面板、工作区、结果区时，直接建立独立文件。
- 结构性修改后，至少通过相关包 `type-check`；跨工作区修改时补跑 `pnpm type-check` 和 `pnpm lint`。
