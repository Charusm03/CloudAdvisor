import { BookOpen, Database, History, LayoutDashboard, PlusCircle } from "lucide-react";

export const NAV = [
  { to: "/", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/analysis/new", label: "New Analysis", icon: PlusCircle, end: false },
  { to: "/analyses", label: "My Analyses", icon: History, end: false },
  { to: "/pricing", label: "Pricing Data", icon: Database, end: false },
  { to: "/methodology", label: "Methodology", icon: BookOpen, end: false },
] as const;
