import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import AppErrorBoundary from "./components/AppErrorBoundary";
import "./index.css";

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

const root = createRoot(document.getElementById("root")!);
root.render(
  <StrictMode>
    <AppErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
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
