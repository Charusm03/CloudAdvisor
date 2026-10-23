import { useState, type ReactNode } from "react";
import { Header } from "./Header";
import { Sidebar, MobileNav } from "./Sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(() => typeof window !== "undefined" && window.innerWidth < 1180);
  return (
    <div className={`shell ${collapsed ? "is-collapsed" : ""}`}>
      <a className="skip-link" href="#main">Skip to main content</a>
      <Header />
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <main id="main" className="workspace" tabIndex={-1}>{children}</main>
      <MobileNav />
    </div>
  );
}
