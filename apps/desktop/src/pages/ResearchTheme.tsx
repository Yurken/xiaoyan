import { useParams } from "react-router-dom";
import ResearchCommandCenter from "../features/research-context/ResearchCommandCenter";

export default function ResearchTheme() {
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return null;
  }

  return (
    <div className="rc-app-page bg-apple-gray-50">
      <ResearchCommandCenter themeId={id} />
    </div>
  );
}
