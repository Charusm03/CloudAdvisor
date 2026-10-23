import { Globe2 } from "lucide-react";
import { usePricing } from "../../context/AppContext";
import { ChoiceCard } from "./Choice";
import type { FormErrors, FormState } from "../../services/validation";
import type { ProviderName } from "../../types";

const PROV_NAME: Record<ProviderName, string> = { AWS: "AWS", Azure: "Azure", GCP: "Google Cloud" };

export function RegionStep({ form, errors, set }: { form: FormState; errors: FormErrors; set: (p: Partial<FormState>) => void }) {
  const { regionsByProvider, loading, error, retry } = usePricing();
  return (
    <section className="subsection" aria-labelledby="region-title">
      <h3 id="region-title">Where should it run?</h3>
      <div className="choices">
        <ChoiceCard name="region" value="any" checked={form.preferred_region === "any"} onChange={() => set({ preferred_region: "any" })}
          icon={<Globe2 size={20} />} title="Any supported region" text="Compare every region in the pricing data." />
      </div>
      {loading && <p className="help">Loading supported regions…</p>}
      {error && <p className="help">Couldn't load the region list. <button type="button" className="link" onClick={retry}>Try again</button></p>}
      <div className="region-groups">
        {(Object.keys(regionsByProvider) as ProviderName[]).filter((p) => regionsByProvider[p].length).map((p) => (
          <fieldset key={p} className="region-group">
            <legend>{PROV_NAME[p]}</legend>
            {regionsByProvider[p].map((r) => (
              <label key={r} className={`pill ${form.preferred_region === r ? "on" : ""}`}>
                <input type="radio" name="region" value={r} checked={form.preferred_region === r} onChange={() => set({ preferred_region: r })} />
                <span>{r}</span>
              </label>
            ))}
          </fieldset>
        ))}
      </div>
      {errors.preferred_region && <p className="field-error">{errors.preferred_region}</p>}
    </section>
  );
}
