import { Img, staticFile, useCurrentFrame } from "remotion";
import type { ReactNode } from "react";
import type { PromoScene } from "../promoData";
import { fadeInOut, loopWave, reveal, rise } from "../motion";

type SceneFrameProps = {
  scene: PromoScene;
  children: ReactNode;
  accent?: "teal" | "amber" | "rose" | "green" | "blue";
  compact?: boolean;
};

export const SceneFrame = ({
  scene,
  children,
  accent = "teal",
  compact = false,
}: SceneFrameProps) => {
  const frame = useCurrentFrame();
  const opacity = fadeInOut(frame, scene.duration);

  return (
    <div className={`scene scene-${accent} sceneKey-${scene.key}`} style={{ opacity }}>
      <div className="sceneGrid" />
      <div className="sceneHeader">
        <BrandMark size={64} />
        <div className="sceneMeta">
          <span>{scene.eyebrow}</span>
          <strong>ResearchCopilot</strong>
        </div>
      </div>

      <div className={compact ? "sceneIntro compact" : "sceneIntro"}>
        <div
          className="eyebrow"
          style={{
            opacity: reveal(frame, 2),
            transform: `translateY(${rise(frame, 20, 2)}px)`,
          }}
        >
          {scene.eyebrow}
        </div>
        <h1
          style={{
            opacity: reveal(frame, 8),
            transform: `translateY(${rise(frame, 28, 8)}px)`,
          }}
        >
          {scene.title}
        </h1>
        <p
          style={{
            opacity: reveal(frame, 16),
            transform: `translateY(${rise(frame, 22, 16)}px)`,
          }}
        >
          {scene.body}
        </p>
      </div>

      <div
        className="sceneStage"
        style={{
          opacity: reveal(frame, 28),
          transform: `translateY(${rise(frame, 42, 28)}px)`,
        }}
      >
        {children}
      </div>

      <div className="timeCode">
        <span>{String(Math.floor(scene.start / 30)).padStart(2, "0")}s</span>
        <div>
          <i style={{ width: `${Math.min(100, (frame / scene.duration) * 100)}%` }} />
        </div>
      </div>
    </div>
  );
};

export const BrandMark = ({ size = 96, withMascot = false }: { size?: number; withMascot?: boolean }) => {
  return (
    <div className="brandMark" style={{ width: size, height: size }}>
      <Img src={staticFile(withMascot ? "xiaoyans.svg" : "app-logo.svg")} />
    </div>
  );
};

export const MockWindow = ({ children, title }: { children: ReactNode; title: string }) => {
  return (
    <div className="mockWindow">
      <div className="windowTop">
        <span className="dot red" />
        <span className="dot yellow" />
        <span className="dot green" />
        <strong>{title}</strong>
      </div>
      <div className="windowBody">{children}</div>
    </div>
  );
};

export const Pill = ({
  children,
  tone = "teal",
  delay = 0,
}: {
  children: ReactNode;
  tone?: string;
  delay?: number;
}) => {
  const frame = useCurrentFrame();
  return (
    <span
      className={`pill tone-${tone}`}
      style={{
        opacity: reveal(frame, delay),
        transform: `translateY(${rise(frame, 14, delay)}px)`,
      }}
    >
      {children}
    </span>
  );
};

export const FlowRail = ({ steps }: { steps: readonly string[] }) => {
  const frame = useCurrentFrame();
  return (
    <div className="flowRail">
      {steps.map((step, index) => {
        const delay = 12 + index * 7;
        return (
          <div
            className="flowStep"
            key={step}
            style={{
              opacity: reveal(frame, delay),
              transform: `translateX(${(1 - reveal(frame, delay)) * -22}px)`,
            }}
          >
            <span>{index + 1}</span>
            <strong>{step}</strong>
          </div>
        );
      })}
    </div>
  );
};

export const FloatingPaper = ({
  label,
  index,
  x,
  y,
}: {
  label: string;
  index: number;
  x: number;
  y: number;
}) => {
  const frame = useCurrentFrame();
  const float = loopWave(frame + index * 19, 0.04, 12);
  return (
    <div
      className="floatingPaper"
      style={{
        left: x,
        top: y + float,
        opacity: reveal(frame, index * 6),
        transform: `rotate(${loopWave(frame + index * 13, 0.018, 3)}deg)`,
      }}
    >
      <span />
      <strong>{label}</strong>
      <i />
    </div>
  );
};

export const MiniGraph = ({ dense = false }: { dense?: boolean }) => {
  const frame = useCurrentFrame();
  const nodes = dense
    ? [
        [80, 70, "P1"],
        [230, 45, "N"],
        [390, 95, "M"],
        [145, 220, "P2"],
        [320, 255, "R"],
        [500, 210, "Q"],
        [610, 95, "C"],
      ]
    : [
        [70, 80, "P"],
        [245, 50, "N"],
        [420, 170, "R"],
        [170, 260, "M"],
        [560, 285, "Q"],
      ];

  return (
    <svg className="miniGraph" viewBox="0 0 680 340">
      <defs>
        <linearGradient id="edgeGradient" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#0f8f83" />
          <stop offset="55%" stopColor="#e6a93b" />
          <stop offset="100%" stopColor="#b23b4a" />
        </linearGradient>
      </defs>
      {nodes.slice(1).map((node, index) => {
        const previous = nodes[index];
        const visible = reveal(frame, 18 + index * 7);
        return (
          <line
            key={`${previous[2]}-${node[2]}`}
            opacity={0.2 + visible * 0.65}
            stroke="url(#edgeGradient)"
            strokeDasharray="8 12"
            strokeLinecap="round"
            strokeWidth="5"
            x1={previous[0]}
            x2={node[0]}
            y1={previous[1]}
            y2={node[1]}
          />
        );
      })}
      {nodes.map((node, index) => {
        const pulse = 1 + Math.max(0, loopWave(frame + index * 8, 0.055, 0.05));
        return (
          <g
            key={node[2]}
            opacity={reveal(frame, index * 5)}
            transform={`translate(${node[0]} ${node[1]}) scale(${pulse})`}
          >
            <circle className="graphHalo" r="42" />
            <circle className="graphNode" r="28" />
            <text dy="8" textAnchor="middle">
              {node[2]}
            </text>
          </g>
        );
      })}
    </svg>
  );
};
