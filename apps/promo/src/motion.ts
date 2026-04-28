import { Easing, interpolate } from "remotion";

export const clamp = (value: number, min = 0, max = 1) => {
  return Math.min(max, Math.max(min, value));
};

export const fadeInOut = (frame: number, duration: number, edge = 20) => {
  return interpolate(
    frame,
    [0, edge, Math.max(edge + 1, duration - edge), duration],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
};

export const rise = (frame: number, amount = 34, delay = 0) => {
  const progress = interpolate(frame - delay, [0, 28], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  return (1 - progress) * amount;
};

export const reveal = (frame: number, delay = 0, span = 26) => {
  return interpolate(frame - delay, [0, span], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
};

export const loopWave = (frame: number, speed = 0.035, range = 1) => {
  return Math.sin(frame * speed) * range;
};

export const sceneProgress = (frame: number, duration: number) => {
  return clamp(frame / duration);
};
