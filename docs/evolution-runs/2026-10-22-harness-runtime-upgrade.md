# Harness 运行时升级与 DSH 浮窗回归

日期：2026-10-22。基线：`242fec19`，分支 `codex/iteration`，小妍 `0.6.0-dev.1`。本轮登记运行时兼容升级，不登记开发模型升级；模型指纹为 `not_invoked`。

后续范围调整：用户决定仅继续 DSH，Codex/OpenCode/Pi 已注释产品入口和后端注册，保留本轮升级后的源码、版本和已有数据。下方四类验证属于前序兼容基线；当前仅启用 DSH，详见 [DSH 单工具开发约定](../dsh-only-development.md)。

## 候选指纹与采用范围

| 运行时 | 原清单 | 本轮官方发布 | 源码锁定 |
| --- | --- | --- | --- |
| DSH | 0.1.1-rc.2 | [0.2.1-rc.2](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.2.1-rc.2) | `687f282e8625c6b8d11ff58211a90524be2e4317` |
| Codex | 0.150.1 | [0.163.0](https://github.com/openai/codex/releases/tag/rust-v0.163.0) | `83086188ae0614bd882818ff1aa23f3194962012` |
| OpenCode | 1.18.23 | [1.19.3](https://github.com/anomalyco/opencode/releases/tag/v1.19.3) | `e3c4eb242585dcd77be1a867391b7c25fd47ce52` |
| Pi Web | 0.8.11 | [0.12.2](https://github.com/agegr/pi-web/releases/tag/v0.12.2) | `b017cd48425d05aa4952051db2e4fc031c134094` |
| Pi 独立源码 | 原子模块指针 | [1.4.0](https://github.com/earendil-works/pi/releases/tag/v1.4.0) | `4a080252f06caf63a525d7873c5d94d3c23887e0` |

版本以当日官方发布标签和 npm latest 为依据。DSH 官方 latest 本身仍为 RC。Pi Web 官方包使用 Pi SDK `1.2.0`，本轮保留其依赖组合；独立 Pi 源码 `1.4.0` 不代表强行替换 Web 包内 SDK。

本机自动发现的 DSH 从 `0.1.5-rc.1` 升至 `0.2.1-rc.2`，Codex 升至 `0.163.0`；Homebrew 管理的 OpenCode 从 `1.18.4` 升至 `1.19.3`，保持原安装方式。应用内重新安装将 Pi 私有运行时从 `0.8.11` 升至 `0.12.2`。未覆盖已安装的“小妍.app”发布包。

## 故障与能力差异

- 认证：旧 iframe 无法完成 DSH Strict Cookie 交换；改为原生顶层 WebView，保留启动 token、官方签名 Cookie 和重定向。原有 URL 解析并未丢失 token。
- 浮窗：运行控制位于上层透明本地 WebView，可拖动、记忆位置、随内容区尺寸约束并使用键盘移动；远程视图不再遮挡按钮。普通浏览器沿用 DOM 浮窗。
- 标题：四类工作区移除外层自写品牌标题，保留官方页面内容和启动控制。
- 生命周期：切页、重启、更换 URL、失败重试和迟到创建时清理两类原生视图；多视图下主窗口查找使用 `get_window`。
- 安装：DSH 构建工具与新版上游要求保持一致，使用 pnpm `11.28.5`；源码子模块和清单版本同步。

没有科研正确率、模型输出质量或任务成本改善证据；本轮不更换默认模型、不增加后台采集、不向远程页面授予 IPC。

## 固定评测与验证

核心固定夹具为 `XCG-core-agent-gates` v1。重放 checkpoint 交接、论文事实、离线策略、路由测试和评测器测试，核心断言保持原可信基线：均分 `2.5`、硬失败 `0`、未知硬失败断言 `0`。E01 的下一步可执行性及 E08 的回答脱敏仍未知。记录见[核心报告](../evaluations/xiaoyan-core-gates-v1-harness-2026-10-22.json)。成对评测器要求额外的分数提升，本轮没有将“持平”冒充模型升级收益。

`node scripts/harness-runtime-smoke.mjs <npm-prefix> <report-output>` 使用独立临时 HOME、XDG、DSH、Codex 和 Pi 目录，移除模型密钥变量，只监听 loopback，不发起模型任务。四项全部通过，结果见[传输回放报告](../evaluations/xiaoyan-harness-runtime-smoke-2026-10-22.json)：

- DSH：未认证 401、完整 token 交换、303 与 Strict Cookie、携带 Cookie 后官方 HTML。
- Codex：WebSocket 握手、initialize/initialized、thread/list。
- OpenCode：启动、global health、官方 HTML。
- Pi Web：启动、session list、官方 HTML。

Harness 和 checkpoint 的 8 个前端测试文件共 33 项通过。相关 Rust 的 dsh、codex、opencode、pi_web、runtime_installer、chat_request_policy、agent_routing_service 与 paper_fact 测试通过；`cargo check --offline --lib` 和本机调试构建通过。四类 verify-pin、runtime distribution、核心评测器测试通过；完整 `pnpm type-check`、`pnpm lint` 通过，lint 保留原有 48 条警告。

为完成完整类型检查，修正 3 个写作测试文件中 10 处字节夹具泛型宽度，没有更改生产写作逻辑。扩展写作回归有一项失败：“原生模块导入恢复前发生 switch 时不启动旧文件读取”；提取 `242fec19` 的原始测试单独重放，同样 1 失败、37 通过。该问题独立记录，不据此声称全部仓库测试通过。

macOS 原生窗口验证覆盖官方 DSH 页面认证、浮窗拖动、按钮点击、路由离开/返回、重启和全屏切换。浏览器 mock 不能替代原生证据。Windows/Linux、发布安装包以及真实付费模型任务尚未验收。

## 决策与回退

采纳本轮运行时锁定和认证/浮窗修复，收益是恢复用户已经遇到的认证与界面行为，证据不延伸为模型能力结论。若原生视图在其他平台存在问题，回退本轮集成与清单指针；不要通过修改上游 Cookie 或关闭认证恢复 iframe。

下一轮唯一主假设继续保持人工 checkpoint 配对任务，不增加新的模型质量主线。
