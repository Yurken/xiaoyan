import { AbsoluteFill, Sequence } from "remotion";
import type { ComponentType } from "react";
import { ChallengeScene, OpeningScene } from "./components/OpeningScenes";
import {
  ClosingScene,
  KnowledgeScene,
  MissionScene,
  PapersScene,
  SubmissionScene,
} from "./components/WorkflowScenes";
import { SCENES } from "./promoData";
import type { PromoScene, SceneKey } from "./promoData";
import "./styles.css";

type SceneProps = {
  scene: PromoScene;
};

const sceneComponents: Record<SceneKey, ComponentType<SceneProps>> = {
  opening: OpeningScene,
  challenge: ChallengeScene,
  mission: MissionScene,
  papers: PapersScene,
  knowledge: KnowledgeScene,
  submission: SubmissionScene,
  closing: ClosingScene,
};

export const ResearchCopilotPromo = () => {
  return (
    <AbsoluteFill className="promoCanvas">
      <div className="globalTexture" />
      {SCENES.map((scene) => {
        const Scene = sceneComponents[scene.key];
        return (
          <Sequence durationInFrames={scene.duration} from={scene.start} key={scene.key}>
            <Scene scene={scene} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
