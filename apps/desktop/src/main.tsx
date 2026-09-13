import "./lib/readableStreamAsyncIteratorPolyfill";
import { lazy, StrictMode, Suspense, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import AppErrorBoundary from "./components/AppErrorBoundary";
import "./index.css";

// 生产环境下禁止文本选择，开发环境允许复制文字
if (!import.meta.env.DEV) {
  document.documentElement.setAttribute("data-production", "");
}

// 禁用默认右键菜单，只在可编辑元素上保留原生菜单（复制/粘贴等）
const handleContextMenu = (e: MouseEvent) => {
  const target = e.target as HTMLElement;
  if (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.isContentEditable
  ) {
    return;
  }
  e.preventDefault();
};

const handleDragStart = (event: DragEvent) => {
  const target = event.target;
  if (!(target instanceof Element)) return;

  // 如果目标位于显式 draggable 的容器内部，由容器自己的 dragstart 处理，不在这里拦截。
  if (target.closest("[draggable='true']")) return;

  if (
    target.closest(
      "button, [role='button'], a, img, svg, [data-no-drag='true'], .rc-icon-button, .app-nav-link"
    )
  ) {
    event.preventDefault();
  }
};

const handleWindowError = (event: ErrorEvent) => {
  console.error("Window error", event.error ?? event.message);
};

const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
  console.error("Unhandled promise rejection", event.reason);
};

document.addEventListener("contextmenu", handleContextMenu);
document.addEventListener("dragstart", handleDragStart);
window.addEventListener("error", handleWindowError);
window.addEventListener("unhandledrejection", handleUnhandledRejection);

type WindowLabel = "main" | "assistant-dock" | "assistant-panel" | null;

function useWindowLabel(): WindowLabel {
  const [label, setLabel] = useState<WindowLabel>(null);

  useEffect(() => {
    let cancelled = false;

    const detect = async () => {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        const currentLabel = getCurrentWindow().label;
        if (!cancelled) {
          setLabel(currentLabel as WindowLabel);
          document.documentElement.setAttribute("data-tauri-window-label", currentLabel);
        }
      } catch {
        // 非 Tauri 环境（浏览器、测试）默认走主窗口
        if (!cancelled) {
          setLabel("main");
        }
      }
    };

    void detect();

    return () => {
      cancelled = true;
    };
  }, []);

  return label;
}

const AssistantDockWindow = lazy(() => import("./features/desktop-assistant/windows/AssistantDockWindow"));
const AssistantPanelWindow = lazy(() => import("./features/desktop-assistant/windows/AssistantPanelWindow"));
const CaptureOverlayWindow = lazy(() => import("./features/desktop-assistant/components/CaptureOverlay"));

function WindowRoot() {
  const label = useWindowLabel();

  if (label === null) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-apple-blue border-t-transparent" />
      </div>
    );
  }

  if (label.startsWith("assistant-capture-overlay")) {
    return (
      <Suspense fallback={<div className="h-full w-full" />}>
        <CaptureOverlayWindow />
      </Suspense>
    );
  }

  if (label === "assistant-dock") {
    return (
      <Suspense fallback={<div className="h-full w-full" />}>
        <AssistantDockWindow />
      </Suspense>
    );
  }

  if (label === "assistant-panel") {
    return (
      <Suspense fallback={<div className="h-full w-full" />}>
        <AssistantPanelWindow />
      </Suspense>
    );
  }

  return (
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(
  <StrictMode>
    <AppErrorBoundary>
      <WindowRoot />
    </AppErrorBoundary>
  </StrictMode>
);

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    document.removeEventListener("contextmenu", handleContextMenu);
    document.removeEventListener("dragstart", handleDragStart);
    window.removeEventListener("error", handleWindowError);
    window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    root.unmount();
  });
}
