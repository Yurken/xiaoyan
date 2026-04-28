import { Composition } from "remotion";
import { ResearchCopilotPromo } from "./ResearchCopilotPromo";
import { VIDEO } from "./promoData";

export const RemotionRoot = () => {
  return (
    <Composition
      component={ResearchCopilotPromo}
      durationInFrames={VIDEO.durationInFrames}
      fps={VIDEO.fps}
      height={VIDEO.height}
      id="ResearchCopilotPromo"
      width={VIDEO.width}
    />
  );
};
