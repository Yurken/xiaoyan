import { useLayoutEffect, useMemo, useState } from "react";
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
  const width = inline ? 60 : 104;
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
  return (
    <object
      data={renderer.assets[assetKey] ?? renderer.assets.idle}
      type="image/svg+xml"
      width={inline ? 65 : 120}
      height={inline ? 65 : 120}
      style={{ opacity, transition: "opacity 0.18s ease", display: "block", pointerEvents: "none" }}
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
      width={inline ? 58 : 108}
      style={{
        maxHeight: inline ? 64 : 122,
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

  if (!controller.visible) return null;

  const tooltipText = getCompanionTooltip(definition, controller.shownAction);

  if (inline) {
    return (
      <div
        ref={controller.containerRef}
        className="relative flex w-full select-none justify-center py-2 group"
      >
        <Tooltip text={tooltipText} inline />
        <CompanionVisual
          definition={definition}
          actionKey={controller.shownAction}
          inline
          opacity={controller.opacity}
        />
      </div>
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
        width: 120,
        height: 128,
        cursor: controller.isDragging.current ? "grabbing" : "grab",
        touchAction: "none",
      }}
    >
      <Tooltip text={tooltipText} inline={false} />
      <div className="flex h-full w-full items-end justify-center">
        <CompanionVisual
          definition={definition}
          actionKey={controller.shownAction}
          inline={false}
          opacity={controller.opacity}
        />
      </div>
    </div>
  );
}
