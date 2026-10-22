# 模型角色分工与回退语义

小妍按任务把模型划分为若干「角色」（规划、代码、视觉、向量化……）。本文记录角色配置的存放位置与唯一回退规则，避免同一个角色在不同文件里各维护一份、各有一套回退行为。

## 唯一规则：角色模型留空 = 完全继承主模型

一个角色是否构成独立作用域，取决于 `base_url` / `api_key` / `model` 三者：

- 三者都非空 → 使用该角色自己的端点与模型。
- 任一为空 → **完全继承主模型**（主服务商的端点、密钥与模型）。

因此「清空角色模型」是一个可预期的操作：它总是回到主模型，不会落到任何硬编码模型名。规则由 `apps/desktop/src-tauri/src/llm/client_resolution.rs` 实现，并由同文件单元测试固定。

历史行为（已修复）：角色只要配过 `base_url` + `api_key`，即使 `model` 为空也会构造独立客户端，并回落到硬编码的 `deepseek-chat` / `claude-3-5-haiku-20241022`。于是用户点「全部沿用主模型」后，模型会被静默换成他从未选择过的那个。`embedding` 角色上的 `text-embedding-3-small` 属于同一类问题。

## 代码位置

| 关注点 | 位置 |
| --- | --- |
| 角色 → 客户端解析、回退规则 | `apps/desktop/src-tauri/src/llm/client_resolution.rs` |
| 角色卡片、分层、状态判定 | `apps/desktop/src/features/settings/roleRegistry.ts` |
| 一键对齐预设 | `apps/desktop/src/features/settings/modelPresets.ts` |
| 卡片渲染与角色连通性测试 | `apps/desktop/src/features/settings/RoleModelCards.tsx` |
| 设置页组合 | `apps/desktop/src/features/settings/RolesSection.tsx` |

各调用点仍然用 `resolve_model(settings, &["<role>_model"])` 与 `scoped_client_from_settings` 取模型与端点，本次收敛的是「角色清单」和「回退规则」，没有改动调用点。

## 分层

- `primary`（默认展开）：视觉与向量化。它们不是成本偏好而是能力边界——chat 模型不能做 embedding，非多模态模型不能读图（接入 DSH / Pi 时还会按 `input` 能力做请求前预检）。
- `advanced`（默认折叠在「高级：按任务指定模型」）：其余文本任务。留空即继承主模型，展开只用于按任务分摊成本或延迟。

`multi_agent_worker_model` 是多智能体与部分回退链的兜底角色，没有独立的用户任务入口，因此不出卡片，但仍属于统一范围（见 `roleRegistry.ts` 的 `CARD_LESS_ROLES`）。主服务商自带的 chat / embedding 模型键不属于角色。

## 新增一个任务角色

1. 在 `state.rs::default_settings()` 与 `pageConfig.tsx::DEFAULT_SETTINGS` 登记该角色的 8 个键。
2. 在 `packages/types/src/index.ts` 的 `AppSettings` 中声明。
3. 在 `roleRegistry.ts` 中补一张卡片，`tier` 取 `advanced`，除非它确实是新的能力边界。
4. 在 `SENSITIVE_KEYS` 中登记 `_api_key`。
5. 调用点只通过 `resolve_model` / `scoped_client_from_settings` 读取，不要自己拼键名。

## 预设

预设只表达与厂商无关的意图（「全部沿用主模型」/「恢复推荐参数」），不写任何厂商模型名。用户可能接任意兼容端点，把 `deepseek-chat` 这类名字写死会在换端点后永久失配——旧实现用全等匹配判断预设是否生效，一次改动之后就再也匹配不上。

## 已知残留

`state.rs::default_settings()` 与 `pageConfig.tsx::DEFAULT_SETTINGS` 仍是两份默认值清单，角色的推荐温度也同时存在于注册表占位值与这两处。把它们收敛到单一来源，需要让注册表携带逐角色默认值，属于下一步工作。