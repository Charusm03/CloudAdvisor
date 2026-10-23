import { Server, ShieldCheck, Zap } from "lucide-react";
import type { PricingModel } from "../../types";
import { modelLabel } from "../../lib/format";

const ICON = { on_demand: Server, reserved: ShieldCheck, spot: Zap } as const;

export function PricingModelBadge({ model, label }: { model: PricingModel; label?: string }) {
  const Icon = ICON[model];
  return <span className={`mbadge mbadge-${model}`}><Icon size={13} aria-hidden="true" />{label ?? modelLabel[model]}</span>;
}
