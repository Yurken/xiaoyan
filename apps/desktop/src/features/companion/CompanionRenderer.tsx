import { useEffect, useMemo, useState } from "react";
import { getCompanionAnimationKey, getCompanionDefinition, getCompanionTooltip } from "./petRegistry";
import type { CompanionActionKey, CompanionDefinition, SpriteAnimation, SpriteAtlasDefinition, SvgSetDefinition } from "./shared";
import { useCompanionController } from "./useCompanionController";
import { useCompanionPreference } from "./useCompanionPreference";

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
  const [frame, setFrame] = useState(0);
  const width = inline ? 60 : 104;
  const height = Math.round(width * renderer.cellHeight / renderer.cellWidth);

  useEffect(() => {
    setFrame(0);
    if (animation.frames <= 1 || animation.fps <= 0) return;

    const frameMs = Math.max(80, Math.round(1000 / animation.fps));
    if (animation.playMode === "blink") {
      let timeout: number | undefined;
      const sequence = (animation.sequence?.length ? animation.sequence : [0, 1, 0])
        .filter((item) => item >= 0 && item < animation.frames);
      const blinkSequence = sequence.length > 0 ? sequence : [0];
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
              setFrame(0);
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

    const interval = window.setInterval(() => {
      setFrame((current) => (current + 1) % animation.frames);
    }, frameMs);
    return () => window.clearInterval(interval);
  }, [animation.fps, animation.frames, animation.intervalMaxMs, animation.intervalMinMs, animation.intervalMs, animation.playMode, animation.row, animation.sequence]);

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
        backgroundImage: `url(${renderer.image})`,
        backgroundRepeat: "no-repeat",
        backgroundSize: `${renderer.columns * width}px ${renderer.rows * height}px`,
        backgroundPosition: `-${frame * width}px -${animation.row * height}px`,
        imageRendering: "pixelated",
      }}
    />
  );
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
      width={inline ? 60 : 120}
      height={inline ? 60 : 120}
      style={{ opacity, transition: "opacity 0.18s ease", display: "block", pointerEvents: "none" }}
      aria-label="小妍"
    />
  );
}

function CompanionVisual({
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
  const controller = useCompanionController();

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
