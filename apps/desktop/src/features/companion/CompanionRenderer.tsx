import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { getCompanionAnimationKey, getCompanionDefinition, getCompanionTooltip } from "./petRegistry";
import type {
  CompanionActionKey,
  CompanionDefinition,
  SpriteAnimation,
  SpriteAtlasDefinition,
  SpriteAtlasSheet,
  StaticImageDefinition,
  SvgSetDefinition,
} from "./shared";
import { useCompanionController } from "./useCompanionController";
import { useCompanionPreference } from "./useCompanionPreference";
import CompanionFindingsDrawer from "./CompanionFindingsDrawer";
import { apiClient } from "../../lib/client";

function clampFrame(frame: number, frames: number) {
  return Math.min(Math.max(0, frame), Math.max(0, frames - 1));
}

function getInitialFrame(animation: SpriteAnimation) {
  return clampFrame(animation.initialFrame ?? animation.sequence?.[0] ?? 0, animation.frames);
}

function getFrameSequence(animation: SpriteAnimation, fallback: number[]) {
  const sequence = animation.sequence?.length ? animation.sequence : fallback;
  const validFrames = sequence.filter((item) => item >= 0 && item < animation.frames);
  return validFrames.length > 0 ? validFrames : [getInitialFrame(animation)];
}

const COMPANION_BOX_SIZE = {
  inline: { width: 72, height: 84 },
  floating: { width: 128, height: 136 },
} as const;

const SPRITE_VISUAL_WIDTH = {
  inline: 64,
  floating: 112,
} as const;

const STATIC_VISUAL_WIDTH = {
  inline: 64,
  floating: 112,
} as const;

const SVG_VISUAL_SIZE = {
  inline: 72,
  floating: 128,
} as const;

const SVG_VISUAL_SCALE = {
  inline: 2.15,
  floating: 2.25,
} as const;

function SpriteAtlasPet({
  renderer,
  animation,
  inline,
  opacity,
}: {
  renderer: SpriteAtlasDefinition;
  animation: SpriteAnimation;
  inline: boolean;
  opacity: number;
}) {
  const [frame, setFrame] = useState(() => getInitialFrame(animation));
  const width = inline ? SPRITE_VISUAL_WIDTH.inline : SPRITE_VISUAL_WIDTH.floating;
  const height = Math.round(width * renderer.cellHeight / renderer.cellWidth);
  const sheet = resolveSpriteAtlasSheet(renderer, animation);

  useLayoutEffect(() => {
    const initialFrame = getInitialFrame(animation);
    setFrame(initialFrame);
    if (animation.frames <= 1 || animation.fps <= 0) return;

    const frameMs = Math.max(80, Math.round(1000 / animation.fps));
    if (animation.playMode === "blink") {
      let timeout: number | undefined;
      const blinkSequence = getFrameSequence(animation, [
        initialFrame,
        clampFrame(initialFrame + 1, animation.frames),
        initialFrame,
      ]);
      const nextBlinkDelay = () => {
        const min = animation.intervalMinMs ?? animation.intervalMs ?? 3000;
        const max = Math.max(min, animation.intervalMaxMs ?? animation.intervalMs ?? 10000);
        return Math.round(min + Math.random() * (max - min));
      };

      const scheduleBlink = () => {
        timeout = window.setTimeout(() => {
          let index = 0;
          const showNextFrame = () => {
            setFrame(blinkSequence[index] ?? 0);
            index += 1;
            if (index < blinkSequence.length) {
              timeout = window.setTimeout(showNextFrame, frameMs);
            } else {
              setFrame(initialFrame);
              scheduleBlink();
            }
          };
          showNextFrame();
        }, nextBlinkDelay());
      };

      scheduleBlink();
      return () => {
        if (timeout) window.clearTimeout(timeout);
      };
    }

    if (animation.playMode === "once") {
      let timeout: number | undefined;
      const onceSequence = getFrameSequence(
        animation,
        Array.from({ length: animation.frames }, (_, index) => index),
      );
      let index = 0;

      const showNextFrame = () => {
        setFrame(onceSequence[index] ?? onceSequence[onceSequence.length - 1] ?? initialFrame);
        index += 1;
        if (index < onceSequence.length) {
          timeout = window.setTimeout(showNextFrame, frameMs);
        }
      };

      showNextFrame();
      return () => {
        if (timeout) window.clearTimeout(timeout);
      };
    }

    if (animation.sequence?.length) {
      const loopSequence = getFrameSequence(animation, [initialFrame]);
      let index = 0;
      const showNextFrame = () => {
        setFrame(loopSequence[index] ?? initialFrame);
        index = (index + 1) % loopSequence.length;
      };

      showNextFrame();
      const interval = window.setInterval(showNextFrame, frameMs);
      return () => window.clearInterval(interval);
    }

    const interval = window.setInterval(() => {
      setFrame((current) => (current + 1) % animation.frames);
    }, frameMs);
    return () => window.clearInterval(interval);
  }, [animation]);

  return (
    <div
      role="img"
      aria-label="小妍"
      style={{
        width,
        height,
        opacity,
        transition: "opacity 0.18s ease",
        display: "block",
        pointerEvents: "none",
        backgroundImage: `url(${sheet.image})`,
        backgroundRepeat: "no-repeat",
        backgroundSize: `${sheet.columns * width}px ${sheet.rows * height}px`,
        backgroundPosition: `-${frame * width}px -${animation.row * height}px`,
        imageRendering: "pixelated",
      }}
    />
  );
}

