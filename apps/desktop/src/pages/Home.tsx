import HomeWorkspace from "../features/workbench/home/HomeWorkspace";
import { useWorkbenchOverview } from "../features/workbench/useWorkbenchOverview";

export default function Home() {
  const overview = useWorkbenchOverview();
  return <HomeWorkspace {...overview} />;
}
