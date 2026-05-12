import SurveyComposerPanel from "./SurveyComposerPanel";
import SurveyResultsWorkspace from "./SurveyResultsWorkspace";
import { useSurveyGeneration } from "./useSurveyGeneration";

export default function SurveyPanel({ hideInterestPanel = false }: { hideInterestPanel?: boolean }) {
  const survey = useSurveyGeneration();

  return (
    <div className="min-w-0 flex-1 space-y-3">
      <SurveyComposerPanel controller={survey} hideInterestPanel={hideInterestPanel} />
      <SurveyResultsWorkspace controller={survey} />
    </div>
  );
}
