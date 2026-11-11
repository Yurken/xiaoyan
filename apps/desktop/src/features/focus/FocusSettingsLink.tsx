import { Settings } from "lucide-react";
import { Link } from "react-router-dom";

export default function FocusSettingsLink() {
  return (
    <Link
      to="/settings"
      className="rc-focus-back-btn flex-shrink-0"
      aria-label="打开设置"
      title="设置"
    >
      <Settings className="h-4 w-4" />
    </Link>
  );
}
