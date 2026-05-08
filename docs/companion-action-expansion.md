# Companion Action Expansion

桌面伴侣形象通过 `apps/desktop/src/features/companion/` 注册动作语义，再由具体形象映射到 SVG 资源或 spritesheet 行。

## Sprite Atlas Layout

`hatch-pet` 的标准产物固定是 `8 x 9` atlas。小妍本体已经按 4 张合规图集接入 36 个独立动作；团子仍保留单张 `8 x 9` compact atlas 作为 fallback。

### Compact Atlas

| Row | Animation key | Frames | 用途 |
| --- | --- | ---: | --- |
| 0 | `idle` | 6 | 待命、眨眼 |
| 1 | `runningRight` | 8 | 向右移动 fallback |
| 2 | `runningLeft` | 8 | 向左移动 fallback |
| 3 | `waving` | 4 | 挥手、提醒 fallback |
| 4 | `jumping` | 5 | 庆祝、跳跃 fallback |
| 5 | `failed` | 8 | 错误、提醒 fallback |
| 6 | `waiting` | 6 | 观察、探头 fallback |
| 7 | `running` | 6 | 工作中、多任务 fallback |
| 8 | `review` | 6 | 阅读、规划、分析 fallback |

### XiaoYan Action Atlases

| Pack | File | Rows |
| --- | --- | --- |
| core | `apps/desktop/public/pets/xiaoyan/spritesheet.webp` | `idle`、`arriving`、`carrying`、`attention`、`celebrating`、`error`、`looking`、`working`、`thinking` |
| research | `apps/desktop/public/pets/xiaoyan/spritesheet-research.webp` | `planning`、`searching`、`sweeping`、`writing`、`summarizing`、`debugger`、`reading`、`building`、`wizard` |
| coordination | `apps/desktop/public/pets/xiaoyan/spritesheet-coordination.webp` | `ultrathink`、`juggling`、`conducting`、`notification`、`react_double`、`alerting`、`peeking`、`react_drag`、`react_annoyed` |
| rest-interaction | `apps/desktop/public/pets/xiaoyan/spritesheet-rest-interaction.webp` | `resting`、`yawning`、`dozing`、`waking`、`react_jump`、`collapsing`、`sleeping`、`react_left`、`react_right` |

渲染器通过 `SpriteAnimation.sheet` 选择具体 atlas。小妍本体的 `actionMap` 已经一一映射到 36 个语义动作；团子使用 `compactSpriteActionMap` 继续映射到 9 个 compact 动作。

## Expansion Queue

代码中的优先扩展队列在 `apps/desktop/src/features/companion/actionExpansion.ts`。它现在主要用于还没有独立 36 动作资源的 spritesheet 形象，例如团子。小妍本体不再显示待独立化候选。

## Asset Rules

- 不要只在 `petRegistry.ts` 里继续添加大段动作数据；图集动作放 `companionAssets.ts`，文案放 `companionTooltips.ts`，扩展计划放 `actionExpansion.ts`。
- 新增 spritesheet 行时保持 `192 x 208` 单格尺寸、每行最多 8 帧、透明背景。
- 每次替换或扩展图集后，用 `hatch-pet` 校验脚本确认 atlas 尺寸、透明度和行配置。
- 生成新动作资源时优先单行动作替换；如果一次性重绘整张图集，先确认目标形象是否使用 36 动作表或 compact fallback 表。
