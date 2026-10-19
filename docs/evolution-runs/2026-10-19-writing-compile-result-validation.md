# 编译结果结构校验（2026-10-19）

## 核实的问题

useWritingCompiler 的 loadCompileResult 原来只捕获 JSON.parse 语法错误，随后将任意解析值断言为 WritingCompileSummary。合法 JSON 中的空对象、缺少字段或错误字段类型会进入编译状态。WritingWorkspace 在 libraryReady 提前返回前就调用 isLatexCompilerMissing；后者直接使用 result.log.includes，因而坏缓存可以使工作区渲染失败。engine/log 还会作为文本渲染，pdfPath 会交给 PDF 预览和导出。

原生 commands/writing.rs 的 WritingCompileResult 明确序列化五个字段：success 为 boolean，pdfPath 为 string 或 null，workDir/engine/log 为 string。当前 Rust 构造符合这个约定，没有发现它实际产生坏数据。但 client 的 invoke 泛型只提供静态类型，旧 hook 在使用字段前就会缓存返回值，因此同时保护这个入口，避免桥接或版本异常将错误结构再次持久化。

## 实现

- 在 writing/shared.ts 增加 parseWritingCompileSummary，接收 unknown，拒绝 null、数组、非对象、缺字段及错误字段类型，不做隐式转换。返回仅含已校验的五个字段的新对象。
- 缓存读取在 JSON.parse 后调用同一解析器。坏缓存、语法错误和存储不可访问都返回 null；加载发生在 render 初始化/文稿切换中，因此不在加载时删除或改写 localStorage。
- 原生返回先检查当前编译 lifetime，再校验结构，然后才缓存和发布结果。活动请求结构无效时走已有 catch/finally，显示“编译器返回的结果格式无效，请重新编译。”、进入 failed/null 并释放请求锁。过期请求继续静默忽略。
- 保持 v1 存储键、文稿 scope、成功/失败分类和恢复缓存时的 idle 状态。允许额外字段、未知引擎、平台路径和空字符串；额外字段不进入规范化结果。success 与 pdfPath 的关联仍由原有编译分类处理，保留“成功标记但没有 PDF”的日志。
- 页面布局、PDF 导出、原生编译和安装入口不变。没有新增依赖、后台任务、轮询或额外文件读取。

## 待执行验证

writingCompileResult.test.ts 新增 23 个参数展开用例，覆盖容器/字段结构错误、缺少各字段、有效成功/失败/未安装结果、额外字段与新引擎和 Windows 路径、空字符串以及成功但缺 PDF 的兼容语义。

useWritingCompiler.test.ts 补充 8 个参数展开用例，覆盖真实 hook 与 isLatexCompilerMissing 消费链：合法 JSON 坏结构不进入状态、切换坏缓存文稿不暴露旧结果、坏原生返回不缓存且可重试、过期坏返回不发布反馈，以及有效失败缓存保留日志和安装提示。

本轮共 31 个新增待执行用例。遵守用户要求，测试文件全部未执行；未运行 test/typecheck/lint/build、原生编译、浏览器、真实 opener、服务或容器。只进行源码/测试文本静态审查及 Git 空白检查，不声称编译、类型检查或测试通过。项目操作限 lab5090，中文本地提交，不 push/PR/deploy。

## 边界

本轮只验证字段结构，不验证路径存在、文件内容、缓存与当前文稿内容是否匹配，也未增加日志大小限制或缓存淘汰策略。结构有效的旧结果仍可恢复；损坏缓存保留在存储中但不会发布，下次编译按既有流程尝试清除。存储清除/写入失败仍按可选缓存处理，不改变实际编译结果。测试使用合成路径与 mock invoke，未访问真实用户缓存、数据库或附件，也未启动真实 LaTeX 进程。
