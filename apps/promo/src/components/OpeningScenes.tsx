import { Img, staticFile, useCurrentFrame } from "remotion";
import type { PromoScene } from "../promoData";
import { WORKFLOW_STEPS } from "../promoData";
import { loopWave, reveal, rise, sceneProgress } from "../motion";
import { BrandMark, FloatingPaper, FlowRail, SceneFrame } from "./ScenePrimitives";

export const OpeningScene = ({ scene }: { scene: PromoScene }) => {
  const frame = useCurrentFrame();
  const progress = sceneProgress(frame, scene.duration);

  return (
    <SceneFrame scene={scene} accent="amber">
      <div className="openingStage">
        <div
          className="mascotHalo"
          style={{
            transform: `scale(${0.92 + progress * 0.13}) rotate(${loopWave(frame, 0.012, 2)}deg)`,
          }}
        >
          <BrandMark size={252} withMascot />
        </div>
        <div className="openingCopy">
          <div
            className="brandLockup"
            style={{
              opacity: reveal(frame, 8),
              transform: `translateY(${rise(frame, 24, 8)}px)`,
            }}
          >
            <BrandMark size={78} />
            <div>
              <strong>小妍</strong>
              <span>Research Copilot</span>
            </div>
          </div>
          <div className="heroLine">
            <span>Planner</span>
            <span>RAG</span>
            <span>Agents</span>
            <span>Submission</span>
          </div>
        </div>
        <FloatingPaper index={0} label="Survey Draft" x={80} y={180} />
        <FloatingPaper index={1} label="PDF Figures" x={1360} y={80} />
        <FloatingPaper index={2} label="Graph RAG" x={230} y={420} />
        <FloatingPaper index={3} label="Review Notes" x={1390} y={405} />
      </div>
    </SceneFrame>
  );
};

export const ChallengeScene = ({ scene }: { scene: PromoScene }) => {
  const frame = useCurrentFrame();
  const tasks = ["找方向", "筛论文", "读图表", "写综述", "沉淀知识", "追踪投稿"];

  return (
    <SceneFrame scene={scene} accent="rose">
      <div className="challengeGrid">
        <div className="taskCloud">
          {tasks.map((task, index) => (
            <div
              className="taskCard"
              key={task}
              style={{
                opacity: reveal(frame, 6 + index * 4),
                transform: `translate(${loopWave(frame + index * 24, 0.035, 12)}px, ${rise(frame, 30, 6 + index * 4)}px) rotate(${[-4, 3, -2, 5, -3, 2][index]}deg)`,
              }}
            >
              <small>Step {index + 1}</small>
              <strong>{task}</strong>
              <span>上下文断点</span>
            </div>
          ))}
          <div className="brokenLine" />
        </div>

        <div className="workflowPanel">
          <div className="panelLabel">小妍将分散任务接成连续流程</div>
          <FlowRail steps={WORKFLOW_STEPS} />
          <div className="contextStrip">
            <Img src={staticFile("app-logo.svg")} />
            <span>同一套本地知识底座</span>
            <strong>持续积累上下文</strong>
          </div>
        </div>
      </div>
    </SceneFrame>
  );
};
