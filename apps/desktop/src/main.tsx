import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import AppErrorBoundary from "./components/AppErrorBoundary";
import "./index.css";

window.addEventListener("error", (event) => {
  console.error("Window error", event.error ?? event.message);
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("Unhandled promise rejection", event.reason);
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AppErrorBoundary>
  </StrictMode>
);
