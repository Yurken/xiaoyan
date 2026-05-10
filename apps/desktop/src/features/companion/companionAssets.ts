import { SPRITE_COMPANION_ACTION_ATLAS_PACKS } from "./actionExpansion";
import { COMPANION_ACTION_KEYS, type CompanionActionKey, type SpriteAnimation, type SpriteAtlasSheet } from "./shared";

const SPRITE_SHEET_COLUMNS = 8;
const SPRITE_SHEET_ROWS = 9;

export const xiaoyanActionSheets = Object.fromEntries(
  SPRITE_COMPANION_ACTION_ATLAS_PACKS.map((pack) => [
    pack.id,
    {
      image: pack.image,
      columns: SPRITE_SHEET_COLUMNS,
      rows: SPRITE_SHEET_ROWS,
    },
  ]),
) as Record<string, SpriteAtlasSheet>;

const ACTION_FPS: Partial<Record<CompanionActionKey, number>> = {
  idle: 10,
  resting: 4,
  yawning: 6,
  dozing: 5,
  sleeping: 3,
  collapsing: 5,
  waking: 5,
  thinking: 4,
  planning: 4,
  reading: 4,
  writing: 5,
  summarizing: 7,
  looking: 4,
  peeking: 4,
  alerting: 5,
  error: 5,
  react_annoyed: 4,
  react_drag: 7,
  react_left: 7,
  react_right: 7,
};

function createXiaoyanAnimation({
  actionKey,
  row,
  frames,
  sheet,
}: {
  actionKey: CompanionActionKey;
  row: number;
  frames: number;
  sheet: string;
}): SpriteAnimation {
  if (actionKey === "idle") {
    return {
      sheet,
      row,
      frames,
      fps: 10,
      playMode: "blink",
      sequence: [0, 1, 2, 3, 2, 1, 0],
      intervalMinMs: 2200,
      intervalMaxMs: 7200,
    };
  }

  if (actionKey === "thinking") {
    return {
      sheet: "coordination",
      row: 0,
      frames: 6,
      fps: 2,
      playMode: "blink",
      sequence: [0, 1, 2, 3, 2, 1, 0],
      intervalMinMs: 1800,
      intervalMaxMs: 5200,
    };
  }

  return {
    sheet,
    row,
    frames,
    fps: ACTION_FPS[actionKey] ?? (frames >= 8 ? 10 : 6),
  };
}

export const xiaoyanAnimations = Object.fromEntries(
  SPRITE_COMPANION_ACTION_ATLAS_PACKS.flatMap((pack) =>
    pack.rows.map((row) => [
      row.actionKey,
      createXiaoyanAnimation({
        actionKey: row.actionKey,
        row: row.row,
        frames: row.frames,
        sheet: pack.id,
      }),
    ]),
  ),
) as Record<CompanionActionKey, SpriteAnimation>;

export const xiaoyanActionMap = Object.fromEntries(
  COMPANION_ACTION_KEYS.map((key) => [key, key]),
) as Record<CompanionActionKey, keyof typeof xiaoyanAnimations>;

export const compactSpriteAnimations = {
  idle: { row: 0, frames: 6, fps: 10, playMode: "blink", sequence: [0, 1, 2, 3, 2, 1, 0], intervalMinMs: 2200, intervalMaxMs: 7200 },
  runningRight: { row: 1, frames: 8, fps: 10 },
  runningLeft: { row: 2, frames: 8, fps: 10 },
  waving: { row: 3, frames: 4, fps: 5 },
  jumping: { row: 4, frames: 5, fps: 7 },
  failed: { row: 5, frames: 8, fps: 5 },
  waiting: { row: 6, frames: 6, fps: 4 },
  running: { row: 7, frames: 6, fps: 8 },
  review: { row: 8, frames: 6, fps: 4 },
} satisfies Record<string, SpriteAnimation>;

export const compactSpriteActionMap: Record<CompanionActionKey, keyof typeof compactSpriteAnimations> = {
  idle: "idle",
  yawning: "idle",
  dozing: "idle",
  collapsing: "idle",
  sleeping: "idle",
  waking: "waving",
  thinking: "review",
  planning: "review",
  searching: "runningRight",
  reading: "review",
  writing: "review",
  summarizing: "review",
  looking: "waiting",
  peeking: "waiting",
  celebrating: "jumping",
  alerting: "failed",
  arriving: "running",
  resting: "idle",
  working: "running",
  building: "review",
  sweeping: "runningRight",
  carrying: "runningLeft",
  debugger: "review",
  wizard: "jumping",
  ultrathink: "review",
  juggling: "running",
  conducting: "review",
  attention: "waving",
  error: "failed",
  notification: "waving",
  react_left: "waving",
  react_right: "waving",
  react_annoyed: "failed",
  react_double: "jumping",
  react_jump: "jumping",
  react_drag: "running",
};

export const dundunSvg = {
  idle: "/dundun/clawd-idle-follow.svg",
  yawning: "/dundun/clawd-idle-yawn.svg",
  dozing: "/dundun/clawd-idle-doze.svg",
  collapsing: "/dundun/clawd-collapse-sleep.svg",
  sleeping: "/dundun/clawd-sleeping.svg",
  waking: "/dundun/clawd-wake.svg",
  thinking: "/dundun/clawd-working-thinking.svg",
  planning: "/dundun/clawd-working-building.svg",
  searching: "/dundun/clawd-working-sweeping.svg",
  reading: "/dundun/clawd-idle-reading.svg",
  writing: "/dundun/clawd-working-typing.svg",
  summarizing: "/dundun/clawd-working-conducting.svg",
  looking: "/dundun/clawd-idle-look.svg",
  peeking: "/dundun/clawd-mini-peek.svg",
  celebrating: "/dundun/clawd-mini-happy.svg",
  alerting: "/dundun/clawd-mini-alert.svg",
  arriving: "/dundun/clawd-mini-enter.svg",
  resting: "/dundun/clawd-idle-collapse.svg",
  working: "/dundun/clawd-working-typing.svg",
  building: "/dundun/clawd-working-building.svg",
  sweeping: "/dundun/clawd-working-sweeping.svg",
  carrying: "/dundun/clawd-working-carrying.svg",
  debugger: "/dundun/clawd-working-debugger.svg",
  wizard: "/dundun/clawd-working-wizard.svg",
  ultrathink: "/dundun/clawd-working-ultrathink.svg",
  juggling: "/dundun/clawd-working-juggling.svg",
  conducting: "/dundun/clawd-working-conducting.svg",
  attention: "/dundun/clawd-happy.svg",
  error: "/dundun/clawd-error.svg",
  notification: "/dundun/clawd-notification.svg",
  react_left: "/dundun/clawd-react-left.svg",
  react_right: "/dundun/clawd-react-right.svg",
  react_annoyed: "/dundun/clawd-react-annoyed.svg",
  react_double: "/dundun/clawd-react-double.svg",
  react_jump: "/dundun/clawd-react-double-jump.svg",
  react_drag: "/dundun/clawd-react-drag.svg",
} satisfies Record<CompanionActionKey, string>;
