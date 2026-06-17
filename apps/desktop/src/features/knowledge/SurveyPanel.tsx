import { useEffect, useRef, useState } from "react";
import SurveyComposerPanel from "./SurveyComposerPanel";
import SurveyHistoryPanel from "./SurveyHistoryPanel";
import SurveyResultsWorkspace from "./SurveyResultsWorkspace";
import { useSurveyGeneration } from "./useSurveyGeneration";

export default function SurveyPanel({ hideInterestPanel = false }: { hideInterestPanel?: boolean }) {
  const survey = useSurveyGeneration();
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const wasGenerating = useRef(false);

  // 一次生成由「生成中 → 结束且产出结构化结果」收口时，刷新历史列表读到刚落盘的综述。
  useEffect(() => {
    if (wasGenerating.current && !survey.generating && survey.structured) {
      setHistoryRefresh((value) => value + 1);
    }
    wasGenerating.current = survey.generating;
  }, [survey.generating, survey.structured]);

  return (
    <div className="min-w-0 flex-1 space-y-3">
      <SurveyComposerPanel controller={survey} hideInterestPanel={hideInterestPanel} />
      <SurveyResultsWorkspace controller={survey} />
      <SurveyHistoryPanel refreshKey={historyRefresh} />
    </div>
  );
}
