# 2026-10-16 · 设置导入与自动保存的协调及失败恢复

## 用户可感知的变化

加密配置导入会等待本窗口已在途的主表单保存结束，再执行导入、读取正式配置并接纳表单。旧700ms防抖和离页补写不会覆盖刚导入的配置。

导入期间暂停相关配置编辑；即使关闭密码弹窗，锁仍保持到操作明确结束。导入已成功但重新读取失败时，页面说明当前状态，保留“重新读取”入口；只有用户明确重读并成功后才继续编辑，不再把普通自动保存隐式变成重读而丢掉新输入。写入前明确失败则保留原编辑并恢复正常保存。重复确认只发起一次导入，中文组合输入的Enter不提前确认。

## 代码边界与设计依据

- `features/settings/persistence/writeCoordinator.ts`：复用同窗口现有队列，扩为带结果的泛型任务。
- `useSettingsPersistence.ts`：同步预留替换范围，协调旧写、导入、读回与接纳；独立显式读回重试，覆盖卸载和失败路径。
- `useSettingsCrypto.ts`：同步重复请求保护和弹窗代次检查；关闭UI不撤销已确认持久化动作，旧回执不污染新弹窗。
- `SettingsEditingBoundary.tsx`、历史控件和密码弹窗：原生fieldset及自定义事件保护；恢复按钮在锁外，Tab/Escape保持可用。
- `Settings.tsx`只接线和组合，未把原生调用/状态机追加到大页面。无新增依赖、加密格式或SQLite schema变更。

