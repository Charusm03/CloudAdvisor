import { NavLink } from "react-router-dom";
import { FlaskConical, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { NAV } from "./nav";

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <aside className="sidebar" aria-label="Sidebar">
      <nav aria-label="Sections">
        <ul>
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <li key={to}>
              <NavLink to={to} end={end} title={label}>
                <Icon size={19} aria-hidden="true" /><span className="nav-label">{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="sidebar-foot">
        <div className="proto">
          <FlaskConical size={17} aria-hidden="true" />
          <div className="nav-label"><strong>Prototype</strong><small>Pre-deployment cost analysis</small></div>
        </div>
        <button type="button" className="collapse-btn" onClick={onToggle} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-pressed={collapsed}>
          {collapsed ? <PanelLeftOpen size={18} aria-hidden="true" /> : <PanelLeftClose size={18} aria-hidden="true" />}
          <span className="nav-label">Collapse</span>
        </button>
      </div>
    </aside>
  );
}

export function MobileNav() {
  return (
    <nav className="mobilenav" aria-label="Mobile">
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end}><Icon size={20} aria-hidden="true" /><span>{label.replace("New Analysis", "New")}</span></NavLink>
      ))}
    </nav>
  );
}
