import WritingWorkspace from "../features/writing/WritingWorkspace";

export default function Writing({
  defaultResearchInterestId,
}: {
  defaultResearchInterestId?: string;
}) {
  return <WritingWorkspace defaultResearchInterestId={defaultResearchInterestId} />;
}
