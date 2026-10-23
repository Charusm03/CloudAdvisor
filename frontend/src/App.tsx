import { useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { AppProviders } from "./context/AppContext";
import { AppShell } from "./components/AppShell";
import Overview from "./pages/Overview";
import NewAnalysis from "./pages/NewAnalysis";
import MyAnalyses from "./pages/MyAnalyses";
import SavedAnalysis from "./pages/SavedAnalysis";
import PricingData from "./pages/PricingData";
import Methodology from "./pages/Methodology";
import { EmptyState } from "./components/common/EmptyState";
import { Link } from "react-router-dom";
import { Compass } from "lucide-react";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo?.(0, 0); }, [pathname]);
  return null;
}

export default function App() {
  return (
    <AppProviders>
      <AppShell>
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/analysis/new" element={<NewAnalysis />} />
          <Route path="/analyses" element={<MyAnalyses />} />
          <Route path="/analyses/:id" element={<SavedAnalysis />} />
          <Route path="/pricing" element={<PricingData />} />
          <Route path="/methodology" element={<Methodology />} />
          <Route path="*" element={<div className="page-pad"><EmptyState icon={<Compass size={30} />} title="Page not found" message="That page doesn't exist." action={<Link to="/" className="btn btn-primary">Go to overview</Link>} /></div>} />
        </Routes>
      </AppShell>
    </AppProviders>
  );
}
