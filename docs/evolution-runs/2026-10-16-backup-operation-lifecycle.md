# 2026-10-16 · 备份弹窗操作生命周期

## 约束

在 lab5090 的 `/root/cmq/xiaoyan`、`codex/lab5090-iteration` 工作，起点 `89434d10`。遵守用户最新要求：只修改源码、补测试文件和静态审阅，不运行 test、type-check、lint、构建、浏览器、原生编译、真实备份或恢复；不读取真实用户文件，不启动服务或 Rust 容器。仅本地提交，不推送、不建 PR、不部署。

## 源码证据与取舍

旧备份确认按钮、Enter 和底层备份入口在 busy 时已有 UI 禁用，因此没有将“缺少 ref”本身当作普通点击可重入的证据。实际可达问题是：

- 备份处理中，密码弹窗的取消与背景仍会调用 closeModal；hook 清除 busy，但原生操作继续。随后可再开备份窗口，旧请求的 error/finally/closeModal 能影响新窗口。
- 文件选择与 readTextFile 全程没有 busy。即使原生选择器阻止父窗口交互，选择器关闭后的读取阶段仍可再次打开备份操作；旧读取可覆盖后打开的弹窗。
- picker/read 失败只设置 hook.error，页面没有在无弹窗时显示这项错误。
- 离开设置页后，旧导出或读取仍可能继续打开原生保存对话框或更新旧页面状态。

本轮选择让同一 hook 实例只容纳一个备份操作，而非允许并行后再竞争结果。选择、读取、导出、保存、导入及完成回调期间都保持锁；提交期间关闭按钮和密码输入明确禁用。配置文件弹窗的既有关闭方式保留。

## 实现

- useDataBackup 使用同步操作 token，在第一个 await 前占用操作；busy 覆盖完整链条。finally 仅释放自己的 token，不因弹窗成功重置而提前解锁。
- 操作期间，重复确认、重新打开导入/导出、关闭及密码修改均被 hook 拒绝；UI 同步禁用，防止原生请求或大文件读取重复叠加。
- 每次空闲重置弹窗都有新版本。旧窗口保留的确认、关闭、输入及打开回调不能改变或提交后一个窗口。
- layout effect 管理已挂载生命周期；每个异步原生阶段之前检查归属。卸载后迟到的 picker/read/export/save 结果不再启动下一步文件读取、保存或写入，也不提交本地 UI 状态。
- 已开始的文件写入和原生导入不能由该锁取消；导入的 onImported 完成回调仍执行，本地反馈只作用于当前实例。StrictMode 的 effect 重放拥有不同生命周期标识，正常挂载后的操作仍可开始。
- CryptoConfigModal 新增可选 interactionLocked，默认为 false。只有备份入口传入 backupBusy；该状态禁用取消、背景关闭、密码、确认密码和提交。
- PasswordInput 支持可选 disabled，传入原生 input 和显示密码按钮；其他使用方默认行为保留。
- 备份选择/读取错误经 Settings → SettingsHistorySection → DataConfigTransferCard 传递，在没有备份弹窗时展示 role=alert。保留现有颜色、布局与文案风格。

## 待执行测试

保留上一切片的 useDataBackup.test.tsx 四个导出用例，并新增：

- useDataBackup.lifecycle.test.tsx：真实 hook + 原生/API 边界 mock，以 deferred Promise 覆盖操作锁、旧回调、卸载、取消/异常恢复和 StrictMode。
- CryptoConfigModal.test.tsx：真实弹窗和 PasswordInput，约束锁定输入、取消、背景、Enter/提交，以及默认配置弹窗行为。
- DataConfigTransferCard.test.tsx：错误可见性、备份入口禁用和正常点击。

全部只编写、未执行。没有运行或类型证据，不以历史绿色结果证明本轮代码。

## 范围限制与后续

这是一个 useDataBackup 实例内的操作锁，不是跨页面重挂载、跨 WebView 或跨配置传输功能的全局锁。它不取消已经启动的原生请求，也不改变备份整文件读取/Base64 带来的内存峰值。

另已静态发现整库备份恢复仍直接调用 dataBackup.import，成功后在 Settings 内自行读取设置，没有接入设置自动保存的替换队列。本轮没有修改此持久化路径；下一独立切片应优先核实并协调旧保存/恢复/读取，不能宣称这里的弹窗锁解决了旧表单覆盖恢复值。

尤其需要注意：Rust import_all_data 在 tx.commit 之后还会 load_all_settings，该读取可以返回 Err。因此不能直接套用当前 replaceFrom 对“write 抛错即尚未写入”的假设，否则可能错误地恢复旧表单自动保存。

主代理与独立审查者均已静态复读最终源码和三份新增测试，未发现本切片剩余必须修正项。新增测试按参数展开为 hook 14 例、弹窗 8 例、卡片 4 例，路径符合现有 Vitest include；旧导出 4 例保留。卸载后 result.current 不变仅证明没有后续可见 render，不能据此断言 setter 未被调用；抑制旧反馈还依赖源码归属检查的静态证据。全部测试、类型和运行结论仍待用户自行验证。本切片可用普通 Git revert 回滚。
