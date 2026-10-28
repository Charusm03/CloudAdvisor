import type { Candidate, ProviderName } from "../../types";
import { fitPct, usd } from "../../lib/format";

const COLORS: Record<ProviderName, string> = { AWS: "#B45F06", Azure: "#1F6FB5", GCP: "#6B4FBB" };
const W = 640, H = 300, L = 54, R = 16, T = 14, B = 44;

function Marker({ p, x, y, r, best }: { p: ProviderName; x: number; y: number; r: number; best: boolean }) {
  const common = { fill: COLORS[p], fillOpacity: 0.78, stroke: best ? "#0E1530" : "#fff", strokeWidth: best ? 2.5 : 1 };
  if (p === "AWS") return <circle cx={x} cy={y} r={r} {...common} />;
  if (p === "Azure") return <rect x={x - r} y={y - r} width={r * 2} height={r * 2} {...common} />;
  return <polygon points={`${x},${y - r * 1.2} ${x + r * 1.1},${y + r} ${x - r * 1.1},${y + r}`} {...common} />;
}

export function CostVsFitChart({ candidates, best }: { candidates: Candidate[]; best: Candidate }) {
  const costs = candidates.map((c) => c.total_monthly_cost);
  const sameFit = candidates.length > 1 && new Set(candidates.map(fitPct)).size === 1;
  const min = Math.min(...costs), max = Math.max(...costs);
  const pad = (max - min || max || 1) * 0.08;
  const x0 = Math.max(0, min - pad), x1 = max + pad;
  const sx = (v: number) => L + ((v - x0) / (x1 - x0 || 1)) * (W - L - R);
  const sy = (fit: number) => T + (1 - fit / 100) * (H - T - B);
  const xTicks = [0, 1, 2, 3, 4].map((i) => x0 + ((x1 - x0) * i) / 4);
  return (
    <section id="chart" className="block-sm" aria-labelledby="chart-h">
      <h3 id="chart-h">Cost vs workload fit</h3>
      <p className="lead-sm">Upper-left options provide a stronger combination of low cost and high workload fit.</p>
      {sameFit && <p className="help" role="note">All options use the same instance size, so they have the same workload fit ({fitPct(best)}%). Only cost differs: the further left, the cheaper.</p>}
      <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img"
        aria-label={`Scatter chart of ${candidates.length} compatible options by monthly cost (${usd(min)} to ${usd(max)}) and workload fit. The recommended option is outlined.`}>
        {[0, 25, 50, 75, 100].map((t) => (
          <g key={t}><line x1={L} x2={W - R} y1={sy(t)} y2={sy(t)} className="grid" /><text x={L - 8} y={sy(t) + 4} textAnchor="end" className="tick">{t}%</text></g>
        ))}
        {xTicks.map((t, i) => <text key={i} x={sx(t)} y={H - B + 18} textAnchor="middle" className="tick">{usd(t, 0)}</text>)}
        <text x={(L + W - R) / 2} y={H - 6} textAnchor="middle" className="axis">Estimated monthly cost</text>
        <text transform={`translate(12 ${(T + H - B) / 2}) rotate(-90)`} textAnchor="middle" className="axis">Workload fit</text>
        {candidates.map((c, i) => (
          <g key={i}><Marker p={c.provider} x={sx(c.total_monthly_cost)} y={sy(fitPct(c))} r={5} best={false} />
            <title>{`${c.provider} ${c.instance_type} (${c.pricing_model_label}, ${c.region}): ${usd(c.total_monthly_cost)}, fit ${fitPct(c)}%`}</title></g>
        ))}
        <g><Marker p={best.provider} x={sx(best.total_monthly_cost)} y={sy(fitPct(best))} r={7} best />
          <title>{`Recommended: ${best.provider} ${best.instance_type}`}</title></g>
      </svg>
      <ul className="legend" aria-label="Chart legend">
        {(["AWS", "Azure", "GCP"] as ProviderName[]).map((p) => (
          <li key={p}><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><Marker p={p} x={8} y={8} r={5} best={false} /></svg>{p}</li>
        ))}
        <li><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6" fill="none" stroke="#0E1530" strokeWidth="2" /></svg>Recommended (outlined)</li>
      </ul>
    </section>
  );
}
