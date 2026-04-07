# Claude Project Instructions

在本仓库工作时，优先遵守 [docs/development-principles.md](docs/development-principles.md)。

执行要求：

- 避免继续扩张大文件；对遗留大文件的修改必须伴随抽离。
- 默认采用“页面组合 + feature 组件 + feature hook + shared 常量/纯函数”的结构。
- 新增弹窗、工作区、结果区或面板时，直接建立独立文件，不要内联在页面内。
- 不要在多个文件复制请求构造、字段映射或状态逻辑。
- 完成后执行必要的类型和 lint 校验，避免把生成物或临时文件带入变更。
