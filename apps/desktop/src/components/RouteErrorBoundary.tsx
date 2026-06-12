import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

export default class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("Route render failed", error);
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback;
    }

    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="text-center">
          <p className="text-sm text-ink-secondary">该模块加载出错</p>
          <pre className="mx-auto mt-2 max-w-md break-all rounded-2xl bg-white/60 px-4 py-2 text-left text-xs text-apple-red shadow-nm-inset">
            {this.state.error.message}
          </pre>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="mt-3 text-sm text-apple-blue hover:underline"
          >
            重试
          </button>
        </div>
      </div>
    );
  }
}
