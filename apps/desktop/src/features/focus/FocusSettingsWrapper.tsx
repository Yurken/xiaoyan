import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import Settings from "../../pages/Settings";
import MacWindowDragStrip from "../../components/MacWindowDragStrip";
import {
  IS_MACOS_DESKTOP,
  MACOS_WINDOW_DRAG_HEIGHT,
} from "../../lib/windowChrome";

export default function FocusSettingsWrapper() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col h-full">
      <div className="rc-focus-header flex-shrink-0">
        <MacWindowDragStrip
          style={{ height: `${MACOS_WINDOW_DRAG_HEIGHT}px` }}
        />
        <div
          className="flex items-center gap-3 px-4 min-h-12"
          style={{
            paddingBottom: IS_MACOS_DESKTOP ? "10px" : undefined,
          }}
        >
          <button
            type="button"
            onClick={() => navigate("/")}
            className="rc-focus-back-btn"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        <Settings />
      </div>
    </div>
  );
}
