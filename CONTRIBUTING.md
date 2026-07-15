# 参与贡献

感谢你帮助改进小妍。功能建议和缺陷请先搜索已有 Issue；安全漏洞请按照 [安全政策](SECURITY.md) 私下报告。

## 开始之前

- 使用问题优先前往 [Discussions](https://github.com/Yurken/xiaoyan/discussions)；
- 可复现缺陷使用 Bug Report 模板；
- 功能建议使用 Feature Request 模板，并说明真实科研场景；
- 较大的功能或架构调整请先创建 Issue 讨论，避免重复投入。

## 本地开发

环境要求：Node.js 18+、pnpm 9+、Rust 工具链，以及 Tauri v2 对应平台依赖。

```bash
git clone https://github.com/Yurken/xiaoyan.git
cd xiaoyan
pnpm install
pnpm dev:desktop
```

开始修改前请阅读 [开发原则](docs/development-principles.md)。页面负责组合，功能放入 `features/<domain>/`；远程调用、文件系统、Tauri、副作用、节流和状态机默认进入 hook。

## 提交流程

1. 从最新默认分支创建聚焦的功能分支。
2. 添加或更新与行为变化匹配的测试和文档。
3. 运行与改动范围对应的 type-check、lint 和测试。
4. 按 `type: 中文描述` 提交，推送并创建 Pull Request。
5. 回应评审并保持 PR 范围聚焦；额外需求另开 Issue 或 PR。

常用验证命令：

```bash
pnpm type-check
pnpm lint
pnpm test
pnpm test:e2e
```

结构性修改至少运行相关包的 `type-check`；跨工作区修改需运行仓库级 `pnpm type-check` 和 `pnpm lint`。

## 提交规范

提交信息使用 `type: 中文描述`，例如：

```text
feat: 支持批量导入论文
fix: 修复切换论文后阅读位置丢失
docs: 补充本地开发说明
```

一个提交和一个 Pull Request 应聚焦一件事，不要夹带无关格式化、生成物或依赖漂移。

## 贡献许可

提交贡献即表示你有权提供相关内容，并同意按照本项目的 [Apache License 2.0](LICENSE) 授权该贡献。项目名称、Logo、角色形象等品牌素材不包含在代码许可证的品牌授权中，详见 [商标政策](TRADEMARKS.md) 与 [素材授权说明](ASSETS_LICENSE.md)。
