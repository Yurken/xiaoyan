import type { ReactNode } from "react";

/** Leave branding to the embedded Harness and keep its process controls reachable. */
export default function RuntimeControlBar({ children }: { children: ReactNode }) {
  return (
    <header className="app-header flex flex-shrink-0 items-center justify-end border-b border-nm-dark/10 px-4 pb-2">
      {children}
    </header>
  );
}
