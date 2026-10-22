# DSH 内嵌认证回归记录

日期：2026-10-22。

## 问题与原因

桌面端自动发现本机 DSH `0.1.5-rc.1` 后，进程状态为运行中，但页面提示 `dsh web authentication required`。

该版本的官方 Web 入口通过 `GET /?token=…` 换取绑定 hostname 和 port 的签名 Cookie，再重定向到 `/`。Cookie 带 `HttpOnly; SameSite=Strict`；小妍的页面与 DSH loopback 页面属于不同站点，iframe 中无法完成这一认证流程。原有 URL 解析已经保留查询参数，单独补传 token 无法解决 Cookie 被阻止的问题。

## 处理方式

- Desktop 在主窗口内容区创建独立的原生 WebView，使用启动时返回的完整 URL，使 DSH 在顶层浏览上下文中完成官方认证；普通浏览器预览仍保留 iframe。
- `useDshRuntimeView` 负责视图创建、容器尺寸同步、重试与清理。退出页面或更换启动 URL 时关闭视图；异步创建晚于页面卸载时，同样关闭迟到视图。
- 运行控制使用在远程视图之后创建的小型透明本地 WebView，保持悬浮、拖动和位置记忆；浏览器预览继续使用原有浮窗。拖动使用屏幕坐标，防止浮窗自身移动导致坐标反馈；窗口调整时限制在内容区内，并支持方向键移动、Home 或双击复位。
- 启用 Tauri 的 `unstable` 多 WebView 功能，并只向现有本地能力配置添加创建、关闭、定位和调整尺寸的权限；没有添加远程页面的 IPC 授权。
- 多 WebView 窗口不再符合 Tauri `WebviewWindow` 的单视图判定，运行期主窗口查找改用 `get_window`，覆盖托盘唤起、助手定位和会话接续。

本轮同时将 DSH 锁定版本和本机 npm 安装升级为 `0.2.1-rc.2`，没有调整 DSH 的认证或 Cookie 策略。其他运行时的版本与证据见[升级记录](./evolution-runs/2026-10-22-harness-runtime-upgrade.md)。

## 验证

- Harness 与 checkpoint Vitest：8 个测试文件、33 项通过；覆盖完整启动 URL、远程与本地视图尺寸同步、卸载、两类迟到创建、重启替换、失败重试、拖动持久化和键盘移动。
- 仓库 `pnpm lint`：通过，现有 48 条警告。
- `cargo check --offline --lib`：通过。
- macOS 原生窗口人工验证：本机 DSH `0.1.5-rc.1` 和升级后的 `0.2.1-rc.2` 均成功显示官方页面；离开页面后原生视图移除；返回、重启和全屏切换后页面正常。新版浮窗可拖动，切页返回保留位置，停止后两个原生视图均移除；Pi `0.12.2` 私有运行时也成功显示官方页面。
- `pnpm type-check`：通过。为恢复完整检查，将 3 个既有写作测试文件中 10 处字节夹具的 deferred 泛型改为 `typeof pdfBytes`，只修正类型宽度。
- 扩展写作回归有 1 项既有失败：`useWritingPdfPreview` 的“原生模块导入恢复前发生 switch 时不启动旧文件读取”。从 `242fec19` 提取原始测试单独运行，同样失败；其余 37 项通过。本轮不改写作预览业务逻辑。

Windows/Linux 原生窗口以及发布安装包的实机验收尚未执行。
