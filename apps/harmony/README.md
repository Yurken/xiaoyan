# 小妍 · HarmonyOS 桌面版（apps/harmony）

面向 **HarmonyOS PC（鸿蒙电脑 / 2in1）与平板大屏** 的原生版本。技术路线：

> **ArkTS / ArkUI 原生界面 + Rust 后端（NDK / NAPI）**

界面用 ArkUI 原生重写以获得真正的大屏原生体验；后端**复用桌面端那套 Rust 逻辑**——把 Rust 编译为 OpenHarmony 的 `.so`，经 NAPI 暴露给 ArkTS，从而保留"数据全本地、隐私可控"的旗舰能力，而不是退化成连远程服务的轻量端。

本轮交付为**脚手架 + 核心几页**的可迭代基线，**不是完整移植**。下面明确标注了「已落地」与「待桥接」。

---

## 当前进度

| 层 | 内容 | 状态 |
|---|---|---|
| 工程 | DevEco Studio Stage 工程（AppScope / entry / 资源 / 路由） | ✅ |
| 壳 | 固定侧边导航 + 内容区路由（`pages/Index.ets`） | ✅ |
| 共享 | 设计令牌 `shared/theme`、导航常量 `shared/nav`、类型镜像 `model/types` | ✅ |
| 组件 | `NmCard / NmButton / NmInput / Badge / ScreenHeader / EmptyState / SideNav / PlaceholderPanel` | ✅ |
| 桥接 | `bridge/native`（.so 隔离层）+ `bridge/XiaoyanBridge`（对齐桌面 client.ts） | ✅ |
| 原生后端 | `native/`（Rust + ohos-rs），**零重复**复用桌面端纯模块 | ✅ |
| 页面 · 首页 | 英雄区 + 模块概览网格（自包含） | ✅ |
| 页面 · 工具 | **刊会查询：端到端打通原生后端**（CCF 679 / 期刊分区 22804） | ✅ |
| 页面 · 对话 | 完整聊天交互骨架，演示桥接调用 + 优雅降级 | ✅（UI） |
| 页面 · 规划 / 综述 | UI 骨架 + 明确标注依赖的后端命令 | ⏳ 待桥接 |
| 其余模块 | 论文 / 知识 / 投稿 / 实验 / 设置 / 写作 | ⛔ 未开始 |

