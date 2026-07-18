import { useEffect, useState, type RefObject } from "react";
import { resolveCompanionLookDirection } from "./shared";

const LOOK_DEADZONE_RADIUS = 44;

interface CompanionLookDirectionOptions {
  enabled: boolean;
  targetRef: RefObject<HTMLElement | null>;
}

export function useCompanionLookDirection({
  enabled,
  targetRef,
}: CompanionLookDirectionOptions): number | null {
  const [direction, setDirection] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      setDirection(null);
      return;
    }

    let animationFrame = 0;
    let pointer: { x: number; y: number } | null = null;

    const updateDirection = () => {
      animationFrame = 0;
      const target = targetRef.current;
      if (!target || !pointer) return;
      const rect = target.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const nextDirection = resolveCompanionLookDirection(
        pointer.x - centerX,
        pointer.y - centerY,
        LOOK_DEADZONE_RADIUS,
      );
      setDirection((current) => current === nextDirection ? current : nextDirection);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") {
        pointer = null;
        setDirection(null);
        return;
      }
      pointer = { x: event.clientX, y: event.clientY };
      if (!animationFrame) animationFrame = window.requestAnimationFrame(updateDirection);
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
    };
  }, [enabled, targetRef]);

  return direction;
}
