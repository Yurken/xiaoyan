import { useCurrentFrame } from "remotion";
import type { PromoScene } from "../promoData";
import { AGENTS, MODEL_ROLES, PAPER_FEATURES } from "../promoData";
import { loopWave, reveal, rise } from "../motion";
import { MiniGraph, MockWindow, Pill, SceneFrame } from "./ScenePrimitives";

export const MissionScene = ({ scene }: { scene: PromoScene }) => {
  const frame = useCurrentFrame();

  return (
    <SceneFrame scene={scene} accent="teal" compact>
      <MockWindow title="Mission Control">
        <div className="missionLayout">
          <aside>
            {["工作台", "规划", "综述", "论文库", "知识图谱"].map((item, index) => (
              <span className={index === 2 ? "activeNav" : ""} key={item}>
                {item}
              </span>
            ))}
          </aside>
          <main>
            <div className="missionHeader">
              <div>
                <small>Research brief</small>
                <strong>构建一个可信的文献综述</strong>
              </div>
              <Pill delay={8} tone="amber">
                streaming
              </Pill>
            </div>
            <div className="agentRows">
              {AGENTS.map((agent, index) => (
                <div
                  className={`agentRow tone-${agent.tone}`}
                  key={agent.name}
                  style={{
                    opacity: reveal(frame, 14 + index * 8),
                    transform: `translateX(${(1 - reveal(frame, 14 + index * 8)) * -36}px)`,
                  }}
                >
                  <span>{index + 1}</span>
                  <div>
                    <strong>{agent.name}</strong>
                    <small>{agent.role}</small>
                  </div>
                  <i style={{ width: `${42 + index * 11 + loopWave(frame, 0.04, 9)}%` }} />
                </div>
              ))}
            </div>
          </main>
          <section>
            <div className="traceCard">
              <small>Sources</small>
              <strong>8 篇候选论文</strong>
              <span>arXiv + 本地论文库 + 知识卡片</span>
            </div>
            <div className="traceCard">
              <small>Plan</small>
              <strong>5 个执行步骤</strong>
              <span>每一步都保留可追溯来源</span>
            </div>
          </section>
        </div>
      </MockWindow>
    </SceneFrame>
  );
};

export const PapersScene = ({ scene }: { scene: PromoScene }) => {
  const frame = useCurrentFrame();

  return (
    <SceneFrame scene={scene} accent="blue" compact>
      <div className="papersLayout">
        <MockWindow title="Papers Workspace">
          <div className="paperWorkspace">
            <div className="pdfPreview">
              <div className="pdfToolbar" />
              <div className="pdfTitle">attention-graph-rag.pdf</div>
              <div className="pdfFigure" />
              <div className="pdfLines">
                <span />
                <span />
                <span />
              </div>
            </div>
            <div className="analysisColumn">
              <strong>小妍解读</strong>
              <p>结论会主动引用图 2、表 1，并给出复现实验配置建议。</p>
              <div className="chunkList">
                {[1, 2, 3, 4].map((item, index) => (
                  <span
                    key={item}
                    style={{
                      opacity: reveal(frame, 16 + index * 8),
                      width: `${58 + index * 10}%`,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </MockWindow>
        <div className="featureStack">
          {PAPER_FEATURES.map((feature, index) => (
            <div
              className="featureCard"
              key={feature}
              style={{
                opacity: reveal(frame, 10 + index * 8),
                transform: `translateY(${rise(frame, 26, 10 + index * 8)}px)`,
              }}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{feature}</strong>
            </div>
          ))}
        </div>
      </div>
    </SceneFrame>
  );
};

export const KnowledgeScene = ({ scene }: { scene: PromoScene }) => {
  const frame = useCurrentFrame();

  return (
    <SceneFrame scene={scene} accent="green" compact>
      <div className="knowledgeLayout">
        <div className="graphPanel">
          <MiniGraph dense />
          <div className="graphLegend">
            <Pill delay={12} tone="green">
              papers
            </Pill>
            <Pill delay={18} tone="amber">
              notes
            </Pill>
            <Pill delay={24} tone="rose">
              memories
            </Pill>
          </div>
        </div>
        <div className="ragAnswer">
          <small>Graph RAG Answer</small>
          <strong>这个方向的核心分歧是什么？</strong>
          <p>
            小妍会同时检索语义相似段落和图邻域上下文，合并论文引用、知识卡片与用户记忆后回答。
          </p>
          <div className="citationRows">
            {["Paper A -> Paper C", "Note: 方法局限", "Memory: 偏好低成本复现"].map((item, index) => (
              <span
                key={item}
                style={{
                  opacity: reveal(frame, 34 + index * 10),
                  transform: `translateX(${(1 - reveal(frame, 34 + index * 10)) * 24}px)`,
                }}
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>
    </SceneFrame>
  );
};

export const SubmissionScene = ({ scene }: { scene: PromoScene }) => {
  const frame = useCurrentFrame();
  const cards = [
    ["DDL 日历", "ICLR 2027", "42 days"],
    ["投稿看板", "Draft -> Review", "4 tracks"],
    ["版本控制", "v3 rebuttal", "PDF snapshot"],
    ["模拟审稿", "2 major, 1 minor", "actionable"],
  ];

  return (
    <SceneFrame scene={scene} accent="amber" compact>
      <div className="submissionBoard">
        {cards.map(([title, detail, meta], index) => (
          <div
            className="submissionCard"
            key={title}
            style={{
              opacity: reveal(frame, 8 + index * 9),
              transform: `translateY(${rise(frame, 30, 8 + index * 9)}px)`,
            }}
          >
            <small>{title}</small>
            <strong>{detail}</strong>
            <span>{meta}</span>
          </div>
        ))}
        <div className="reviewThread">
          <strong>作者回复跟踪</strong>
          {["方法对比补充", "消融实验计划", "图表说明重写"].map((item, index) => (
            <div key={item}>
              <span style={{ width: `${52 + index * 18 + loopWave(frame, 0.03, 5)}%` }} />
              <em>{item}</em>
            </div>
          ))}
        </div>
      </div>
    </SceneFrame>
  );
};

export const ClosingScene = ({ scene }: { scene: PromoScene }) => {
  const frame = useCurrentFrame();

  return (
    <SceneFrame scene={scene} accent="teal">
      <div className="closingLayout">
        <div className="modelRoles">
          {MODEL_ROLES.map((role, index) => (
            <div
              className="modelRole"
              key={role}
              style={{
                opacity: reveal(frame, index * 7),
                transform: `translateX(${(1 - reveal(frame, index * 7)) * -28}px)`,
              }}
            >
              <span>{role}</span>
              <i />
            </div>
          ))}
        </div>
        <div className="finalLockup">
          <div className="localCore">
            <strong>Tauri + SQLite</strong>
            <span>核心数据本地保存</span>
          </div>
          <div className="finalBrand">
            <span>小妍</span>
            <strong>Research Copilot</strong>
            <p>可观测的科研 AI 协同台</p>
          </div>
        </div>
      </div>
    </SceneFrame>
  );
};
