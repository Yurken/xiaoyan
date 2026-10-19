# 2026-10-16 · 写作 PDF 预览的资源生命周期

> 后续调整（2026-10-19）：绘制失败后改为释放加载所有者，错误区独立保留下载并提供原位重试，详见 [预览重试切片](2026-10-19-writing-pdf-preview-retry.md)。下文保留本轮当时的实现记录。

## 用户约束与本轮范围

延续用户“本次所有修改不用跑 test，只补齐 test 文件”的要求，本轮**未运行测试、类型检查、lint、构建、浏览器、原生编译或服务**。只修改源码、编写待执行测试、静态审查及检查 diff；没有测量浏览器内存，不能声明内存下降幅度或真实 PDF 渲染已经验收。

项目仍为 lab5090 的 `/root/cmq/xiaoyan`，从本地 `262b37ee` 继续 `codex/lab5090-iteration`。仅本地提交，不推送、PR 或部署，专用 Rust 容器不启动。

## 源码证据与修复

原 `WritingPreviewPanel` 只保存 `getDocument(...).promise` 的结果，未持有 loadingTask；切换和卸载只取消绘制任务，没有调用 PDF.js 的资源销毁入口。迟到的文档结果被忽略，但其所有者没有释放。首页适配的 getPage 和逐页绘制的 getPage/getViewport/page.render 也未完整捕获错误。

根据仓库“先抽离当前触达逻辑”的规则，新增 `useWritingPdfPreview` 统一管理文件读取、PDF 加载、首页适配及绘制。Panel 保留 UI 组合、缩放和鼠标交互。

- 每次 PDF 路径访问建立独立 scope；切换当次渲染返回新文档的加载状态，不把旧 PDF 和旧下载工具栏交给新路径。
- 每个 effect 生命周期单独持有 loadingTask 和在途绘制任务，StrictMode 重放不会复用已销毁的所有者。
- 路径变化、结构页切换、预览卸载和加载失败时，先使该次生命周期失效，再取消其绘制任务，最后调用 loadingTask.destroy。
- 已加载和仍在加载的文档使用同一销毁入口；不再额外调用 doc.destroy 或渲染期间不安全的 doc.cleanup。
- 动态导入和文件读取返回后先检查生命周期；过期读取不会创建新 worker。原生 readFile 本身没有被取消。
- 适配与绘制的整条异步链都有错误处理。活跃错误进入现有“无法加载 PDF 预览”界面；旧访问、旧全屏绘制轮的迟到拒绝不改变当前界面。
- 适配/绘制真实失败时同步标记并取消同一文档的其余绘制，避免继续画已卸载的 canvas。已加载文档保留至切源或卸载，以保留已有下载入口。
- 全屏切换只取消上一轮绘制并在新 canvas 上重绘，不重新读取文件或销毁加载所有者；滚轮监听随全屏容器重新绑定。
- destroy 的同步异常和异步拒绝被接住并记录警告，不产生未处理拒绝或向新文档写入错误。

## 待执行回归文件

- `apps/desktop/src/__tests__/features/writing/useWritingPdfPreview.test.ts`：真实 hook，使用延迟 promise 与 PDF.js/Tauri 边界桩，覆盖加载/绘制所有权和切换时序。
- `apps/desktop/src/__tests__/features/writing/WritingPreviewPanel.test.tsx`：保留上轮保存交互，补全 loadingTask mock 及结构页、全屏、卸载和换源的实际 Panel 接线用例。

用户后续可运行的命令（本轮没有执行）：

```bash
pnpm --dir apps/desktop exec vitest run src/__tests__/features/writing/useWritingPdfPreview.test.ts src/__tests__/features/writing/WritingPreviewPanel.test.tsx --maxWorkers=1
```

桩验证不了真实 worker、canvas、磁盘权限和浏览器内存回收。没有用静态检查或新增用例数量代替运行通过证据。

## 官方依据与静态审查

研究日期：2026-10-16。读取了当前安装的 `pdfjs-dist@5.6.205` 类型及 `build/pdf.mjs`：LoadingTask.destroy 先标记 destroyed，再等待 transport 销毁，之后结束 worker；DocumentProxy.destroy 委托给 loadingTask.destroy。这支持“加载任务是唯一资源所有者”的实现选择。[PDF.js PDFDocumentLoadingTask](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib-PDFDocumentLoadingTask.html)

官方文档同时警告不要在绘制期间调用 document.cleanup，因此本轮使用取消绘制后销毁所有者，而非增加周期性 cleanup。[PDF.js PDFDocumentProxy](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib-PDFDocumentProxy.html)

独立静态审查发现适配失败可能留下另一条正在绘制的链，已补同步 renderFailed 标记、取消和错误状态依赖。最终独立静态复审已覆盖实现、hook 测试和实际 Panel 接线测试，未发现剩余必须修正项。git diff --check 未报告空白格式问题；master、锁文件及五个子模块 pin 保持不变。没有执行 type-check 或运行验证。

## 限制与回滚

本轮只覆盖写作预览，不改阅读器和文档检查器的 PDF 生命周期。保持现有整文件读取与全页 canvas 策略，没有加入虚拟化、数据大小限制或内存预算。销毁是异步且可能失败，不声明新旧 worker 绝不短暂重叠，也不声明浏览器会立即归还内存。

保留既有 UI、主题和导出功能，没有依赖/工具链升级、原生协议或持久化格式变化。可以普通 git revert 回滚本切片。编译按钮完成动画、安装器 opening 状态仍是独立后续候选。
