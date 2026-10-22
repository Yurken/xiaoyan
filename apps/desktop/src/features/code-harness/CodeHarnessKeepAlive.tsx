import { Suspense, lazy, type ComponentType, type LazyExoticComponent } from "react";
import { useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import RouteErrorBoundary from "../../components/RouteErrorBoundary";
import { CODE_HARNESS_PROVIDERS, codeHarnessProviderForPath, type CodeHarnessProvider } from "./shared";
import { CodeHarnessActivityContext } from "./useCodeHarnessActivity";
import { useKeepAliveMounted } from "./useKeepAliveMounted";

const HARNESS_PAGES: Record<CodeHarnessProvider, LazyExoticComponent<ComponentType>> = {
  dsh: lazy(() => import("../../pages/Code")),
  codex: lazy(() => import("../../pages/Codex")),
  opencode: lazy(() => import("../../pages/OpenCode")),
  pi: lazy(() => import("../../pages/PiWeb")),
};

function HarnessPageFallback() {
  return (
    <div className="flex h-full items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-ink-tertiary" />
    </div>
  );
}

function HarnessPane({ provider, active }: { provider: CodeHarnessProvider; active: boolean }) {
  const mounted = useKeepAliveMounted(active);
  if (!mounted) return null;

  const Page = HARNESS_PAGES[provider];
  return (
    <div
      data-provider={provider}
      data-active={active ? "true" : "false"}
      aria-hidden={active ? undefined : true}
      className={`absolute inset-0 flex min-h-0 flex-col ${active ? "" : "invisible pointer-events-none"}`.trim()}
    >
      <CodeHarnessActivityContext.Provider value={active}>
        <Suspense fallback={<HarnessPageFallback />}>
          <RouteErrorBoundary>
            <Page />
          </RouteErrorBoundary>
        </Suspense>
      </CodeHarnessActivityContext.Provider>
    </div>
  );
}

/**
 * 代码 Harness 的常驻宿主：每个 Harness 页面首次访问后保留在 DOM 中，切页只隐藏不卸载。
 *
 * 内嵌的 DSH / Codex / OpenCode / Pi 都是完整 Web 应用，卸载 iframe 会让它们整体重新加载，
 * 丢失会话位置、滚动位置和未提交输入；后端进程本来就不随路由停止，所以宿主只负责保活。
 * 隐藏用 `visibility`（而不是 `display: none`）保留 iframe 的实际视口尺寸，避免内嵌页面
 * 在重新展示时按 0×0 重排；`pointer-events-none` 保证隐藏页面不吃事件与焦点。
 *
 * 页面本身仍由 `pages/` 组合，路由只声明路径并由该宿主渲染，见 `App.tsx` 与 `FocusLayout.tsx`。
 * 工作台页签里的代码页是另一处挂载点，用 `CodeHarnessTabPanel` 做同样的保活。
 */
export default function CodeHarnessKeepAlive() {
  const location = useLocation();
  const activeProvider = codeHarnessProviderForPath(location.pathname);

  return (
    <div
      data-testid="code-harness-keep-alive"
      aria-hidden={activeProvider ? undefined : true}
      className={`absolute inset-0 ${activeProvider ? "" : "invisible pointer-events-none"}`.trim()}
    >
      {CODE_HARNESS_PROVIDERS.map((provider) => (
        <HarnessPane key={provider} provider={provider} active={provider === activeProvider} />
      ))}
    </div>
  );
}