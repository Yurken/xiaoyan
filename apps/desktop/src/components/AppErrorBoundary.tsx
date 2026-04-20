import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { Card } from "@research-copilot/ui";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Desktop render failed", error, info);
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <div className="h-full bg-nm-bg p-6">
        <Card className="mx-auto flex max-w-2xl flex-col gap-4">
          <div className="flex items-center gap-3 text-apple-red">
            <AlertCircle className="h-6 w-6" />
            <h1 className="text-lg font-semibold text-ink-primary">应用启动失败</h1>
          </div>
          <p className="text-sm text-ink-secondary">
            前端在初始化时遇到了未处理异常，当前已阻止白屏继续扩散。
          </p>
          <p className="break-all rounded-2xl bg-white/60 px-4 py-3 text-sm text-apple-red shadow-nm-inset">
            {this.state.error.message}
          </p>
          <p className="text-xs text-ink-tertiary">
            如果应用仍然出现秒退，请查看系统临时目录中的
            <span className="mx-1 font-mono">xiaoyan-desktop.log</span>
            启动日志。
          </p>
        </Card>
      </div>
    );
  }
}
