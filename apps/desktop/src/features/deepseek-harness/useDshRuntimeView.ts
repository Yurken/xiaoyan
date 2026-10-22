import { useEffect, useRef, useState } from "react";
import type { Webview } from "@tauri-apps/api/webview";
import { DSH_CONTROLS_INITIAL_SIZE, DSH_CONTROLS_SURFACE, DSH_VIEWPORT_EVENT } from "./shared";
import { floatingRuntimeControlsStorageKey, clampFloatingRuntimeControlsPosition } from "../code-harness/shared";
import { readFloatingRuntimePosition } from "../code-harness/floatingRuntimeControlsStorage";

/** DSH's Strict cookie needs a top-level context; controls use a local sibling above it. */
export function useDshRuntimeView(url: string) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState("");
  const native = "__TAURI_INTERNALS__" in window;

  useEffect(() => {
    if (!native) return;
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    let failed = false;
    let resizeFrame = 0;
    let observer: ResizeObserver | undefined;
    type OwnedView = { view: Webview; created: boolean; unlisten: Array<() => void> };
    const owned: OwnedView[] = [];
    let content: OwnedView;
    let controls: OwnedView | undefined;
    setError("");

    const close = (entry: OwnedView) => {
      if (entry.created) void entry.view.close().catch(() => {});
    };
    const fail = () => {
      if (disposed || failed) return;
      failed = true;
      observer?.disconnect();
      cancelAnimationFrame(resizeFrame);
      owned.forEach(close);
      setError("DSH 页面未能加载，请重新加载页面。");
    };
    const track = (view: Webview, onCreated: () => void): OwnedView => {
      const entry = { view, created: false, unlisten: [] as Array<() => void> };
      owned.push(entry);
      void view.once("tauri://created", () => {
        entry.created = true;
        if (disposed || failed) {
          close(entry);
          entry.unlisten.forEach((stop) => stop());
        } else onCreated();
      }).then((stop) => entry.unlisten.push(stop)).catch(fail);
      void view.once("tauri://error", fail).then((stop) => entry.unlisten.push(stop)).catch(fail);
      return entry;
    };

    const mount = async () => {
      const [{ Webview: NativeWebview }, { getCurrentWindow }, { LogicalPosition, LogicalSize }] = await Promise.all([
        import("@tauri-apps/api/webview"),
        import("@tauri-apps/api/window"),
        import("@tauri-apps/api/dpi"),
      ]);
      if (disposed) return;
      const bounds = host.getBoundingClientRect();
      const resize = () => {
        cancelAnimationFrame(resizeFrame);
        resizeFrame = requestAnimationFrame(() => {
          if (disposed || failed || !content.created) return;
          const next = host.getBoundingClientRect();
          const updates = [
            content.view.setPosition(new LogicalPosition(next.x, next.y)),
            content.view.setSize(new LogicalSize(Math.max(1, next.width), Math.max(1, next.height))),
          ];
          if (controls?.created) updates.push(controls.view.emitTo(controls.view.label, DSH_VIEWPORT_EVENT, next.toJSON()));
          void Promise.all(updates).catch(fail);
        });
      };
      content = track(new NativeWebview(getCurrentWindow(), `dsh-${crypto.randomUUID()}`, {
        url, x: bounds.x, y: bounds.y, width: Math.max(1, bounds.width), height: Math.max(1, bounds.height),
        focus: false, dragDropEnabled: false,
      }), () => {
        const current = host.getBoundingClientRect();
        const size = DSH_CONTROLS_INITIAL_SIZE;
        const initial = readFloatingRuntimePosition(floatingRuntimeControlsStorageKey("dsh"))
          ?? { x: current.width - size.width - 184, y: 12 };
        const position = clampFloatingRuntimeControlsPosition(initial, current, size);
        const localUrl = new URL("/", window.location.href);
        localUrl.searchParams.set("surface", DSH_CONTROLS_SURFACE);
        localUrl.searchParams.set("viewport", JSON.stringify(current.toJSON()));
        // Created after the remote view so the controls remain above it and clickable.
        controls = track(new NativeWebview(getCurrentWindow(), `dsh-controls-${crypto.randomUUID()}`, {
          url: localUrl.href, x: current.x + position.x, y: current.y + position.y,
          width: size.width, height: size.height, transparent: true, focus: false, dragDropEnabled: false,
        }), resize);
        observer = new ResizeObserver(resize);
        observer.observe(host);
        resize();
      });
    };
    void mount().catch(fail);

    return () => {
      disposed = true;
      observer?.disconnect();
      cancelAnimationFrame(resizeFrame);
      owned.forEach((entry) => {
        close(entry);
        // A pending creation listener must survive until its late view can be closed.
        if (entry.created) entry.unlisten.forEach((stop) => stop());
      });
    };
  }, [attempt, native, url]);

  return { hostRef, native, error, reload: () => setAttempt((value) => value + 1) };
}
