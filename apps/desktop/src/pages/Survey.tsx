import { clsx } from "clsx";
import SurveyPanel from "../features/knowledge/SurveyPanel";

export default function Survey({ hideFolders = false }: { hideFolders?: boolean }) {
  return (
    <div className={clsx("rc-app-page space-y-5", hideFolders && "max-w-5xl")}>
      <SurveyPanel hideInterestPanel={hideFolders} />
    </div>
  );
}