function resolveSpriteAtlasSheet(
  renderer: SpriteAtlasDefinition,
  animation: SpriteAnimation,
): SpriteAtlasSheet {
  if (animation.sheet && renderer.sheets?.[animation.sheet]) {
    return renderer.sheets[animation.sheet];
  }
  return {
    image: renderer.image,
    columns: renderer.columns,
    rows: renderer.rows,
  };
}

function SvgSetPet({
  renderer,
  assetKey,
  inline,
  opacity,
}: {
  renderer: SvgSetDefinition;
  assetKey: string;
  inline: boolean;
  opacity: number;
}) {
  const size = inline ? SVG_VISUAL_SIZE.inline : SVG_VISUAL_SIZE.floating;
  const scale = inline ? SVG_VISUAL_SCALE.inline : SVG_VISUAL_SCALE.floating;

  return (
    <object
      data={renderer.assets[assetKey] ?? renderer.assets.idle}
      type="image/svg+xml"
      width={size}
      height={size}
      style={{
        opacity,
        transition: "opacity 0.18s ease",
        display: "block",
        pointerEvents: "none",
        transform: `scale(${scale})`,
        transformOrigin: "50% 90%",
      }}
      aria-label="小妍"
    />
  );
}

function StaticImagePet({
  renderer,
  inline,
  opacity,
}: {
  renderer: StaticImageDefinition;
  inline: boolean;
  opacity: number;
}) {
  return (
    <img
      src={renderer.image}
      alt={renderer.alt}
      draggable={false}
      width={inline ? STATIC_VISUAL_WIDTH.inline : STATIC_VISUAL_WIDTH.floating}
      style={{
        maxHeight: inline ? COMPANION_BOX_SIZE.inline.height : COMPANION_BOX_SIZE.floating.height,
        height: "auto",
        opacity,
        transition: "opacity 0.18s ease",
        display: "block",
        pointerEvents: "none",
        objectFit: "contain",
        imageRendering: "pixelated",
      }}
    />
  );
}

export function CompanionVisual({
  definition,
  actionKey,
  inline,
  opacity,
}: {
  definition: CompanionDefinition;
  actionKey: CompanionActionKey;
  inline: boolean;
  opacity: number;
}) {
  const assetKey = getCompanionAnimationKey(definition, actionKey);
  if (definition.renderer.kind === "sprite-atlas") {
    const animation = definition.renderer.animations[assetKey] ?? definition.renderer.animations.idle;
    return <SpriteAtlasPet renderer={definition.renderer} animation={animation} inline={inline} opacity={opacity} />;
  }
  if (definition.renderer.kind === "static-image") {
    return <StaticImagePet renderer={definition.renderer} inline={inline} opacity={opacity} />;
  }
  return <SvgSetPet renderer={definition.renderer} assetKey={assetKey} inline={inline} opacity={opacity} />;
}

