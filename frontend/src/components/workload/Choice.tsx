import type { ReactNode } from "react";

export function ChoiceCard({ name, value, checked, onChange, icon, title, text }: {
  name: string; value: string; checked: boolean; onChange: () => void; icon?: ReactNode; title: string; text?: string;
}) {
  return (
    <label className={`choice ${checked ? "selected" : ""}`}>
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} />
      <span className="choice-body">
        {icon && <span className="choice-icon" aria-hidden="true">{icon}</span>}
        <span className="choice-title">{title}</span>
        {text && <span className="choice-text">{text}</span>}
      </span>
    </label>
  );
}

export function Segmented<T extends string>({ legend, name, value, options, onChange }: {
  legend: string; name: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void;
}) {
  return (
    <fieldset className="seg">
      <legend className="sr-only">{legend}</legend>
      {options.map((o) => (
        <label key={o.value} className={value === o.value ? "on" : ""}>
          <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
          <span>{o.label}</span>
        </label>
      ))}
    </fieldset>
  );
}