「刊会查询」之所以能立刻打通，是因为 `ccf` / `journal_partitions` / `source_service` 三个模块是**纯逻辑**（仅 serde/std + 内嵌 JSON，无 Tauri / State / SQLite 耦合）。其余命令需先在 Rust 侧解耦才能接通，见末尾[解耦路线](#原生后端解耦路线)。

---

## 目录结构

```
apps/harmony/
├── build-profile.json5            # 应用级构建配置（2in1 / tablet）
├── oh-package.json5 · hvigorfile.ts
├── AppScope/                      # 应用级配置与资源（bundleName / 图标 / 应用名）
├── entry/                         # 入口 HAP 模块
│   ├── build-profile.json5 · oh-package.json5 · hvigorfile.ts
│   ├── libs/<abi>/libxiaoyanbridge.so   # ← ohrs 构建后拷入
│   └── src/main/
│       ├── module.json5           # deviceTypes: ["2in1","tablet"]
│       ├── cpp/types/libxiaoyanbridge/  # 原生 .so 的 TS 类型声明
│       ├── resources/             # string / color / 路由 / media
│       └── ets/
│           ├── entryability/EntryAbility.ets
│           ├── pages/Index.ets    # 应用壳：侧边导航 + 内容区
│           ├── shared/            # theme（令牌）· nav（导航常量）
│           ├── model/types.ets    # 跨端类型在 ArkTS 的镜像（snake_case 对齐 serde）
│           ├── bridge/            # native（.so 隔离）· XiaoyanBridge（client 对应物）
│           ├── components/        # 共享 UI 组件
│           └── features/          # 页面组合 + feature 组件 + 纯逻辑
│               ├── home/   planner/   survey/   tools/   xiaoyan/
└── native/                        # Rust NAPI 桥接 crate（ohos-rs）
    ├── Cargo.toml · build.rs
    └── src/lib.rs                 # #[path] 复用桌面端纯模块，零重复
```

架构遵循仓库 [开发原则](../../docs/development-principles.md)：**页面组合 + feature 组件 + feature 纯逻辑 + shared 常量/纯函数**。ArkTS 无 React Hook，"feature hook" 对应为各页 `@State` + 抽离的纯逻辑模块（如 `features/tools/sourceLookupLogic.ets`）。

---

## 构建与运行

### 前置

1. **DevEco Studio 5.x** + HarmonyOS SDK（API 12，含 2in1/tablet 目标）。
2. **Rust 工具链** + OpenHarmony target 与 [ohos-rs](https://ohos.rs) 的 `ohrs`：
   ```bash
   cargo install ohrs
   rustup target add aarch64-unknown-linux-ohos
   # 配置 OHOS NDK 路径（OHOS_NDK_HOME），详见 ohos.rs 文档
   ```

### 1) 构建原生后端 `.so`

```bash
cd apps/harmony/native
ohrs build --arch aarch64        # 产物在 native/dist/arm64-v8a/libxiaoyanbridge.so
# 拷入 entry：
mkdir -p ../entry/libs/arm64-v8a
cp dist/arm64-v8a/libxiaoyanbridge.so ../entry/libs/arm64-v8a/
```

> `native/src/lib.rs` 通过 `#[path = "../../../desktop/src-tauri/src/..."]` 直接复用桌面端的
> `ccf.rs` / `journal_partitions.rs` / `services/source_service.rs`，**不复制**逻辑与数据。
> `include_str!` 路径相对源文件，仍从 `apps/desktop/src-tauri/src/data/` 读取 JSON。

### 2) 在 DevEco Studio 中运行

1. 补齐应用图标（见 `AppScope/resources/base/media/README.md`）。
2. DevEco「Open」选择 `apps/harmony` → 同步工程 → 配置签名。
3. 选择 2in1 / 平板 目标（真机或模拟器）→ Run。

> 当前为 monorepo 子工程，独立打开即可；未接入根 `pnpm`/`turbo` 流水线（ArkTS 不走 Node 构建）。

---

## 桥接约定

- 桌面端：前端 `invoke("cmd", args)` → Tauri → Rust 命令。
- 鸿蒙端：ArkTS `bridge/native` 命名导入 `.so` 函数 → NAPI → **同一套 Rust 逻辑**。
- 已桥接命令返回 **JSON 字符串**，ArkTS 侧 `JSON.parse` 后按 `model/types.ets` 解释（字段 snake_case 与 serde 输出严格一致）。
- 未桥接命令统一走 `XiaoyanBridge.invoke(command, args)`，当前一律 reject，由各页捕获后展示「待桥接」提示，保证 UI 不崩。

---

## 原生后端解耦路线

要把更多模块（规划 / 综述 / 论文 / 对话流式 …）接到鸿蒙端，关键是把桌面端 Rust 逻辑从 Tauri 解耦。建议分三步：

1. **抽出 `xiaoyan-core` crate**：将 `services/` 与 `commands/` 中的业务逻辑下沉为不依赖 `tauri::State`/`AppHandle`/`Window` 的纯函数 + 显式 `CoreContext`（持有 `SqlitePool`、设置、HTTP client）。桌面端的 `#[tauri::command]` 退化为对 core 的薄封装。
2. **`native/` 依赖 `xiaoyan-core`**：在 NAPI 层构造 `CoreContext`（SQLite 路径取鸿蒙应用沙箱目录，经 ArkTS 传入），把命令逐个暴露为 `#[napi]` 异步函数。
3. **流式对话**：把 SSE/事件边界改为 NAPI 的 `ThreadsafeFunction` 回调，ArkTS 侧订阅增量 token，替换 `XiaoyanPage` 里的占位 `invoke`。

落地顺序建议：先接**只读 + 本地**命令（settings 读取、knowledge/notes 列表、submission/experiment 列表），再接 **LLM 流式**（planner / survey / chat），最后是**重 IO**（PDF 解析、图表提取、向量检索）。

---

## 已知限制

- 本机无鸿蒙工具链，脚手架**未在设备/模拟器实际编译验证**；ArkUI 个别 API 细节、`sys.symbol.*` 字形名可能需按所装 SDK 微调。
- 应用图标为占位（需手动补 PNG）。
- 仅桥接了刊会查询；其余模块为 UI 骨架或未开始。
