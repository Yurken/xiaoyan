# 2026-10-04 · 桌面助手截图上下文持续可见

- 迭代类型：产品体验与隐私边界修复；没有更换 Codex 开发模型或小妍 Agent 模型
- 审阅基线：`7313195b`，分支 `codex/desktop-session-reliability`；本次接续开始时工作区已有 2026-09-25 的未提交截图预览改动，未把它误记为干净基线。旧实现从该提交读取到临时文件，与当前组件使用相同合成测试对照。
- 当前阶段：0.6.0 桌面助手发布收口；持续进化规划阶段 A
- 主假设：若已确认的区域截图在动作选择页继续作为图片显示，用户便能核对接下来交给小妍的视觉范围，且页面不再呈现不可读的图片编码。
- 对应场景：E10「桌面助手解读并导入资产」中的「截图 → 预览 → 确认 → 选择动作」；这是前端合成回放，E10 尚无正式版本化评分集。

## 桌面助手呈现对照（2026-10-04 复核）

这里只对照与本轮决策有关的公开产品行为；资料来自官方说明，未在本机逐一安装竞品做体验或性能测试。

| 产品与官方依据 | 近期可观察做法 | 小妍现状与本轮判断 |
| --- | --- | --- |
| [ChatGPT macOS 截图工具](https://help.openai.com/en/articles/9295245-chatgpt-macos-app-screenshot-tool) | 截图成为可见的图片附件，可用于新对话或继续对话。 | 小妍已有主动框选、确认和视觉模型路径；确认后动作选择页应继续呈现同一张图片。 |
| [Raycast Screen Awareness](https://manual.raycast.com/ai/screen-awareness)、[2026-08-19 发布记录](https://www.raycast.com/changelog/macos/0-71) | 用户主动选定窗口、文本或区域；附件卡可查看采集类型和包含的来源。 | 小妍已有来源选择和发送前预览；本轮修复确认后图片内容不可读的断点。 |
| [Copilot Vision](https://support.microsoft.com/en-us/microsoft-copilot/using-copilot-vision-with-microsoft-copilot) | Windows 流程中用户选择共享屏幕或应用，浮动工具栏显示会话状态，结束时停止观察。 | 小妍保持按次采集及可取消的边界；本轮不扩展持续读屏。 |

删除原草稿中与本轮截图呈现无关的发布对照；其中 [Raycast Windows v2.5](https://www.raycast.com/changelog/windows/2-5) 的实际发布日期是 2026-09-28，不能写成 2026-09-24 或作为 9 月 25 日迭代的证据。

## 冻结基线与验收

旧实现的 `AssistantPanel` 在所有非空内容上使用文本段落渲染 `session.content`；截图的 `content` 是 `data:image/...`，因此确认后显示编码文本。确认前的 `CapturePreview` 已使用 `screenshotPath` 展示图像。这个差异可由合成 data URL 的组件测试复现，不涉及真实屏幕数据。

本轮仅改变「当前内容」的呈现：截图显示受限缩略图与采集范围、来源，普通文本仍显示摘要和字数。组件回归同时覆盖无独立图片路径时使用内容 data URL、OCR 后显示文本而非旧截图。窗口级合成回放验证「截图 → 预览 → 确认 → 动作选择」展示同一图像、确认前不调用模型，以及切换到文字采集或清空隐私数据后移除旧图。若截图路径不可用或引入新的内容外发、持久化，本轮应回退。

## 结果与决策

- 红绿证据（2026-10-04）：从 `7313195b` 提取旧 `AssistantPanel`，在隔离的临时组件/测试文件上运行相同的 5 项回归，得到 `2 failed / 3 passed`；区域截图与粘贴图片均找不到名为「当前截图预览」的图片。抽离 `AssistantCaptureSummary` 并修复后，定向测试 `5 / 5` 通过。临时基线文件已清理，原工作区改动未被覆盖。
- 回归验证（2026-10-04）：桌面助手目录 `48` 个测试文件、`218` 项通过；仓库级 `pnpm type-check` 通过；`pnpm lint` 为 `0` 错误、`25` 条原有警告，均位于本轮未修改文件；Desktop 前端生产构建与 `git diff --check` 通过。
- 代码边界：`AssistantPanel` 从 `446` 行降至 `394` 行；新摘要组件 `91` 行。只调整前端展示，不新增采集、网络请求、模型调用或持久化；截图图片使用现有会话中的 data URL。粘贴的图片 data URL 沿用既有图片动作路径。
- 能力差异：确认后的截图上下文可读性在合成场景中提升；真实用户误发率、macOS 多屏呈现和科研任务质量未知。
- 决策：采纳修复。未触发回退条件。下一轮仍以 E01 的 5 组「空白会话 vs checkpoint 续接」配对人工任务建立用户结果基线。

E01/E02/E06/E08 的历史固定门禁于本次接续验证重跑通过：`paper-facts-2026-08-13` 对 `local-boundary-2026-08-13`，均分 2.5、硬失败 0、未知硬失败 0。它只核验既有代码证据报告，不能证明新代码或真实模型质量。真实 macOS 多显示器、权限、应用兼容和 VoiceOver 发布矩阵仍需人工执行。

本次验证命令：

```bash
pnpm --dir apps/desktop test src/features/desktop-assistant
pnpm type-check
pnpm lint
pnpm --dir apps/desktop build
pnpm eval:core-agent --report docs/evaluations/xiaoyan-core-gates-v1-paper-facts-2026-08-13.json --baseline docs/evaluations/xiaoyan-core-gates-v1-local-boundary-2026-08-13.json
git diff --check
```
