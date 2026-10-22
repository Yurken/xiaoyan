import type { ReactNode } from "react";
import MacWindowDragStrip from "../../components/MacWindowDragStrip";
import { MACOS_WINDOW_DRAG_HEIGHT } from "../../lib/windowChrome";
import FloatingRuntimeControls from "./FloatingRuntimeControls";
import type { CodeHarnessProvider } from "./shared";

interface RuntimeWebFrameProps {
  provider: CodeHarnessProvider;
  label: string;
  /** iframe 的无障碍标题，同时是内嵌页面的名称。 */
  title: string;
  url: string | null;
  sandbox: string;
  initialPositionClassName?: string;
  children: ReactNode;
}

/**
 * 代码助手运行中的页面容器：顶部先放宿主自有的 macOS 拖拽带，内嵌页面从带子下方开始。
 *
 * 内嵌页面与宿主跨源，宿主收不到 iframe 内的按下事件，窗口拖动只能由这条带子承担；
 * 把它放在 iframe 之前，也顺带避免壳层那条透明拖拽区盖住内嵌页面自己的顶栏控件。
 * 非 macOS 平台 `MacWindowDragStrip` 返回 null，布局与改动前一致。
 */
export default function RuntimeWebFrame({
  provider,
  label,
  title,
  url,
  sandbox,
  initialPositionClassName,
  children,
}: RuntimeWebFrameProps) {
  return (
    <>
      <MacWindowDragStrip
        className="runtime-frame__window-drag-band flex-shrink-0"
        style={{ height: `${MACOS_WINDOW_DRAG_HEIGHT}px` }}
      />
      <div className="relative min-h-0 flex-1 bg-white">
        <iframe
          key={url ?? "stopped"}
          src={url ?? undefined}
          title={title}
          className="absolute inset-0 h-full w-full border-0"
          allow="clipboard-read; clipboard-write"
          sandbox={sandbox}
        />
        <FloatingRuntimeControls
          provider={provider}
          label={label}
          initialPositionClassName={initialPositionClassName}
        >
          {children}
        </FloatingRuntimeControls>
      </div>
    </>
  );
}