function Tooltip({
  text,
  inline,
}: {
  text: string;
  inline: boolean;
}) {
  const pixelBorder = `
    linear-gradient(rgb(var(--rc-surface-rgb) / 0.82), rgb(var(--rc-surface-rgb) / 0.82)) padding-box,
    radial-gradient(circle at 1px 1px, var(--rc-border, #999) 1.2px, transparent 1.3px) 0 0 / 4px 4px border-box
  `;
  const placement = inline
    ? "absolute left-full ml-2 bottom-1/2 translate-y-1/2 z-50"
    : "absolute right-full mr-2 bottom-1/2 translate-y-1/2 z-[60]";

  return (
    <div
      className={`${placement} pointer-events-none whitespace-nowrap px-3 py-2 text-xs leading-relaxed text-ink-primary opacity-0 transition-opacity duration-200 group-hover:opacity-100`}
      style={{
        background: pixelBorder,
        border: "3px solid transparent",
        borderRadius: "10px",
        imageRendering: "pixelated",
        fontFamily: '"HYPixel11pxU-2", ui-monospace, "SF Mono", Menlo, Monaco, monospace',
        fontSize: "11px",
        lineHeight: 1.4,
        letterSpacing: "0.02em",
        boxShadow: "var(--rc-shadow-md, 0 4px 16px rgba(0,0,0,0.12))",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
      }}
    >
      {text}
    </div>
  );
}

export default function CompanionRenderer({ inline = false }: { inline?: boolean } = {}) {
  const companionId = useCompanionPreference();
  const definition = useMemo(() => getCompanionDefinition(companionId), [companionId]);
  const controller = useCompanionController({ allowIdleSleep: definition.allowIdleSleep !== false });

  // 启动时加载未读数
  useEffect(() => {
    apiClient.activeResearcher.findings(0).then((r) => {
      if (r.unread_count > 0) {
        controller.setNotificationCount(r.unread_count);
      }
    }).catch((err) => { console.warn("Failed to load findings:", err); });
  }, []);

  if (!controller.visible) return null;

  const tooltipText = controller.notificationCount > 0
    ? `我帮你找到了 ${controller.notificationCount} 篇可能相关的论文，点我看看~`
    : getCompanionTooltip(definition, controller.shownAction);
  const closeNotificationDrawer = () => {
    controller.setNotificationOpen(false);
  };
  const markAllNotificationsRead = () => {
    controller.setNotificationOpen(false);
    controller.setNotificationCount(0);
  };
  const findingsDrawer = controller.notificationOpen ? (
    <CompanionFindingsDrawer
      onClose={closeNotificationDrawer}
      onMarkAllRead={markAllNotificationsRead}
      onFindingImported={() => {
        controller.setNotificationCount((current) => Math.max(0, current - 1));
      }}
    />
  ) : null;

  if (inline) {
    return (
      <>
        <div
          ref={controller.containerRef}
          className="relative flex w-full select-none justify-center py-2 group"
        >
          <Tooltip text={tooltipText} inline />
          <button
            type="button"
            onClick={() => controller.activate()}
            aria-label={controller.notificationCount > 0 ? "查看小妍找到的论文" : "和小妍互动"}
            className="flex items-end justify-center rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-apple-blue/35"
            style={{
              width: COMPANION_BOX_SIZE.inline.width,
              height: COMPANION_BOX_SIZE.inline.height,
              overflow: "visible",
              cursor: "pointer",
              padding: 0,
              border: "none",
              background: "transparent",
            }}
          >
            <CompanionVisual
              definition={definition}
              actionKey={controller.shownAction}
              inline
              opacity={controller.opacity}
            />
          </button>
        </div>
        {findingsDrawer}
      </>
    );
  }

  return (
    <div
      ref={controller.containerRef}
      onPointerDown={controller.onPointerDown}
      onPointerMove={controller.onPointerMove}
      onPointerUp={controller.onPointerUp}
      className="fixed z-50 select-none group"
      style={{
        right: controller.pos.right,
        bottom: controller.pos.bottom,
        width: COMPANION_BOX_SIZE.floating.width,
        height: COMPANION_BOX_SIZE.floating.height,
        cursor: controller.isDragging.current ? "grabbing" : "grab",
        touchAction: "none",
        overflow: "visible",
      }}
    >
      <Tooltip text={tooltipText} inline={false} />
      <div className="flex h-full w-full items-end justify-center">
        {controller.notificationCount > 0 ? (
          <div
            className="absolute -top-1 -right-1 z-50 flex h-6 min-w-[1.5rem] items-center justify-center rounded-full px-1.5 text-[11px] font-bold text-white"
            style={{ background: "#FF3B30", boxShadow: "0 2px 6px rgba(255,59,48,0.4)" }}
          >
            {controller.notificationCount}
          </div>
        ) : null}
        <CompanionVisual
          definition={definition}
          actionKey={controller.shownAction}
          inline={false}
          opacity={controller.opacity}
        />
      </div>
      {findingsDrawer}
    </div>
  );
}
