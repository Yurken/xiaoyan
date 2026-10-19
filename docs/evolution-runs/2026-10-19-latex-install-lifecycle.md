# LaTeX 安装入口的请求生命周期（2026-10-19）

## 核实的问题
useWritingCompiler 的编译请求已有文稿 scope 和 committed lifetime，安装器与安装说明入口则没有同步防重入保护。按钮 loading 依赖下一次渲染，因此同一 tick 的重复调用仍会多次触发原生 opener；第一个请求结束就会把共享 opening 状态设为 idle，即使第二个请求尚未返回。安装器的 clearStatus 位于 try 外，若该回调同步抛错，finally 不会执行，状态可能停在 opening。

切换文稿、A→B→A 或卸载后，旧入口仍可能继续调用反馈回调和设置本地状态。工作区已有 useWritingFeedback，会过滤来自旧文稿的提示；本次让安装入口自身也遵守生命周期，不依赖调用方恰好使用这一反馈 hook。保留的旧入口闭包也不能在离开其文稿访问后启动新的原生调用。

原生 writing_open_mactex_installer / writing_open_mactex_download_page 实际调用 open_url；它们没有安装过程或下载过程的取消句柄。opening 只表示等待打开请求返回，不表示安装进度。

## 实现
- 提取 useWritingLatexInstall，useWritingCompiler 委托原有两项安装动作和 latexInstallerStatus，工作区接线与按钮样式沿用现有设计。
- 安装器和安装说明各有同步 pending 请求身份，在 setState 前预占。相同入口在途重复调用直接返回，两个不同入口互不占用对方的锁。
- draftId 改变时在 render 中创建新的 scope；layout effect 发布已提交的 lifetime，并在 cleanup 时失效。A→B→A 的旧 scope 不恢复效力；StrictMode cleanup/setup 的旧请求也不能反馈给新 lifetime。
- pending 独立于文稿访问，原生 opener 已发出后在同一个 hook 实例内持续占用，直到原 Promise 结束。切换文稿不假装 OS 打开请求已经完成，当前视图继续呈现 opening。
- clearStatus 放入 try/finally，并在调用后再次检查当前 lifetime。同步抛错会走错误反馈及释放；若回调同步卸载或切换已提交视图，后续不再启动 native。
- 成功/错误反馈仅交给发起时仍有效的 lifetime。finally 按请求身份释放自己的锁；已卸载实例不再设置状态，已切换文稿但仍挂载的实例可恢复真实 idle。layout setup 根据尚存 pending 重新同步状态。
- PDF 预览使用另一个 useWritingPdfExport，其已打开选择器确认后继续保存点击快照的既有语义不属于本轮改动。useWritingCompiler 里未接到当前 UI 的 PDF 辅助方法也未扩展修改。

React 机制依据：[useLayoutEffect 的提交、cleanup 和 StrictMode 说明](https://react.dev/reference/react/useLayoutEffect)、[按前次 render 信息调整状态](https://react.dev/reference/react/useState#storing-information-from-previous-renders)。沿用项目既有 scope 模式；未通过运行或类型检查验证。

## 待执行验证
新增 useWritingLatexInstall.test.ts 的 15 个参数展开用例，使用真实 client 适配器，仅 mock Tauri invoke，以 deferred Promise 覆盖同 tick/在途防重入、原生成功失败与重试、clearStatus 抛错或同步卸载、跨文稿/A→B→A、旧闭包、卸载、StrictMode effect 重放及两个入口独立锁。

useWritingCompiler.test.ts 补 1 个真实父子 hook 接线用例：安装请求在途时编译仍可完成，切换文稿后编译状态独立重置而安装 busy 保留，旧安装完成不反馈，新安装说明可以正常反馈。

遵守用户要求：仅补测试文件，全部未执行；没有 test/typecheck/lint/build/编译、浏览器、真实 opener、服务或容器。仅源码/测试文本与独立静态审查、Git 空白检查，不声称测试通过。项目操作限 lab5090，本地中文提交，不 push/PR/deploy。

## 边界
这是同一个 hook 实例内的请求去重，不是全应用或跨窗口锁；真正卸载后创建的新实例可以启动自己的请求。不能取消已经交给 OS 的打开操作，也没有实现安装器下载、安装进度或超时。若原生 Promise 一直不结束，pending 会保留，避免以重试制造并行打开。没有新增常驻任务、轮询或定时器。
