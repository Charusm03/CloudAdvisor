import type { RecommendationResponse } from "../types";
import { fmtDate, modelLabel, providerLabel, usd } from "./format";
import { headlineSavings } from "./derive";

const csvCell = (v: string | number | null) => {
  const s = v === null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function candidatesCsv(r: RecommendationResponse): string {
  const head = ["rank", "provider", "region", "instance", "vcpu", "ram_gb", "gpu_type", "pricing_model", "interruption_risk",
    "compute_usd", "storage_usd", "egress_usd", "ingress_usd", "total_usd", "workload_fit_pct", "pricing_snapshot"];
  const rows = r.candidates.map((c) => [c.rank, c.provider, c.region, c.instance_type, c.vcpu, c.ram_gb, c.gpu_type,
    c.pricing_model_label, c.interruption_risk, c.compute_cost, c.storage_cost, c.egress_cost, c.ingress_cost,
    c.total_monthly_cost, Math.round(c.resource_fit_score * 100), r.pricing_snapshot_date]);
  return [head, ...rows].map((row) => row.map((v) => csvCell(v as string | number | null)).join(",")).join("\r\n");
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportCsv(r: RecommendationResponse, name = "cloudwise-analysis") {
  download(new Blob([candidatesCsv(r)], { type: "text/csv;charset=utf-8" }), `${name}.csv`);
}

export async function exportPdf(r: RecommendationResponse, name = "cloudwise-analysis") {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const w = r.workload, best = r.best_overall;
  let y = 48;
  const h = (t: string) => { doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text(t, 40, y); y += 8; };
  const after = () => { y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 22; };
  doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.text("CloudWise Advisor: cost analysis", 40, y); y += 18;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  doc.text(`Pricing snapshot: ${fmtDate(r.pricing_snapshot_date)}. Estimates only, not a bill.`, 40, y); y += 24;

  h("Recommendation");
  autoTable(doc, { startY: y, theme: "plain", styles: { fontSize: 10 }, body: [
    ["Option", `${best.provider} ${best.instance_type}, ${best.pricing_model_label}, ${best.region}`],
    ["Estimated monthly cost", usd(best.total_monthly_cost)],
    ["Savings vs cheapest on-demand", (() => { const s = headlineSavings(best); return s ? `${usd(s.amount)} (${s.baseline})` : "n/a"; })()],
    ["Workload fit", `${Math.round(best.resource_fit_score * 100)}%`],
    ["Interruption risk", best.interruption_risk],
  ] }); after();

  h("Workload summary");
  autoTable(doc, { startY: y, theme: "plain", styles: { fontSize: 10 }, body: [
    ["Compute", `${w.vcpu} vCPU, ${w.ram_gb} GB RAM`], ["Storage", `${w.storage_gb} GB ${w.storage_type}`],
    ["Network", `${w.monthly_data_transfer_in_gb} GB in, ${w.monthly_data_transfer_out_gb} GB out per month`],
    ["Usage", w.usage_pattern], ["Runtime", `${w.expected_runtime_hours_per_month} hours/month`],
    ["Interruption tolerant", w.interruption_tolerant ? "Yes" : "No"], ["GPU", w.gpu_required ? String(w.gpu_type) : "None"],
    ["Region", w.preferred_region === "any" ? "Any supported region" : w.preferred_region],
  ] }); after();

  h("Cost breakdown (recommended option)");
  autoTable(doc, { startY: y, head: [["Component", "USD / month"]], styles: { fontSize: 10 }, body: [
    ["Compute", usd(best.compute_cost)], ["Storage", usd(best.storage_cost)], ["Outbound data", usd(best.egress_cost)],
    ["Inbound data", usd(best.ingress_cost)], ["Total", usd(best.total_monthly_cost)] ] }); after();

  h("Provider comparison");
  autoTable(doc, { startY: y, head: [["Provider", "Best compatible option", "Pricing", "USD / month"]], styles: { fontSize: 9 },
    body: Object.entries(r.provider_comparison).map(([p, c]) => c
      ? [p, providerLabel(c), modelLabel[c.pricing_model], usd(c.total_monthly_cost)] : [p, "No compatible option", "", ""]) }); after();

  h("Top 3 options");
  autoTable(doc, { startY: y, head: [["#", "Option", "Pricing", "Total", "Fit", "Risk"]], styles: { fontSize: 9 },
    body: r.recommendations.map((c) => [c.rank, providerLabel(c), modelLabel[c.pricing_model], usd(c.total_monthly_cost),
      `${Math.round(c.resource_fit_score * 100)}%`, c.interruption_risk]) }); after();

  doc.addPage(); y = 48; h("Calculation assumptions");
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  for (const a of r.assumptions) { const lines = doc.splitTextToSize(`• ${a}`, 510); doc.text(lines, 40, y); y += lines.length * 12 + 4; }
  doc.save(`${name}.pdf`);
}
