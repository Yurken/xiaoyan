import { MemoryRouter, useLocation } from "react-router-dom";
import type { ReactNode } from "react";

export function createRouterWrapper(initialEntries: string[] = ["/"]) {
  return function RouterWrapper({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter initialEntries={initialEntries}>
        {children}
      </MemoryRouter>
    );
  };
}

export function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

export function createAppShellWrapper(initialEntries: string[] = ["/"]) {
  return function AppShellWrapper({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter initialEntries={initialEntries}>
        <div className="app-shell">
          <aside className="app-sidebar" />
          <main className="app-main">{children}</main>
        </div>
      </MemoryRouter>
    );
  };
}