研究日期：2026-10-16。采用React官方异步清理/迟到响应隔离思想，将“持久化动作继续完成”和“当前界面是否接纳回执”分开；这是对本项目生命周期的应用推论。[React useEffect](https://react.dev/reference/react/useEffect)

SQLite事务的写入互斥不使多个前端请求自动成为一个业务整体，因此在已有队列中协调旧保存→导入→读取。此处只是同JS窗口顺序保证，不是数据库原子事务或跨窗口冲突协议。[SQLite isolation](https://www.sqlite.org/isolation.html)、[SQLite transaction](https://www.sqlite.org/lang_transaction.html)

代价是多一个明确的导入/恢复生命周期及短暂编辑锁；复用现有hook和UI token，收益用确定性竞争复现及真实页面状态验证，不为引入技术升级依赖。

## RED与复审

1. 旧实现的真实controller/crypto/persistence/client组合回归11项中8失败、3通过；日志 `logs/settings-import-red.log`。只替换Tauri边界，覆盖旧在途保存、防抖、离页和读回失败。
2. 保留的旧Desktop构建产物验证了旧写未结束就导入完成以及composition Enter误确认；`logs/settings-import-e2e-baseline-red.log`。早期夹具文件返回类型错误不计产品RED。
3. 独立审查发现初轮修复允许读回失败期间编辑C，700ms自动保存隐式重读B并清掉C；隔离复现 `review/settings-review-repro.log` 和页面锁RED `logs/settings-import-e2e-recovery-red.log` 确认。已改为显式恢复并保持编辑锁。
4. 原审查复审及资源受限最终静态复审均未发现新增必须修复问题。独立复审的测试运行曾因资源事件停止，未将其记为GREEN；当前GREEN以主代理完成的下表为准。

## 当前源验证

所有工程执行在lab5090。以下是恢复锁最终源的证据；修前831项/55项结果不替代它。

| 检查 | 命令与结果 | 日志 |
| --- | --- | --- |
| 根类型 | `pnpm exec turbo run type-check --concurrency=1`：3任务成功，Desktop实际执行，Web/Mobile缓存命中 | `settings-import-after-review-typecheck.log` |
| 真实hook组合 | 新增18项，包含于下列全Desktop检查 | `settings-import-vitest-bounded.log` |
| Desktop单测 | `pnpm --dir apps/desktop exec vitest run --maxWorkers=1`：186文件/834项通过，242.43秒 | `settings-import-vitest-bounded.log` |
| 新浏览器回归 | `pnpm --dir apps/desktop exec playwright test e2e/settings-import.spec.ts --workers=1 --retries=0 --reporter=line`：6通过，58.7秒 | `settings-import-e2e-bounded.log` |
| 全浏览器回归 | 同命令去掉spec过滤：58通过，2.4分钟 | `settings-import-e2e-full-bounded.log` |
| 根lint | `pnpm exec turbo run lint --concurrency=1`：3任务成功，0错误/25条既有警告，18.757秒 | `settings-import-lint-bounded.log` |
| Desktop前端构建 | `pnpm --dir apps/desktop build`：通过，37.16秒 | `settings-import-build-bounded.log` |

日志绝对目录：`/root/cmq/xiaoyan-lab/logs/`。单测保留已有act/mock stderr输出；通过不等于零诊断信息。未改动共享包、Web/Mobile或原生代码，不重复未受影响包的既有基线检查。

## UI与输入证据

新6项使用实际页面和真实业务hook，仅mock原生边界。覆盖保存/导入先后顺序、重复确认、一次读回失败、显式重读、关闭在途弹窗后的锁及历史确认入口保护。

`/root/cmq/xiaoyan-lab/screenshots-after-review-bounded/`保存11张PNG及同名合成状态JSON。主代理实际查看1440宽成功、768宽错误弹窗、关闭弹窗后锁定和恢复后继续编辑四个状态。未发现这些状态新增阻塞布局问题，保留原有浅色卡片/控件语言。Tab/Enter到锁外恢复按钮、isComposing和keyCode229由浏览器用例实际覆盖。

关闭在途导入成功/失败两例未控制700ms防抖，不能单独证明失败后补写未落库草稿；该断言由确定性hook组合覆盖。第六例只证明叠层情况下相关动作遵守锁，不等同于叠层弹窗完整可见性/焦点体验验收。

## 最新执行约束

用户在上述检查结束后明确：本次所有修改只补齐测试文件，不再执行测试，由用户随后自行运行。后续切片遵循此要求，不新增测试运行；如只完成静态检查，应如实标记未运行测试，不能沿用本切片结果。

## 资源控制与未完成事项

用户反馈服务器卡后已停止本任务Rust、浏览器及测试进程，再以硬限制逐项验证。所有新受限运行均使用同一flock，1 worker，1核CPU，MemoryHigh=1280M/MemoryMax=1536M，禁止swap，低IO权重；可用内存低于8GiB不启动，运行中低于6GiB或持续高IO压力则停本任务。每次结束由systemd清理子进程。

| 受限运行 | cgroup峰值 | swap / OOM |
| --- | --- | --- |
| 新6项浏览器 | 1221300224字节，约1.14GiB | 0 / 0 |
| 全58项浏览器 | 1082011648字节，约1.01GiB | 0 / 0 |
| Desktop单测 | 363180032字节，约346MiB | 0 / 0 |
| 根lint | 440422400字节，420MiB | 0 / 0 |
| Desktop构建 | 1082265600字节，约1.01GiB | 0 / 0 |

- Rust容器保持停止，库测试未完成，不能声称原生基线通过。
- 本切片不统一跨WebView、已启动的历史/备份操作、布局/助手独立写入。跨窗口全量配置冲突需要后续版本协议。
- Tauri mock不证明真实加密/文件权限/数据库/原生输入法、macOS/Windows真机或真实模型科研质量。
- 原生备份一致性与资产恢复仍是待处理问题；未为了本切片贸然扩展格式或表白名单。

## Git与下一步

仅本地提交本切片的设置域、测试和证据文档；不推送、不创建PR、不部署。提交前核验master、锁文件与五个子模块pin未变，保留两次PDF修复。回滚方式为在当前分支对本切片提交做普通`git revert`；本轮没有数据迁移。

下一候选是写作编译异步结果的文稿/请求代次隔离，已有只读候选记录，尚未开始实现。后续只补齐测试文件、不运行测试；延续资源约束，不恢复高内存Rust编译。
