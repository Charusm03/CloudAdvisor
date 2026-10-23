import { Link, NavLink } from "react-router-dom";
import { CalendarClock, CircleHelp, Cloudy } from "lucide-react";
import { NAV } from "./nav";
import { usePricing } from "../context/AppContext";
import { fmtDate } from "../lib/format";
import { Tooltip, TERMS } from "./common/Tooltip";

export function Header() {
  const { snapshotDate } = usePricing();
  return (
    <header className="topbar">
      <Link to="/" className="brand">
        <span className="brand-mark" aria-hidden="true"><Cloudy size={22} /></span>
        <span className="brand-text"><strong>CloudWise Advisor</strong><small>Multi-Cloud Cost &amp; Deployment Advisor</small></span>
      </Link>
      <nav className="topnav" aria-label="Primary">
        {NAV.map((n) => <NavLink key={n.to} to={n.to} end={n.end}>{n.label}</NavLink>)}
      </nav>
      <div className="topbar-right">
        <span className="snapshot" title="Pricing snapshot date">
          <CalendarClock size={15} aria-hidden="true" />
          <span>Pricing snapshot: <strong>{snapshotDate ? fmtDate(snapshotDate) : "loading…"}</strong></span>
          <Tooltip label="pricing snapshot">{TERMS.snapshot.text}</Tooltip>
        </span>
        <Link to="/methodology" className="icon-btn" aria-label="Help and methodology"><CircleHelp size={20} aria-hidden="true" /></Link>
      </div>
    </header>
  );
}
