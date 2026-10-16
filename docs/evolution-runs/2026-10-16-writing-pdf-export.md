# 2026-10-16 · PDF 预览下载的保存反馈

## 本轮约束与证据范围

按用户最新要求，本轮只改源码、补测试文件、静态阅读与检查 diff，**未运行测试、类型检查、lint、构建、浏览器或原生编译**。新增用例尚未执行，不能当作通过证明；上一切片的运行结果不适用于本轮。

所有项目文件位于 lab5090 的 `/root/cmq/xiaoyan`，从 `2b6c69a9` 继续 `codex/lab5090-iteration`，仅本地提交，不推送、不创建 PR、不部署。Rust 容器保持停止，本轮不启动服务或实际文件导出。

## 缺陷与改动

真实下载按钮原来调用 `WritingPreviewPanel.PdfPreview.handleSave`，其 catch 忽略保存对话框、读取和写入错误。用户点击后无法区分失败与取消，快速重复点击也可并行打开保存流程。此判断来自真实 UI 调用链的静态阅读，不是运行复现。

本轮将文件操作抽到 `useWritingPdfExport`，由外层 Panel 持有：

- 点击时同步锁定一次导出；对话框、读取、写入期间重复点击无效。锁不因同一 Panel 内切换 PDF 或 PDF/结构标签而解除。
- 固定点击时的源路径。已经打开的选择器获确认后，即使当前 PDF 改变，也完成原源文件的保存；异步导入返回前已切换或卸载时，不再打开旧选择器。
- 提示按 PDF 访问绑定，A→B→A 的第一次 A 不能向第二次 A 写回提示，旧回调也不能开始新的导出。旧操作结束仍释放当前 Panel 的忙碌状态。
- 用户取消不报成功或失败；对话框、读取、写入异常显示具体错误并提供“重试保存”。只有写入完成才显示成功及目标文件名。
- 下载按钮保存期间禁用并展示忙碌状态。普通预览和全屏使用同一反馈组件，沿用主题变量，状态使用 status/alert。全屏反馈右侧留出关闭按钮空间，长错误可换行。

这不是全局互斥：工作台切到纯编辑视图会卸载整个 Panel；再挂载的新 Panel 不共享旧实例的导出锁。已确认的旧导出可以继续完成，但不能向新实例写入提示。

## 测试文件（待用户执行）

- `apps/desktop/src/__tests__/features/writing/useWritingPdfExport.test.ts`：真实 hook，模拟 Tauri 文件/选择器边界；覆盖同步重复触发、三个异步阶段、取消和重试、写入后才成功、源目标同路径时先读后写、文件名、切换、卸载、旧闭包和 StrictMode。
- `apps/desktop/src/__tests__/features/writing/WritingPdfExportFeedback.test.tsx`：状态和错误可访问性、重试与间距传递。
- `apps/desktop/src/__tests__/features/writing/WritingPreviewPanel.test.tsx`：真实 Panel 与 hook 接线；仅用合成字节和 PDF 文档桩，覆盖失败重试、全屏和结构标签期间的锁。

后续可由用户执行以下定向命令；本轮没有执行：

```bash
pnpm --dir apps/desktop exec vitest run src/__tests__/features/writing/useWritingPdfExport.test.ts src/__tests__/features/writing/WritingPdfExportFeedback.test.tsx src/__tests__/features/writing/WritingPreviewPanel.test.tsx --maxWorkers=1
```

## 技术依据与范围选择

研究日期：2026-10-16。Tauri 官方说明 save 返回所选路径或取消；本轮将其与实际文件写入分成独立阶段，不能把选中路径当作保存成功。[Tauri dialog.save](https://v2.tauri.app/reference/javascript/dialog/#save)

保留现有 plugin-fs 的 readFile→writeFile 传输。仓库原生 `writing_copy_pdf` 直接调用 `std::fs::copy`，缺少同文件/硬链接别名防护；Rust 官方明确相同源目标很可能发生截断，因此本轮未直接接入这一优化。这里只保证代码先读后写的顺序，不声称文件写入原子性，也不声称减少整个 PDF 的 JS 内存开销。[Rust std::fs::copy](https://doc.rust-lang.org/std/fs/fn.copy.html)

PDF 访问状态在带条件的 render 中重置，并由短小 layout effect 登记已提交 scope；沿用上一切片的模式，避免旧反馈随新 PDF 提交。此处是官方模式的项目内应用，实际行为仍待用户运行回归。[React：Adjusting some state when a prop changes](https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes)、[React useLayoutEffect](https://react.dev/reference/react/useLayoutEffect)

## 静态审查与限制

独立静态审查检查了真实入口、导出 scope 与锁的分离、错误路径、取消和成功时机，发现全屏关闭按钮与重试区域重叠，已为全屏反馈预留右侧空间。最终独立复审已覆盖实现与三份测试文件，并核对 fixture 类型、真实标签按钮语义和全局 mock/cleanup，未发现剩余必须修正的问题。只执行了 git diff --check 和 Git 范围核验，master、lockfile 和五个子模块 pin 未变。没有浏览器截图或布局运行验收；测试文件仍须执行。

PDF 加载/绘制的资源生命周期、编译按钮完成动画和 LaTeX 安装器状态属于独立问题，本轮未修改。没有依赖升级、原生协议或持久化格式变更；回滚可使用本切片的普通 git revert。
