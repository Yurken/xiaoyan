# PDF 预览失败后的原位重试与资源释放（2026-10-19）

## 核实的问题与方案

WritingPreviewPanel 的预览错误区此前只有“无法加载 PDF 预览”。useWritingPdfPreview 的加载依赖路径访问 scope，路径不变时不会重新读取；全屏切换只重绘，错误状态又会阻止重绘。因此临时读取、解析或绘制失败后，需要切到结构页再返回、换文稿或重新编译才能恢复。

2026-10-16 的资源切片有意在适配/绘制失败后保留 PDFDocumentProxy 和 loadingTask，以保留依赖 pdfDoc 显示的下载工具栏。这是已记录的策略，并非此前遗漏清理。当前源码核实 useWritingPdfExport 独立调用 readFile，再写入所选目标，并不需要 PDF.js 文档。因此本次将错误区下载入口与渲染文档解耦，失败时可发起资源清理，用户也可以直接重新加载原文件。

## 实现

- useWritingPdfPreview 提取私有 disposePreview，供加载清理和绘制错误统一使用。先使 lifetime 失效，再取消仍登记的绘制任务，然后调用唯一 loadingTask.destroy；重复 cleanup 不重复销毁，也不另调 document.destroy/cleanup。
- 活动适配/绘制失败时发布 pdfDoc=null、pdfLoading=false、pdfError=true，并立即发起上述清理。由取消或销毁导致的后续拒绝会被失效 lifetime 过滤。加载失败沿用相同的幂等清理。
- 新增 retryPreview，仅接纳当前已提交 scope 的错误状态。functional updater 将同一路径替换为新的 scope；首个重试改掉 scope 后，同 tick 的重复请求不会再次生效。加载中、已就绪、空路径以及过期/卸载闭包不能重启加载。
- 新 scope 立即返回空文档和 loading，旧错误、页数和工具栏清除；原有作用域隔离覆盖旧 fit/getPage/render 的迟到回执。没有自动重试、定时器或重新编译调用。
- 提取 WritingPdfPreviewError 展示错误、重新编译提示、“重试预览”和“下载 PDF”。保持现有灰底白字设计，提供焦点环和可换行按钮；错误区使用 alert，加载区提供命名 status。
- 错误时可独立保存原文件；保存锁、成功/错误反馈和确认选择器后的点击源语义仍由上层 useWritingPdfExport 管理。预览重试与导出状态独立；文件仍不可读时，保存入口会使用已有的失败反馈。
- 同路径重试不重置全屏状态，独立关闭按钮仍可使用；成功后恢复画布和原工具栏。旧的资源生命周期文档增加后续调整提示，保留当时实现记录。

## 待执行验证

useWritingPdfPreview.test.ts 更新原“绘制失败保留文档”的断言，并补 7 个参数展开用例，覆盖同路径失败重试、请求去重、旧闭包、迟到异步隔离与 StrictMode。WritingPreviewPanel.test.tsx 新增 5 个真实 Panel/hook 接线用例，覆盖读取失败重试与 loading、连续失败可再次重试、解析失败后保存原文件及保存锁、全屏绘制失败后在 portal 内恢复，以及在途保存跨预览重试保留锁和成功反馈。本轮共新增 12 个待执行用例。

所有用例只使用合成路径和 Tauri/PDF.js/canvas 边界 mock；本轮没有执行测试、typecheck、lint、build、浏览器或原生编译，也没有读取真实用户文件或启动服务/容器。静态复读和 Git 空白检查不能证明真实 worker、画布或类型检查通过。操作限 lab5090，仅本地中文提交，不 push/PR/deploy。

## 边界

原生 readFile 不可取消，仍可能在离开页面后完成读取；结果会被隔离。PDF.js 销毁是异步且可能拒绝，代码接住并警告，不能保证立即归还内存或新旧 worker 完全不重叠。本轮没有测量内存改善，仍采用整文件读取和全页画布，也未引入文件大小限制、虚拟化或超时。若源文件已移动、删除或内容损坏，重试可能继续失败；页面提供重新编译提示，不修改文件或静默替换文稿。
