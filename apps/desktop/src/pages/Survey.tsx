import { clsx } from "clsx";
import SurveyPanel from "../features/knowledge/SurveyPanel";

export default function Survey({ hideFolders = false }: { hideFolders?: boolean }) {
  return (
    <div className="rc-app-page space-y-5">
      <div className={clsx("mx-auto w-full space-y-5", hideFolders && "max-w-5xl px-4")}>
        <SurveyPanel hideInterestPanel={hideFolders} />
      </div>
    </div>
  );
}
