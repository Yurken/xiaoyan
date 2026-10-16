# 2026-10-16 · 写作编译回执的文稿隔离

## 本轮状态与用户约束

本轮按用户最新要求只修改源码、补齐测试文件并做静态审查，**未运行test、type-check、lint、构建、浏览器或LaTeX编译**。下面的缺陷分析来自源码控制流；新增用例是待用户执行的回归文件，不是RED/GREEN或运行通过证明。

所有项目文件在lab5090的`/root/cmq/xiaoyan`。以本地提交`6cf856bf`为起点，继续`codex/lab5090-iteration`；不推送、不创建PR、不部署。

## 问题与用户可感知的改动

旧`useWritingCompiler`在原生编译返回后直接写当前结果、状态与错误；切换文稿仅在effect中清空。由该控制流可推导：A编译期间切到B，旧A成功/失败可污染B；A→B→A时仅比较ID也不能分辨两次访问。hook切换首轮返回值还可能短暂包含旧PDF。

此外，缓存remove发生在编译try之外，异常会阻止原生调用且留下compiling；缓存set与原生结果混在同一try中，缓存失败会误报真实编译失败。

本轮实现：

- 每次文稿访问建立独立编译scope，在切换当次渲染重置状态，立即返回当前文稿缓存或空结果。
- layout生命周期只公布已提交scope；切换或卸载后，旧回执不再更新状态、错误或缓存。A→B→A使用新scope。
- 同一活动scope内同步预留在途标记，重复触发仅启动一次原生编译；结束后可再次编译。期间编辑仍对应点击时提交的内容快照，不自动再编译。
- 缓存读写仅为可选加速，异常不改变原生编译结果。
- 从大workspace抽出`useWritingFeedback`，将提示绑定文稿访问；切换立即清空旧提示，旧错误/成功/清除回调不能操作新文稿。同步新建/删除导航可明确给目标文稿保留成功提示。

不修改页面布局、主题、原生编译协议或依赖。沿用现有编译按钮、PDF预览和日志文案。

## 代码与待执行测试

- `apps/desktop/src/features/writing/useWritingCompiler.ts`：编译生命周期与可选缓存。
- `apps/desktop/src/features/writing/useWritingFeedback.ts`：文稿提示作用域。
- `apps/desktop/src/features/writing/useWritingWorkspace.ts`：组合接线，迁移模板/重置/新建/删除提示。
- `apps/desktop/src/__tests__/features/writing/useWritingCompiler.test.ts`：真实hook/client，仅模拟Tauri边界与存储故障。
- `apps/desktop/src/__tests__/features/writing/useWritingFeedback.test.ts`：即时切换、旧回调隔离及同步导航提示。

用户可后续自行运行的定向命令（本轮未执行）：

```bash
pnpm --dir apps/desktop exec vitest run src/__tests__/features/writing/useWritingCompiler.test.ts src/__tests__/features/writing/useWritingFeedback.test.ts --maxWorkers=1
```

如再运行检查，仍应采用单任务和内存限制；本轮不启动任何验证进程。

## 技术依据与成本

研究日期2026-10-16。React官方说明，依赖effect重置状态会让组件及子组件先接收到旧值；同组件在带条件的render中调整部分状态可避免该次旧值提交。本轮只重置编译/提示状态，不用整个写作工作台的key重建来丢失编辑器上下文。这是该模式的项目内应用。[React：Adjusting some state when a prop changes](https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes)

以layout effect的setup/cleanup登记已提交访问，避免在可能被放弃的render中修改活跃ref；cleanup后重新setup创建新lifetime，兼容StrictMode的额外生命周期检查。该effect仅做常数级ref登记，不执行编译、文件或网络操作。[React useLayoutEffect](https://react.dev/reference/react/useLayoutEffect)

成本为两个小范围状态对象和一个提示hook，无新增依赖、版本/工具链升级。真实收益仍待用户运行新增回归确认，不凭源码推断报告测试通过。

## 静态审查与证据边界

独立只读审查检查了真实调用链，认可同步去重与scope隔离；审查发现提取提示状态后遗留setter引用，已迁移并保留同步导航成功提示。最终独立静态复审未发现尚需修复的阻塞问题；两个新增回归文件及mock清理也经过静态阅读。没有用测试用例数量代替实际执行结果。

已执行的检查仅为文本/diff检查及Git范围核验，不等同类型检查或运行验收。没有浏览器截图，没有原生进程取消或加密/数据迁移变更。

范围外事项继续保留：
- 旧原生编译可能继续完成，本轮只忽略迟到回执，未终止进程或删除产物。
- LaTeX安装器opening状态仍是独立状态，未在此切片统一其生命周期。
- 预览组件自身的PDF加载/绘制状态与编译按钮短暂成功提示未在本轮运行验收；不能将hook返回值隔离等同于所有视觉状态已验证。
- 实际PDF预览下载仍走`WritingPreviewPanel`内独立路径，其错误反馈问题待独立处理；不能用本hook导出方法声称已修复。
- 缓存只按文稿ID索引，未加入内容hash或原生文件存在性验证，不声明缓存绝对新鲜。

回滚可对本切片做普通`git revert`；无持久化格式迁移。下一步优先静态排查实际预览下载的失败反馈与文件操作作用域，继续只补齐测试、不运行。
