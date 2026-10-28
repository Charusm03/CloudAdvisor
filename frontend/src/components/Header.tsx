import { Link } from "react-router-dom";
import { CalendarClock, Cloudy } from "lucide-react";
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
      <div className="topbar-right">
        <span className="snapshot" title="Pricing snapshot date">
          <CalendarClock size={15} aria-hidden="true" />
          <span>Pricing snapshot: <strong>{snapshotDate ? fmtDate(snapshotDate) : "loading…"}</strong></span>
          <Tooltip label="pricing snapshot">{TERMS.snapshot.text}</Tooltip>
        </span>
      </div>
    </header>
  );
}
