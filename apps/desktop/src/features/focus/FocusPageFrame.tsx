import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import MacWindowDragStrip from "../../components/MacWindowDragStrip";
import { MACOS_WINDOW_DRAG_HEIGHT } from "../../lib/windowChrome";
import FocusSettingsLink from "./FocusSettingsLink";

export default function FocusPageFrame({
  title,
  children,
  home = false,
  settings = true,
}: {
  title: string;
  children: ReactNode;
  home?: boolean;
  settings?: boolean;
}) {
  return (
    <div className="rc-focus-page-frame">
      <header className="rc-focus-header flex-shrink-0">
        <MacWindowDragStrip style={{ height: `${MACOS_WINDOW_DRAG_HEIGHT}px` }} />
        <div className="flex min-h-12 items-center gap-3 px-4 py-2">
          {!home && (
            <Link to="/" className="rc-focus-back-btn flex-shrink-0" aria-label="返回主题列表">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          )}
          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-ink-primary">{title}</p>
          {settings && <FocusSettingsLink />}
        </div>
      </header>
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
