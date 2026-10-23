import type { ReactNode } from "react";

export interface FieldProps {
  id: string; label: ReactNode; labelText: string; unit?: string; value: string; onChange: (v: string) => void;
  error?: string; help?: string; icon?: ReactNode; step?: string;
}

export function Field({ id, label, labelText, unit, value, onChange, error, help, icon, step = "any" }: FieldProps) {
  const described = [help ? `${id}-help` : "", error ? `${id}-err` : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div className={`field ${error ? "has-error" : ""}`}>
      <div className="field-label"><label htmlFor={id}>{labelText}</label>{label}</div>
      <div className="input-wrap">
        {icon && <span className="input-icon" aria-hidden="true">{icon}</span>}
        <input id={id} type="number" inputMode="decimal" min="0" step={step} value={value}
          onChange={(e) => onChange(e.target.value)} aria-invalid={!!error} aria-describedby={described} />
        {unit && <span className="unit" aria-hidden="true">{unit}</span>}
      </div>
      {help && <p className="help" id={`${id}-help`}>{help}</p>}
      {error && <p className="field-error" id={`${id}-err`}>{error}</p>}
    </div>
  );
}
